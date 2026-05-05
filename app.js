/**
 * ========================================
 * СКЛАДПРО — СИСТЕМА УПРАВЛЕНИЯ ОСТАТКАМИ
 * app.js — с авторизацией и панелью менеджера
 * ========================================
 */

'use strict';

/* ================================================
   FIREBASE CONFIG & INIT
================================================ */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getDatabase,
  ref,
  onValue,
  set,
  remove,
  push,
  get,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

const firebaseConfig = {
  apiKey:            'AIzaSyD25nN75reCO5UOwwI1nLYtrZPX0dTa1Oo',
  authDomain:        'warehouse-e09a0.firebaseapp.com',
  projectId:         'warehouse-e09a0',
  storageBucket:     'warehouse-e09a0.firebasestorage.app',
  messagingSenderId: '1031869586497',
  appId:             '1:1031869586497:web:073f87f1899a532c1f7ac0',
  databaseURL:       'https://warehouse-e09a0-default-rtdb.firebaseio.com',
};

const firebaseApp  = initializeApp(firebaseConfig);
const db           = getDatabase(firebaseApp);
const PRODUCTS_REF = ref(db, 'products');
const USERS_REF    = ref(db, 'users');
const LOGS_REF     = ref(db, 'logs');

/* ================================================
   CONSTANTS
================================================ */
const STORAGE_KEY      = 'skladpro_products_v1';
const SESSION_KEY      = 'skladpro_session_v1';
const USERS_CACHE_KEY  = 'skladpro_users_v1';
const LOGS_CACHE_KEY   = 'skladpro_logs_v1';

const CATEGORY_LABELS = {
  drinks:     'Напитки',
  disposable: 'Одноразовая посуда',
  food:       'Продукты',
  cleaning:   'Чистящие средства',
  other:      'Прочее',
};

const BRANCH_LABELS = { branch1: 'Сибирский', branch2: 'Фреско', branch3: 'Гелион' };
const BRANCH_KEYS   = ['branch1', 'branch2', 'branch3'];

const ROLE_LABELS = { staff: 'Сотрудник', manager: 'Менеджер', admin: 'Администратор' };

/* ================================================
   STATE
================================================ */
const state = {
  products:         [],
  users:            [],
  logs:             [],
  activeBranch:     'all',
  searchQuery:      '',
  categoryFilter:   'all',
  stockFilter:      'all',     // 'all' | 'low' | 'out' | 'ok'
  sortMode:         'smart',   // умная сортировка: малые запасы наверху
  pendingDeleteId:  null,
  pendingDeleteUserId: null,
  editingProductId: null,
  currentViewId:    null,
  photoDataUrl:     null,
  firebaseLoaded:   false,
  currentUser:      null,   // { id, username, name, role }
};

/* ================================================
   UTILITY
================================================ */
const uid = () => `id_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

function getQty(product, branch = 'all') {
  if (branch === 'all') return BRANCH_KEYS.reduce((s, k) => s + (product.branches[k] ?? 0), 0);
  return product.branches[branch] ?? 0;
}

function getStockStatus(qty) {
  if (qty === 0) return 'out';
  if (qty <= 5)  return 'low';
  return 'ok';
}

const STOCK_BADGE = {
  ok:  { label: 'В наличии', cls: 'badge--ok'  },
  low: { label: 'Мало',      cls: 'badge--low' },
  out: { label: 'Нет',       cls: 'badge--out' },
};

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDateTime(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function hashPassword(pass) {
  // Простой хэш (для продакшн используйте bcrypt через сервер)
  let h = 0;
  for (let i = 0; i < pass.length; i++) {
    h = Math.imul(31, h) + pass.charCodeAt(i) | 0;
  }
  return h.toString(16);
}

/* ================================================
   LOCAL STORAGE
================================================ */
function saveLocal(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
}
function loadLocal(key) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch (e) { return null; }
}

/* ================================================
   SESSION
================================================ */
function saveSession(user) {
  saveLocal(SESSION_KEY, user);
}
function loadSession() {
  return loadLocal(SESSION_KEY);
}
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

/* ================================================
   ACTION LOGS
================================================ */
const LOG_TYPES = {
  login:    { icon: '🔑', label: 'Вход в систему' },
  logout:   { icon: '🚪', label: 'Выход из системы' },
  register: { icon: '👤', label: 'Регистрация' },
  add:      { icon: '➕', label: 'Добавление товара' },
  edit:     { icon: '✏️', label: 'Редактирование товара' },
  delete:   { icon: '🗑️', label: 'Удаление товара' },
  addUser:  { icon: '👥', label: 'Добавление пользователя' },
  delUser:  { icon: '❌', label: 'Удаление пользователя' },
};

async function writeLog(type, details = '') {
  if (!state.currentUser) return;
  const entry = {
    id:       uid(),
    type,
    userId:   state.currentUser.id,
    userName: state.currentUser.name || state.currentUser.username,
    details,
    ts:       Date.now(),
  };
  try {
    await set(ref(db, `logs/${entry.id}`), entry);
  } catch (e) {
    // оффлайн — сохраняем локально
    state.logs.unshift(entry);
    saveLocal(LOGS_CACHE_KEY, state.logs);
  }
}

/* ================================================
   FIREBASE LISTENERS
================================================ */
function initFirebaseListeners() {
  showSyncIndicator('connecting');

  // Products
  onValue(PRODUCTS_REF, (snap) => {
    const data = snap.val();
    if (data) {
      state.products = Object.values(data);
    } else if (!state.firebaseLoaded) {
      const cached = loadLocal(STORAGE_KEY);
      state.products = (cached && cached.length > 0) ? cached : getDefaultProducts();
      state.products.forEach(p => fbSaveProduct(p));
    } else {
      state.products = [];
    }
    state.firebaseLoaded = true;
    saveLocal(STORAGE_KEY, state.products);
    renderAll();
    showSyncIndicator('ok');
  }, (err) => {
    console.error('Firebase products error:', err);
    showSyncIndicator('error');
    if (!state.firebaseLoaded) {
      state.products = loadLocal(STORAGE_KEY) || getDefaultProducts();
      state.firebaseLoaded = true;
      renderAll();
    }
    showToast('⚠ Нет связи — работаем офлайн', 'error');
  });

  // Users — список пользователей нужен только менеджерам
  if (state.currentUser && state.currentUser.role !== 'staff') {
    onValue(USERS_REF, (snap) => {
      const data = snap.val();
      state.users = data ? Object.values(data) : [];
      saveLocal(USERS_CACHE_KEY, state.users);
      renderManagerUsers();
    }, () => {
      state.users = loadLocal(USERS_CACHE_KEY) || [];
      renderManagerUsers();
    });
  }

  // Logs — только менеджеры видят журнал действий
  if (state.currentUser && state.currentUser.role !== 'staff') {
    onValue(LOGS_REF, (snap) => {
      const data = snap.val();
      state.logs = data ? Object.values(data).sort((a, b) => b.ts - a.ts) : [];
      saveLocal(LOGS_CACHE_KEY, state.logs);
      renderManagerLogs();
    }, () => {
      state.logs = loadLocal(LOGS_CACHE_KEY) || [];
      renderManagerLogs();
    });
  } else {
    // Сотрудники не загружают журнал
    state.logs = [];
  }
}

/* ================================================
   FIREBASE CRUD
================================================ */
async function fbSaveProduct(product) {
  try { await set(ref(db, `products/${product.id}`), product); }
  catch (e) { console.error('Save error:', e); showToast('⚠ Ошибка синхронизации', 'error'); }
}

async function fbDeleteProduct(id) {
  try { await remove(ref(db, `products/${id}`)); }
  catch (e) { console.error('Delete error:', e); showToast('⚠ Ошибка удаления', 'error'); }
}

async function fbSaveUser(user) {
  try { await set(ref(db, `users/${user.id}`), user); }
  catch (e) { console.error('User save error:', e); }
}

async function fbDeleteUser(userId) {
  try { await remove(ref(db, `users/${userId}`)); }
  catch (e) { console.error('User delete error:', e); }
}

async function fbClearLogs() {
  try { await remove(LOGS_REF); }
  catch (e) { console.error('Clear logs error:', e); }
}

/* ================================================
   SYNC INDICATOR
================================================ */
function showSyncIndicator(status) {
  const el = document.getElementById('syncIndicator');
  if (el) {
    const map = {
      connecting: { text: '⏳ Подключение...',  cls: 'sync--connecting' },
      ok:         { text: '☁ Синхронизировано', cls: 'sync--ok'         },
      error:      { text: '⚠ Офлайн',           cls: 'sync--error'      },
    };
    const s = map[status] || map.ok;
    el.textContent = s.text;
    el.className   = `sync-indicator ${s.cls}`;
  }
  // Обновляем drawer sync (если он есть)
  if (typeof updateDrawerSync === 'function') updateDrawerSync(status);
}

/* ================================================
   DEMO DATA
================================================ */
function getDefaultProducts() {
  return [
    { id: uid(), name: 'Pepsi 0.5л',                category: 'drinks',     unit: 'шт',     description: 'Газированный напиток Pepsi, бутылка 0.5 литра', photo: null, branches: { branch1: 24, branch2: 8,  branch3: 3  } },
    { id: uid(), name: 'Coca-Cola 1л',               category: 'drinks',     unit: 'шт',     description: 'Классическая Кока-Кола, бутылка 1 литр',         photo: null, branches: { branch1: 12, branch2: 20, branch3: 15 } },
    { id: uid(), name: 'Пластиковые стаканы 250мл',  category: 'disposable', unit: 'уп',     description: 'Одноразовые стаканы, упаковка 100 штук',          photo: null, branches: { branch1: 5,  branch2: 2,  branch3: 0  } },
    { id: uid(), name: 'Трубочки для коктейлей',     category: 'disposable', unit: 'уп',     description: 'Пластиковые трубочки, упаковка 500 штук',         photo: null, branches: { branch1: 3,  branch2: 0,  branch3: 1  } },
    { id: uid(), name: 'Сахар 1кг',                  category: 'food',       unit: 'кг',     description: 'Сахар-песок, пакет 1кг',                          photo: null, branches: { branch1: 10, branch2: 6,  branch3: 4  } },
    { id: uid(), name: 'Fairy 500мл',                category: 'cleaning',   unit: 'шт',     description: 'Средство для мытья посуды Fairy, 500мл',          photo: null, branches: { branch1: 4,  branch2: 4,  branch3: 2  } },
  ];
}

/* ================================================
   DOM SHORTCUTS
================================================ */
const $ = id => document.getElementById(id);

/* ================================================
   AUTH SYSTEM
================================================ */
function showAuthScreen(screenId) {
  ['authChoose', 'authLogin', 'authRegister'].forEach(id => {
    const el = $(id);
    if (el) el.style.display = id === screenId ? 'block' : 'none';
  });
  // Сброс ошибок
  const err1 = $('loginError'), err2 = $('regError');
  if (err1) err1.textContent = '';
  if (err2) err2.textContent = '';
}

function initAuth() {
  // Попытка восстановить сессию
  const session = loadSession();
  if (session && session.id) {
    // Проверяем что пользователь существует в кэше
    const users = loadLocal(USERS_CACHE_KEY) || [];
    const exists = users.find(u => u.id === session.id);
    if (exists) {
      state.currentUser = exists;
      hideAuth();
      return;
    }
  }

  showAuthScreen('authChoose');
  $('authOverlay').style.display = 'flex';

  // Кнопки выбора
  $('goLoginBtn').addEventListener('click', () => showAuthScreen('authLogin'));
  $('goRegisterBtn').addEventListener('click', () => showAuthScreen('authRegister'));
  $('backFromLogin').addEventListener('click', () => showAuthScreen('authChoose'));
  $('backFromRegister').addEventListener('click', () => showAuthScreen('authChoose'));

  // Показать/скрыть пароль
  $('loginEye').addEventListener('click', () => {
    const inp = $('loginPassword');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });
  $('regEye').addEventListener('click', () => {
    const inp = $('regPassword');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  // Вход
  $('loginSubmitBtn').addEventListener('click', handleLogin);
  $('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });

  // Регистрация
  $('regSubmitBtn').addEventListener('click', handleRegister);
  $('regPassword').addEventListener('keydown', e => { if (e.key === 'Enter') handleRegister(); });
}

async function handleLogin() {
  const username = $('loginUsername').value.trim();
  const password = $('loginPassword').value;
  const errEl    = $('loginError');

  if (!username || !password) {
    errEl.textContent = 'Заполните все поля';
    return;
  }

  // Грузим пользователей из Firebase или кэша
  let users = [];
  try {
    const snap = await get(USERS_REF);
    users = snap.val() ? Object.values(snap.val()) : (loadLocal(USERS_CACHE_KEY) || []);
  } catch (e) {
    users = loadLocal(USERS_CACHE_KEY) || [];
  }

  const hashed = hashPassword(password);
  const user = users.find(u => u.username === username && u.passwordHash === hashed);

  if (!user) {
    errEl.textContent = 'Неверный логин или пароль';
    errEl.style.animation = 'none';
    requestAnimationFrame(() => { errEl.style.animation = 'shake 0.3s ease'; });
    return;
  }

  state.currentUser = user;
  saveSession(user);
  await writeLog('login', `Вход с логином: ${username}`);
  hideAuth();
  showToast(`👋 Добро пожаловать, ${user.name || user.username}!`, 'success');
}

async function handleRegister() {
  const name     = $('regName').value.trim();
  const username = $('regUsername').value.trim();
  const password = $('regPassword').value;
  const errEl    = $('regError');

  if (!name || !username || !password) {
    errEl.textContent = 'Заполните все поля';
    return;
  }
  if (username.length < 3) {
    errEl.textContent = 'Логин минимум 3 символа';
    return;
  }
  if (password.length < 4) {
    errEl.textContent = 'Пароль минимум 4 символа';
    return;
  }

  // Проверяем уникальность логина
  let users = [];
  try {
    const snap = await get(USERS_REF);
    users = snap.val() ? Object.values(snap.val()) : (loadLocal(USERS_CACHE_KEY) || []);
  } catch (e) {
    users = loadLocal(USERS_CACHE_KEY) || [];
  }

  if (users.find(u => u.username === username)) {
    errEl.textContent = 'Такой логин уже занят';
    return;
  }

  // Первый пользователь становится менеджером
  const isFirst = users.length === 0;

  const newUser = {
    id:           uid(),
    name,
    username,
    passwordHash: hashPassword(password),
    role:         isFirst ? 'manager' : 'staff',
    createdAt:    Date.now(),
  };

  await fbSaveUser(newUser);

  state.currentUser = newUser;
  saveSession(newUser);

  // Записываем лог — временно ставим пользователя
  await writeLog('register', `Зарегистрировался: ${username}`);

  hideAuth();
  showToast(`✓ Аккаунт создан! Добро пожаловать, ${name}!`, 'success');

  if (isFirst) {
    setTimeout(() => showToast('🏆 Вы первый — вам выдана роль Менеджера', 'success'), 2000);
  }
}

function hideAuth() {
  const overlay = $('authOverlay');
  if (overlay) overlay.style.display = 'none';

  // Показываем основной интерфейс
  const toShow = ['mainHeader', 'mainToolbar', 'mainContent'];
  toShow.forEach(id => {
    const el = $(id);
    if (el) el.style.display = '';
  });

  // Обновляем юзер-чип
  updateUserChip();

  // Показываем кнопку менеджера для менеджеров
  const managerBtn = $('managerPanelBtn');
  if (managerBtn) {
    managerBtn.style.display = state.currentUser && state.currentUser.role !== 'staff' ? 'flex' : 'none';
  }

  // Инициализируем Firebase только после авторизации
  initFirebaseListeners();
  initBranchNav();
  initFilters();
  initPhotoUpload();
  initSteppers();
  initProductEventListeners();
  initManagerPanel();
  initUserChip();
  initMobileUI();
}

function updateUserChip() {
  if (!state.currentUser) return;
  const u = state.currentUser;
  const initial = (u.name || u.username || '?')[0].toUpperCase();
  const nameEl = $('userChipName');
  const avatarEl = $('userAvatar');
  const dropName = $('dropdownName');
  const dropRole = $('dropdownRole');
  if (nameEl)   nameEl.textContent = u.name || u.username;
  if (avatarEl) avatarEl.textContent = initial;
  if (dropName) dropName.textContent = u.name || u.username;
  if (dropRole) dropRole.textContent = ROLE_LABELS[u.role] || u.role;
}

function initUserChip() {
  const chip = $('userChip');
  if (!chip) return;

  chip.addEventListener('click', (e) => {
    e.stopPropagation();
    chip.classList.toggle('open');
  });

  document.addEventListener('click', () => chip.classList.remove('open'));

  $('logoutBtn').addEventListener('click', () => {
    chip.classList.remove('open');
    handleLogout();
  });
}

async function handleLogout() {
  await writeLog('logout', 'Выход из системы');
  clearSession();
  state.currentUser = null;
  // Скрываем интерфейс
  ['mainHeader', 'mainToolbar', 'mainContent'].forEach(id => {
    const el = $(id);
    if (el) el.style.display = 'none';
  });
  // Закрываем drawer если открыт
  const drawer = $('drawerOverlay');
  if (drawer) drawer.classList.remove('active');
  $('authOverlay').style.display = 'flex';
  showAuthScreen('authChoose');
  showToast('👋 Вы вышли из системы');
}

/* ================================================
   MOBILE UI (Drawer + Branch Modal)
================================================ */
function initMobileUI() {
  initDrawer();
  initBranchModal();
  updateBranchIndicator();
  updateDrawerProfile();
  updateDrawerSync('connecting');
}

function initDrawer() {
  const burgerBtn      = $('burgerBtn');
  const drawerOverlay  = $('drawerOverlay');
  const drawerCloseBtn = $('drawerCloseBtn');
  if (!burgerBtn || !drawerOverlay) return;

  const openDrawer = () => {
    updateDrawerProfile();
    drawerOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  };
  const closeDrawer = () => {
    drawerOverlay.classList.remove('active');
    document.body.style.overflow = '';
  };

  burgerBtn.addEventListener('click', openDrawer);
  drawerCloseBtn.addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', e => {
    if (e.target === drawerOverlay) closeDrawer();
  });

  // Кнопка "Филиал" в drawer — открывает модалку выбора
  $('drawerBranchBtn').addEventListener('click', () => {
    closeDrawer();
    setTimeout(() => openBranchModal(), 220);
  });

  // Кнопка "Добавить товар" в drawer
  $('drawerAddBtn').addEventListener('click', () => {
    closeDrawer();
    setTimeout(() => openEditModal(null), 220);
  });

  // Кнопка "Печать" в drawer
  $('drawerPrintBtn').addEventListener('click', () => {
    closeDrawer();
    setTimeout(() => preparePrint(), 220);
  });

  // Кнопка "Менеджер" в drawer (только для менеджеров)
  $('drawerManagerBtn').addEventListener('click', () => {
    closeDrawer();
    setTimeout(() => {
      const managerOverlay = $('managerOverlay');
      if (!managerOverlay) return;
      managerOverlay.style.display = 'flex';
      requestAnimationFrame(() => managerOverlay.classList.add('active'));
      renderManagerUsers();
      renderManagerLogs();
    }, 220);
  });
  // Показываем кнопку менеджера если пользователь — менеджер
  if (state.currentUser && state.currentUser.role !== 'staff') {
    $('drawerManagerBtn').style.display = 'flex';
  }

  // Выход
  $('drawerLogoutBtn').addEventListener('click', () => {
    closeDrawer();
    setTimeout(() => handleLogout(), 220);
  });

  // Индикатор филиала под шапкой — открывает модалку выбора
  const branchIndicator = $('branchIndicator');
  if (branchIndicator) {
    branchIndicator.addEventListener('click', openBranchModal);
  }

  // Закрытие drawer по ESC
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawerOverlay.classList.contains('active')) closeDrawer();
  });
}

function updateDrawerProfile() {
  if (!state.currentUser) return;
  const u = state.currentUser;
  const initial = (u.name || u.username || '?')[0].toUpperCase();
  const av = $('drawerAvatar');
  const nm = $('drawerName');
  const rl = $('drawerRole');
  if (av) av.textContent = initial;
  if (nm) nm.textContent = u.name || u.username;
  if (rl) rl.textContent = ROLE_LABELS[u.role] || u.role;
}

function updateDrawerSync(status) {
  const dot = $('drawerSyncDot');
  const txt = $('drawerSyncText');
  if (!dot || !txt) return;
  const map = {
    connecting: { text: 'Подключение...',  cls: 'connecting' },
    ok:         { text: 'Синхронизировано', cls: '' },
    error:      { text: 'Офлайн режим',     cls: 'error' },
  };
  const s = map[status] || map.ok;
  dot.className = 'drawer-sync__dot ' + s.cls;
  txt.textContent = s.text;
}

function initBranchModal() {
  const modal      = $('branchModal');
  const closeBtn   = $('branchModalClose');
  if (!modal) return;

  closeBtn.addEventListener('click', () => closeOverlay(modal));
  modal.addEventListener('click', e => {
    if (e.target === modal) closeOverlay(modal);
  });

  // Клик по любому филиалу в модалке
  modal.querySelectorAll('.branch-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const branch = opt.dataset.branch;
      // Снимаем active со всех
      modal.querySelectorAll('.branch-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      // Применяем
      state.activeBranch = branch;
      // Синхронизируем десктопные кнопки филиалов
      document.querySelectorAll('.branches .branch-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.branch === branch);
      });
      updateBranchIndicator();
      renderAll();
      // Закрываем с небольшой задержкой для красивой анимации
      setTimeout(() => closeOverlay(modal), 180);
    });
  });
}

function openBranchModal() {
  const modal = $('branchModal');
  if (!modal) return;
  // Подсвечиваем активный филиал
  modal.querySelectorAll('.branch-option').forEach(o => {
    o.classList.toggle('active', o.dataset.branch === state.activeBranch);
  });
  // Обновляем статистику по каждому филиалу
  updateBranchModalStats();
  openOverlay(modal);
}

function updateBranchModalStats() {
  const totalAll = state.products.length;
  const elAll = $('branchStatAll');
  if (elAll) {
    const allItems = state.products.reduce((s, p) => s + getQty(p), 0);
    elAll.textContent = `${totalAll} наименований • ${allItems} ед.`;
  }
  BRANCH_KEYS.forEach((k, i) => {
    const el = $(`branchStat${i + 1}`);
    if (!el) return;
    const items = state.products.reduce((s, p) => s + (p.branches[k] ?? 0), 0);
    const lowCount = state.products.filter(p => {
      const q = p.branches[k] ?? 0;
      return q > 0 && q <= 5;
    }).length;
    const outCount = state.products.filter(p => (p.branches[k] ?? 0) === 0).length;
    let extra = '';
    if (outCount > 0) extra = ` • ⚠ ${outCount} нет`;
    else if (lowCount > 0) extra = ` • ⚠ ${lowCount} мало`;
    el.textContent = `${items} ед.${extra}`;
  });
}

function updateBranchIndicator() {
  const indicator = $('branchIndicatorValue');
  if (!indicator) return;
  const label = state.activeBranch === 'all' ? 'Все филиалы' : (BRANCH_LABELS[state.activeBranch] || state.activeBranch);
  indicator.textContent = label;

  const drawerSub = $('drawerBranchSub');
  if (drawerSub) drawerSub.textContent = label;
}

/* ================================================
   MANAGER PANEL
================================================ */
function initManagerPanel() {
  // Только для менеджеров и админов
  if (!state.currentUser || state.currentUser.role === 'staff') return;

  const managerBtn     = $('managerPanelBtn');
  const managerOverlay = $('managerOverlay');
  const closeBtn       = $('managerCloseBtn');

  if (!managerBtn || !managerOverlay) return;

  managerBtn.addEventListener('click', () => {
    managerOverlay.style.display = 'flex';
    requestAnimationFrame(() => managerOverlay.classList.add('active'));
    renderManagerUsers();
    renderManagerLogs();
  });

  closeBtn.addEventListener('click', closeManagerPanel);
  managerOverlay.addEventListener('click', e => {
    if (e.target === managerOverlay) closeManagerPanel();
  });

  // Табы
  document.querySelectorAll('.manager-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.manager-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabId = tab.dataset.tab;
      $('tabUsers').style.display = tabId === 'users' ? 'block' : 'none';
      $('tabLogs').style.display  = tabId === 'logs'  ? 'block' : 'none';
    });
  });

  // Добавить пользователя
  $('managerAddUserBtn').addEventListener('click', () => {
    $('maName').value = $('maUsername').value = $('maPassword').value = '';
    $('maRole').value = 'staff';
    $('maError').textContent = '';
    openOverlay($('managerAddModal'));
  });

  $('managerAddModalClose').addEventListener('click', () => closeOverlay($('managerAddModal')));
  $('managerAddModal').addEventListener('click', e => {
    if (e.target === $('managerAddModal')) closeOverlay($('managerAddModal'));
  });

  $('maSubmitBtn').addEventListener('click', handleManagerAddUser);

  // Очистить логи
  $('clearLogsBtn').addEventListener('click', async () => {
    await fbClearLogs();
    state.logs = [];
    renderManagerLogs();
    showToast('✓ Журнал очищен');
  });

  // Удаление пользователя
  $('confirmUserCancelBtn').addEventListener('click', () => {
    closeOverlay($('confirmUserModal'));
    state.pendingDeleteUserId = null;
  });
  $('confirmUserDeleteBtn').addEventListener('click', async () => {
    if (state.pendingDeleteUserId) {
      const user = state.users.find(u => u.id === state.pendingDeleteUserId);
      await fbDeleteUser(state.pendingDeleteUserId);
      await writeLog('delUser', `Удалён пользователь: ${user ? user.username : state.pendingDeleteUserId}`);
      state.pendingDeleteUserId = null;
      closeOverlay($('confirmUserModal'));
      showToast('✓ Пользователь удалён');
    }
  });
}

function closeManagerPanel() {
  const overlay = $('managerOverlay');
  overlay.classList.remove('active');
  setTimeout(() => { overlay.style.display = 'none'; }, 320);
}

async function handleManagerAddUser() {
  const name     = $('maName').value.trim();
  const username = $('maUsername').value.trim();
  const password = $('maPassword').value;
  const role     = $('maRole').value;
  const errEl    = $('maError');

  if (!name || !username || !password) { errEl.textContent = 'Заполните все поля'; return; }
  if (state.users.find(u => u.username === username)) { errEl.textContent = 'Логин уже занят'; return; }

  const newUser = {
    id:           uid(),
    name,
    username,
    passwordHash: hashPassword(password),
    role,
    createdAt:    Date.now(),
  };

  await fbSaveUser(newUser);
  await writeLog('addUser', `Добавлен пользователь: ${username} (${ROLE_LABELS[role]})`);
  closeOverlay($('managerAddModal'));
  showToast(`✓ Пользователь ${name} добавлен`);
}

function renderManagerUsers() {
  const list = $('managerUsersList');
  if (!list) return;

  if (!state.users.length) {
    list.innerHTML = '<div class="log-empty">Нет пользователей</div>';
    return;
  }

  list.innerHTML = state.users.map(u => {
    const initial = (u.name || u.username || '?')[0].toUpperCase();
    const isMe    = state.currentUser && u.id === state.currentUser.id;
    const roleClass = `role-${u.role}`;
    const roleBadgeClass = `role-badge-${u.role === 'admin' ? 'admin' : u.role === 'manager' ? 'manager' : 'staff'}`;
    const canDelete = !isMe && state.currentUser && state.currentUser.role !== 'staff';

    return `
      <div class="manager-user-card">
        <div class="manager-user-avatar ${roleClass}">${escHtml(initial)}</div>
        <div class="manager-user-info">
          <div class="manager-user-name">${escHtml(u.name || u.username)}${isMe ? ' <span style="font-size:10px;color:var(--accent)">(вы)</span>' : ''}</div>
          <div class="manager-user-meta">
            <span>@${escHtml(u.username)}</span>
            <span class="manager-user-role ${roleBadgeClass}">${escHtml(ROLE_LABELS[u.role] || u.role)}</span>
          </div>
        </div>
        ${canDelete ? `
          <button class="manager-user-delete" data-uid="${escHtml(u.id)}" title="Удалить">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>` : ''}
      </div>`;
  }).join('');

  // Слушатели удаления
  list.querySelectorAll('.manager-user-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const uid = btn.dataset.uid;
      const user = state.users.find(u => u.id === uid);
      state.pendingDeleteUserId = uid;
      $('confirmUserText').textContent = `Удалить аккаунт "${user ? (user.name || user.username) : ''}"? Это нельзя отменить.`;
      openOverlay($('confirmUserModal'));
    });
  });
}

function renderManagerLogs() {
  const list = $('managerLogsList');
  if (!list) return;

  if (!state.logs.length) {
    list.innerHTML = '<div class="log-empty">📭 Журнал пуст</div>';
    return;
  }

  list.innerHTML = state.logs.slice(0, 100).map(log => {
    const info = LOG_TYPES[log.type] || { icon: '📌', label: log.type };
    const cssClass = `log-${log.type === 'add' ? 'add' : log.type === 'edit' ? 'edit' : log.type === 'delete' || log.type === 'delUser' ? 'delete' : log.type === 'login' ? 'login' : log.type === 'logout' ? 'logout' : 'register'}`;
    return `
      <div class="log-entry">
        <div class="log-entry__header">
          <div class="log-entry__icon ${cssClass}">${info.icon}</div>
          <span class="log-entry__user">${escHtml(log.userName || 'Неизвестно')}</span>
          <span class="log-entry__time">${formatDateTime(log.ts)}</span>
        </div>
        <div class="log-entry__action">${escHtml(info.label)}${log.details ? ': ' + escHtml(log.details) : ''}</div>
      </div>`;
  }).join('');
}

/* ================================================
   TOAST
================================================ */
let toastTimer = null;
function showToast(message, type = 'default') {
  clearTimeout(toastTimer);
  const el = $('toast');
  el.textContent = message;
  el.className   = `toast ${type} show`;
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ================================================
   FILTERING & SORTING (умный фильтр)
================================================ */
function parseSmartQuery(raw) {
  // Возвращает { textPart, qtyOp, qtyValue, stockHint }
  // qtyOp: 'lte' | 'gte' | 'eq' | null
  // stockHint: 'low' | 'out' | 'ok' | null
  const q = raw.toLowerCase().trim();
  if (!q) return { textPart: '', qtyOp: null, qtyValue: null, stockHint: null };

  let textPart  = q;
  let qtyOp     = null;
  let qtyValue  = null;
  let stockHint = null;

  // Ключевые слова статуса
  if (/\b(мало|малые|маленьк|низк|кончает|заканчив)/.test(q)) stockHint = 'low';
  if (/\b(нет|нету|закончил|закончились|0\s*шт|пуст)/.test(q)) stockHint = 'out';
  if (/\b(в\s*наличии|много|достаточно)/.test(q))             stockHint = 'ok';

  // Числовые запросы: "5 шт", "<= 3", "меньше 10", "до 5"
  const lessMatch  = q.match(/(?:меньше|менее|до|<=|<)\s*(\d+)/);
  const moreMatch  = q.match(/(?:больше|более|от|>=|>)\s*(\d+)/);
  const exactMatch = q.match(/(\d+)\s*(?:шт|штук|штука|единиц|ед)\b/);
  const justNumber = !lessMatch && !moreMatch && !exactMatch && q.match(/^(\d+)$/);

  if (lessMatch) {
    qtyOp = 'lte';
    qtyValue = parseInt(lessMatch[1]);
  } else if (moreMatch) {
    qtyOp = 'gte';
    qtyValue = parseInt(moreMatch[1]);
  } else if (exactMatch) {
    qtyOp = 'eq';
    qtyValue = parseInt(exactMatch[1]);
  } else if (justNumber) {
    qtyOp = 'eq';
    qtyValue = parseInt(justNumber[1]);
  }

  // Очищаем текстовую часть от служебных слов и чисел, оставляем только название
  textPart = q
    .replace(/\b(мало|малые|маленьк\w*|низк\w*|кончает\w*|заканчив\w*)\b/g, '')
    .replace(/\b(нет|нету|закончил\w*|пуст\w*)\b/g, '')
    .replace(/\b(в\s*наличии|много|достаточно)\b/g, '')
    .replace(/(?:меньше|менее|до|больше|более|от|<=|<|>=|>)\s*\d+/g, '')
    .replace(/\d+\s*(?:шт|штук\w*|единиц|ед)\b/g, '')
    .replace(/^\d+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { textPart, qtyOp, qtyValue, stockHint };
}

function matchesQty(qty, op, value) {
  if (op === null || value === null) return true;
  if (op === 'lte') return qty <= value;
  if (op === 'gte') return qty >= value;
  if (op === 'eq')  return qty === value;
  return true;
}

function getFilteredProducts() {
  let list = [...state.products];

  // Парсим умный запрос
  const parsed = parseSmartQuery(state.searchQuery);

  // Текстовый фильтр (по очищенной части запроса)
  if (parsed.textPart) {
    list = list.filter(p =>
      p.name.toLowerCase().includes(parsed.textPart) ||
      (p.description || '').toLowerCase().includes(parsed.textPart) ||
      (CATEGORY_LABELS[p.category] || '').toLowerCase().includes(parsed.textPart)
    );
  }

  // Числовой фильтр из текста ("5 шт", "меньше 10")
  if (parsed.qtyOp && parsed.qtyValue !== null) {
    list = list.filter(p => matchesQty(getQty(p, state.activeBranch), parsed.qtyOp, parsed.qtyValue));
  }

  // Подсказка по статусу из текста ("мало", "нет")
  if (parsed.stockHint) {
    list = list.filter(p => getStockStatus(getQty(p, state.activeBranch)) === parsed.stockHint);
  }

  // Категория
  if (state.categoryFilter !== 'all') list = list.filter(p => p.category === state.categoryFilter);

  // Быстрый фильтр по статусу запасов
  if (state.stockFilter !== 'all') {
    list = list.filter(p => getStockStatus(getQty(p, state.activeBranch)) === state.stockFilter);
  }

  // Сортировка
  switch (state.sortMode) {
    case 'smart':
      // Умная: out → low → ok, внутри по количеству возрастанию
      list.sort((a, b) => {
        const qa = getQty(a, state.activeBranch);
        const qb = getQty(b, state.activeBranch);
        const priority = (q) => q === 0 ? 0 : q <= 5 ? 1 : 2;
        const pa = priority(qa), pb = priority(qb);
        if (pa !== pb) return pa - pb;
        return qa - qb;
      });
      break;
    case 'name':     list.sort((a, b) => a.name.localeCompare(b.name, 'ru')); break;
    case 'qty-asc':  list.sort((a, b) => getQty(a, state.activeBranch) - getQty(b, state.activeBranch)); break;
    case 'qty-desc': list.sort((a, b) => getQty(b, state.activeBranch) - getQty(a, state.activeBranch)); break;
  }

  return list;
}

function updateStockCounts() {
  // Подсчёт количества товаров каждого статуса (с учётом только категории и филиала)
  let base = [...state.products];
  if (state.categoryFilter !== 'all') {
    base = base.filter(p => p.category === state.categoryFilter);
  }
  let low = 0, out = 0, ok = 0;
  base.forEach(p => {
    const s = getStockStatus(getQty(p, state.activeBranch));
    if (s === 'low') low++;
    else if (s === 'out') out++;
    else ok++;
  });
  const elLow = $('countLow'), elOut = $('countOut'), elOk = $('countOk');
  if (elLow) elLow.textContent = low;
  if (elOut) elOut.textContent = out;
  if (elOk)  elOk.textContent  = ok;
}

/* ================================================
   RENDER
================================================ */
function renderAll() {
  updateStockCounts();
  if (typeof updateBranchModalStats === 'function') updateBranchModalStats();
  const list = getFilteredProducts();
  $('statsText').textContent = `Товаров: ${list.length}`;

  if (list.length === 0) {
    $('productsGrid').innerHTML = '';
    $('emptyState').style.display = 'flex';
    return;
  }

  $('emptyState').style.display = 'none';
  $('productsGrid').innerHTML = list.map((p, i) => buildCard(p, i)).join('');

  $('productsGrid').querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => openViewModal(card.dataset.id));
  });
}

function buildCard(product, index) {
  const qty    = getQty(product, state.activeBranch);
  const status = getStockStatus(qty);
  const badge  = STOCK_BADGE[status];
  const delay  = Math.min(index * 40, 400);

  // Класс мигания для малых запасов / отсутствия
  const blinkClass = status === 'out' ? 'product-card--out' : status === 'low' ? 'product-card--low' : '';

  const imageHtml = product.photo
    ? `<img class="product-card__image" src="${product.photo}" alt="${escHtml(product.name)}" loading="lazy" />`
    : `<div class="product-card__no-image">
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="8" width="40" height="32" rx="5" stroke="currentColor" stroke-width="2"/>
          <circle cx="24" cy="24" r="7" stroke="currentColor" stroke-width="2"/>
          <circle cx="24" cy="24" r="2.5" fill="currentColor"/>
          <path d="M16 8l3-5h10l3 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Нет фото
      </div>`;

  const branchesHtml = BRANCH_KEYS.map(k => {
    const bqty = product.branches[k] ?? 0;
    const bstyle = bqty === 0 ? 'branch-row__qty--out' : bqty <= 3 ? 'branch-row__qty--low' : '';
    if (state.activeBranch !== 'all' && state.activeBranch !== k) return '';
    return `
      <div class="branch-row">
        <span class="branch-row__label">${BRANCH_LABELS[k]}</span>
        <span class="branch-row__qty ${bstyle}">${bqty} ${escHtml(product.unit)}</span>
      </div>`;
  }).join('');

  return `
    <div class="product-card ${blinkClass}" data-id="${product.id}" style="animation-delay:${delay}ms">
      <div class="product-card__image-wrap">
        ${imageHtml}
        <div class="product-card__badge ${badge.cls}">${badge.label}</div>
      </div>
      <div class="product-card__body">
        <div class="product-card__category">${escHtml(CATEGORY_LABELS[product.category] || product.category)}</div>
        <div class="product-card__name">${escHtml(product.name)}</div>
        <div class="product-card__branches">${branchesHtml}</div>
        <div class="product-card__footer">
          <span class="product-card__total-label">Итого</span>
          <span class="product-card__total-value">${getQty(product)} ${escHtml(product.unit)}</span>
        </div>
      </div>
    </div>`;
}

/* ================================================
   VIEW MODAL
================================================ */
function openViewModal(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  state.currentViewId = productId;

  const totalQty = getQty(product);
  const status   = getStockStatus(state.activeBranch === 'all' ? totalQty : getQty(product, state.activeBranch));
  const badge    = STOCK_BADGE[status];

  if (product.photo) {
    $('viewImg').src           = product.photo;
    $('viewImg').style.display = 'block';
  } else {
    $('viewImg').src           = '';
    $('viewImg').style.display = 'none';
  }

  $('viewBadge').textContent    = badge.label;
  $('viewBadge').className      = `modal__badge ${badge.cls}`;
  $('viewCategory').textContent = CATEGORY_LABELS[product.category] || product.category;
  $('viewTitle').textContent    = product.name;
  $('viewDesc').textContent     = product.description || 'Описание не указано';
  $('viewTotal').textContent    = `${totalQty} ${product.unit}`;

  $('viewBranches').innerHTML = BRANCH_KEYS.map(k => {
    const q      = product.branches[k] ?? 0;
    const qstyle = q === 0 ? 'color:var(--danger)' : q <= 3 ? 'color:var(--warning)' : '';
    return `
      <div class="modal-branch-row">
        <span class="modal-branch-row__name">${BRANCH_LABELS[k]}</span>
        <span class="modal-branch-row__qty" style="${qstyle}">${q} ${escHtml(product.unit)}</span>
      </div>`;
  }).join('');

  openOverlay($('viewModal'));
}

function closeViewModal() {
  closeOverlay($('viewModal'));
  state.currentViewId = null;
}

/* ================================================
   EDIT MODAL
================================================ */
function openEditModal(productId) {
  state.editingProductId = productId || null;
  $('editModalTitle').textContent = productId ? 'Редактировать товар' : 'Добавить товар';

  state.photoDataUrl                    = null;
  $('photoPreview').style.display       = 'none';
  $('photoPlaceholder').style.display   = 'flex';
  $('photoRemoveBtn').style.display     = 'none';
  $('photoInput').value                 = '';

  if (productId) {
    const p = state.products.find(pr => pr.id === productId);
    if (!p) return;
    $('editName').value     = p.name;
    $('editCategory').value = p.category;
    $('editUnit').value     = p.unit;
    $('editDesc').value     = p.description || '';
    $('qty1').value         = p.branches.branch1 ?? 0;
    $('qty2').value         = p.branches.branch2 ?? 0;
    $('qty3').value         = p.branches.branch3 ?? 0;

    if (p.photo) {
      state.photoDataUrl                  = p.photo;
      $('photoPreview').src               = p.photo;
      $('photoPreview').style.display     = 'block';
      $('photoPlaceholder').style.display = 'none';
      $('photoRemoveBtn').style.display   = 'block';
    }
  } else {
    $('editName').value     = '';
    $('editCategory').value = 'drinks';
    $('editUnit').value     = 'шт';
    $('editDesc').value     = '';
    $('qty1').value = $('qty2').value = $('qty3').value = '0';
  }

  openOverlay($('editModal'));
  setTimeout(() => $('editName').focus(), 300);
}

async function saveProduct() {
  const name = $('editName').value.trim();
  if (!name) {
    $('editName').style.borderColor = 'var(--danger)';
    $('editName').focus();
    showToast('Введите название товара', 'error');
    return;
  }
  $('editName').style.borderColor = '';

  const isEdit = !!state.editingProductId;

  const product = {
    id:          state.editingProductId || uid(),
    name,
    category:    $('editCategory').value,
    unit:        $('editUnit').value,
    description: $('editDesc').value.trim(),
    photo:       state.photoDataUrl,
    branches: {
      branch1: Math.max(0, parseInt($('qty1').value) || 0),
      branch2: Math.max(0, parseInt($('qty2').value) || 0),
      branch3: Math.max(0, parseInt($('qty3').value) || 0),
    },
  };

  if (isEdit) {
    const idx = state.products.findIndex(p => p.id === state.editingProductId);
    if (idx > -1) state.products[idx] = product;
    showToast('✓ Товар обновлён', 'success');
    await writeLog('edit', `Товар: "${name}"`);
  } else {
    state.products.unshift(product);
    showToast('✓ Товар добавлен', 'success');
    await writeLog('add', `Товар: "${name}"`);
  }

  saveLocal(STORAGE_KEY, state.products);
  renderAll();
  closeOverlay($('editModal'));
  await fbSaveProduct(product);
}

/* ================================================
   DELETE / CONFIRM
================================================ */
function openConfirmModal(productId) {
  const p = state.products.find(pr => pr.id === productId);
  if (!p) return;
  $('confirmText').textContent = `Удалить "${p.name}"? Это действие нельзя отменить.`;
  state.pendingDeleteId = productId;
  openOverlay($('confirmModal'));
}

async function deleteProduct(productId) {
  const idx = state.products.findIndex(p => p.id === productId);
  if (idx > -1) {
    const name = state.products[idx].name;
    state.products.splice(idx, 1);
    saveLocal(STORAGE_KEY, state.products);
    renderAll();
    showToast(`✓ "${name}" удалён`, 'success');
    await writeLog('delete', `Товар: "${name}"`);
    await fbDeleteProduct(productId);
  }
}

/* ================================================
   MODAL HELPERS
================================================ */
function openOverlay(overlay) {
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeOverlay(overlay) {
  overlay.classList.remove('active');
  const anyOpen = !!document.querySelector('.modal-overlay.active');
  if (!anyOpen) document.body.style.overflow = '';
}

/* ================================================
   PHOTO UPLOAD
================================================ */
function initPhotoUpload() {
  const area = $('photoUploadArea');
  if (!area) return;

  area.addEventListener('click', e => {
    if (e.target === $('photoRemoveBtn')) return;
    $('photoInput').click();
  });

  $('photoInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      state.photoDataUrl                  = ev.target.result;
      $('photoPreview').src               = ev.target.result;
      $('photoPreview').style.display     = 'block';
      $('photoPlaceholder').style.display = 'none';
      $('photoRemoveBtn').style.display   = 'block';
    };
    reader.readAsDataURL(file);
  });

  $('photoRemoveBtn').addEventListener('click', e => {
    e.stopPropagation();
    state.photoDataUrl                  = null;
    $('photoPreview').src               = '';
    $('photoPreview').style.display     = 'none';
    $('photoPlaceholder').style.display = 'flex';
    $('photoRemoveBtn').style.display   = 'none';
    $('photoInput').value               = '';
  });
}

/* ================================================
   QTY STEPPERS
================================================ */
function initSteppers() {
  document.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = $(btn.dataset.target);
      if (!input) return;
      let val = parseInt(input.value) || 0;
      if (btn.dataset.action === 'plus')  val++;
      if (btn.dataset.action === 'minus') val = Math.max(0, val - 1);
      input.value = val;
    });
  });
}

/* ================================================
   PRINT
================================================ */
function preparePrint() {
  const list = getFilteredProducts();
  const now  = new Date();
  const dateStr = now.toLocaleDateString('ru-RU', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const isAll = state.activeBranch === 'all';
  const branchLabel = isAll ? 'Все филиалы' : BRANCH_LABELS[state.activeBranch];

  $('printBranchLabel').textContent = branchLabel;
  $('printTitle').textContent       = `Отчёт по остаткам — ${branchLabel}`;
  $('printDate').textContent        = dateStr;
  $('printFooterDate').textContent  = dateStr;

  const thead = $('printTableHead');
  if (isAll) {
    thead.innerHTML = `
      <th style="width:60px">Фото</th><th>Товар</th><th>Категория</th>
      ${BRANCH_KEYS.map(k => `<th style="text-align:center">${BRANCH_LABELS[k]}</th>`).join('')}
      <th>Итого</th>`;
  } else {
    thead.innerHTML = `<th style="width:60px">Фото</th><th>Товар</th><th>Категория</th><th style="text-align:center">Количество</th>`;
  }

  $('printTableBody').innerHTML = list.map(p => {
    const imgHtml = p.photo
      ? `<img src="${p.photo}" alt="${escHtml(p.name)}" />`
      : `<div class="print-img-placeholder">—</div>`;
    let dataCells = '';
    if (isAll) {
      const cells = BRANCH_KEYS.map(k => {
        const q = p.branches[k] ?? 0;
        return `<td style="text-align:center;${q === 0 ? 'color:#ccc' : ''}">${q}</td>`;
      }).join('');
      dataCells = `${cells}<td class="print-td-total">${getQty(p)} ${escHtml(p.unit)}</td>`;
    } else {
      const q = p.branches[state.activeBranch] ?? 0;
      dataCells = `<td class="print-td-total" style="text-align:center;${q === 0 ? 'color:#ccc' : ''}">${q} ${escHtml(p.unit)}</td>`;
    }
    return `
      <tr>
        <td>${imgHtml}</td>
        <td>
          <div class="print-td-name">${escHtml(p.name)}</div>
          <div style="font-size:11px;color:#888;margin-top:2px">${escHtml(p.description || '')}</div>
        </td>
        <td>${escHtml(CATEGORY_LABELS[p.category] || p.category)}</td>
        ${dataCells}
      </tr>`;
  }).join('');

  $('printArea').style.display = 'block';
  setTimeout(() => {
    window.print();
    $('printArea').style.display = 'none';
  }, 200);
}

/* ================================================
   BRANCH NAV
================================================ */
function initBranchNav() {
  const branches = $('branches');
  if (!branches) return;
  branches.querySelectorAll('.branch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      branches.querySelectorAll('.branch-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeBranch = btn.dataset.branch;
      updateBranchIndicator();
      renderAll();
    });
  });
}

/* ================================================
   SEARCH & FILTER
================================================ */
function initFilters() {
  let timer;
  const searchEl   = $('searchInput');
  const catEl      = $('categoryFilter');
  const sortEl     = $('sortFilter');
  if (!searchEl) return;

  searchEl.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.searchQuery = searchEl.value; renderAll(); }, 220);
  });
  catEl.addEventListener('change',  () => { state.categoryFilter = catEl.value; renderAll(); });
  sortEl.addEventListener('change', () => { state.sortMode = sortEl.value; renderAll(); });

  // Быстрые фильтры (чипы)
  const quick = $('quickFilters');
  if (quick) {
    quick.querySelectorAll('.quick-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        quick.querySelectorAll('.quick-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.stockFilter = chip.dataset.stock;
        renderAll();
      });
    });
  }
}

/* ================================================
   PRODUCT EVENT LISTENERS
================================================ */
function initProductEventListeners() {
  $('addProductBtn').addEventListener('click', () => openEditModal(null));
  $('printBtn').addEventListener('click', preparePrint);

  // View modal
  $('viewModalClose').addEventListener('click', closeViewModal);
  $('viewModal').addEventListener('click', e => { if (e.target === $('viewModal')) closeViewModal(); });
  $('viewEditBtn').addEventListener('click', () => {
    const id = state.currentViewId;
    closeViewModal();
    openEditModal(id);
  });
  $('viewDeleteBtn').addEventListener('click', () => {
    const id = state.currentViewId;
    closeViewModal();
    openConfirmModal(id);
  });

  // Edit modal
  $('editModalClose').addEventListener('click', () => closeOverlay($('editModal')));
  $('editCancelBtn').addEventListener('click',  () => closeOverlay($('editModal')));
  $('editModal').addEventListener('click', e => { if (e.target === $('editModal')) closeOverlay($('editModal')); });
  $('editSaveBtn').addEventListener('click', saveProduct);

  // Confirm delete product
  $('confirmCancelBtn').addEventListener('click', () => {
    closeOverlay($('confirmModal'));
    state.pendingDeleteId = null;
  });
  $('confirmModal').addEventListener('click', e => {
    if (e.target === $('confirmModal')) { closeOverlay($('confirmModal')); state.pendingDeleteId = null; }
  });
  $('confirmDeleteBtn').addEventListener('click', () => {
    closeOverlay($('confirmModal'));
    if (state.pendingDeleteId) {
      deleteProduct(state.pendingDeleteId);
      state.pendingDeleteId = null;
    }
  });

  // ESC
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const openModals = document.querySelectorAll('.modal-overlay.active');
    if (openModals.length) {
      const last = openModals[openModals.length - 1];
      last.classList.remove('active');
      if (!document.querySelector('.modal-overlay.active')) document.body.style.overflow = '';
    }
  });
}

/* ================================================
   INIT
================================================ */
function init() {
  initAuth();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
