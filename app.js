/**
 * ============================================================
 *  СКЛАД MONE — Управление остатками по филиалам
 *  app.js — ролевой доступ, без поиска и категорий
 * ============================================================
 *
 *  АРХИТЕКТУРА АККАУНТОВ
 *  ─────────────────────
 *  • 1 менеджер  — видит и может всё
 *  • 3 филиала   — каждый видит свои товары, меняет фото и кол-во
 *
 *  Клик на карточку → сразу открывается форма редактирования.
 *  Сотрудник видит кнопку «+» → открывает фото (камера/галерея).
 */

'use strict';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getDatabase,
  ref,
  onValue,
  set,
  update,
  remove,
  get,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

/* ===========================================================
   FIREBASE
=========================================================== */
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
const ACCOUNTS_REF = ref(db, 'accounts');
const LOGS_REF     = ref(db, 'logs');

/* ===========================================================
   КОНСТАНТЫ
=========================================================== */
const STORAGE_KEY    = 'mone_products_v2';
const SESSION_KEY    = 'mone_session_v2';
const ACCOUNTS_CACHE = 'mone_accounts_v2';
const LOGS_CACHE     = 'mone_logs_v2';

const CATEGORY_LABELS = {
  drinks:     'Напитки',
  disposable: 'Одноразовая посуда',
  food:       'Продукты',
  cleaning:   'Чистящие средства',
  other:      'Прочее',
};

const BRANCH_LABELS = { branch1: 'Сибирский', branch2: 'Фреско', branch3: 'Гелион' };
const BRANCH_KEYS   = ['branch1', 'branch2', 'branch3'];
const ROLE_LABELS   = { manager: 'Менеджер', staff: 'Сотрудник филиала' };

const LOG_TYPES = {
  login:    { icon: '🔑', label: 'Вход в систему' },
  logout:   { icon: '🚪', label: 'Выход из системы' },
  add:      { icon: '➕', label: 'Добавление товара' },
  edit:     { icon: '✏️', label: 'Редактирование товара' },
  delete:   { icon: '🗑️', label: 'Удаление товара' },
  qtyEdit:  { icon: '🔢', label: 'Изменение количества' },
  photoEdit:{ icon: '📷', label: 'Изменение фото' },
  userEdit: { icon: '👤', label: 'Изменение аккаунта' },
};

let renderToken = 0;

/* ===========================================================
   ДЕФОЛТНЫЕ АККАУНТЫ
=========================================================== */
function getDefaultAccounts() {
  return [
    {
      id:             'acc_manager',
      role:           'manager',
      branch:         null,
      name:           'Менеджер',
      username:       'manager',
      passwordHash:   hashPassword('Mone-Manager-2025'),
      sessionVersion: 1,
      createdAt:      Date.now(),
    },
    {
      id:             'acc_branch1',
      role:           'staff',
      branch:         'branch1',
      name:           'Сибирский',
      username:       'sibirsky',
      passwordHash:   hashPassword('Sibirsky-2025'),
      sessionVersion: 1,
      createdAt:      Date.now(),
    },
    {
      id:             'acc_branch2',
      role:           'staff',
      branch:         'branch2',
      name:           'Фреско',
      username:       'fresco',
      passwordHash:   hashPassword('Fresco-2025'),
      sessionVersion: 1,
      createdAt:      Date.now(),
    },
    {
      id:             'acc_branch3',
      role:           'staff',
      branch:         'branch3',
      name:           'Гелион',
      username:       'gelion',
      passwordHash:   hashPassword('Gelion-2025'),
      sessionVersion: 1,
      createdAt:      Date.now(),
    },
  ];
}

function getDefaultProducts() {
  return [
    { id: uid(), name: 'Pepsi 0.5л',                category: 'drinks',     description: 'Газированный напиток Pepsi, бутылка 0.5 литра', photo: null, branches: { branch1: 24, branch2: 8,  branch3: 3  } },
    { id: uid(), name: 'Coca-Cola 1л',              category: 'drinks',     description: 'Классическая Кока-Кола, бутылка 1 литр',         photo: null, branches: { branch1: 12, branch2: 20, branch3: 15 } },
    { id: uid(), name: 'Пластиковые стаканы 250мл', category: 'disposable', description: 'Одноразовые стаканы',                              photo: null, branches: { branch1: 5,  branch2: 2,  branch3: 0  } },
    { id: uid(), name: 'Трубочки для коктейлей',    category: 'disposable', description: 'Пластиковые трубочки',                             photo: null, branches: { branch1: 3,  branch2: 0,  branch3: 1  } },
    { id: uid(), name: 'Сахар',                     category: 'food',       description: 'Сахар-песок',                                      photo: null, branches: { branch1: 10, branch2: 6,  branch3: 4  } },
    { id: uid(), name: 'Fairy 500мл',               category: 'cleaning',   description: 'Средство для мытья посуды Fairy',                  photo: null, branches: { branch1: 4,  branch2: 4,  branch3: 2  } },
  ];
}

/* ===========================================================
   STATE
=========================================================== */
const state = {
  products:         [],
  accounts:         [],
  logs:             [],
  activeBranch:     'all',
  stockFilter:      'all',
  sortMode:         'smart',
  pendingDeleteId:  null,
  editingProductId: null,
  editingUserId:    null,
  photoDataUrl:     null,
  firebaseLoaded:   false,
  currentUser:      null,
  validatedSession: false,
};

/* ===========================================================
   УТИЛИТЫ
=========================================================== */
const $   = id => document.getElementById(id);
const uid = () => `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDateTime(ts) {
  return new Date(ts).toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function hashPassword(pass) {
  let h = 0;
  for (let i = 0; i < pass.length; i++) {
    h = Math.imul(31, h) + pass.charCodeAt(i) | 0;
  }
  const salted = pass + '|mone-salt-2025|' + h.toString(36);
  let h2 = 0;
  for (let i = 0; i < salted.length; i++) {
    h2 = Math.imul(31, h2) + salted.charCodeAt(i) | 0;
  }
  return Math.abs(h).toString(16) + '_' + Math.abs(h2).toString(16);
}

/* ===========================================================
   STORAGE
=========================================================== */
function saveLocal(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch (_) {}
}
function loadLocal(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

function saveSession(session) { saveLocal(SESSION_KEY, session); }
function loadSession()        { return loadLocal(SESSION_KEY); }
function clearSession()       { localStorage.removeItem(SESSION_KEY); }

/* ===========================================================
   ПРАВА ДОСТУПА
=========================================================== */
function isManager()  { return !!state.currentUser && state.currentUser.role === 'manager'; }
function isStaff()    { return !!state.currentUser && state.currentUser.role === 'staff';   }
function userBranch() { return state.currentUser ? state.currentUser.branch : null;          }

function canSeeProduct(product) {
  if (isManager()) return true;
  const b = userBranch();
  if (!b) return false;
  return true; // сотрудник видит все позиции своего склада
}

function getQty(product, branch = 'all') {
  if (branch === 'all') return BRANCH_KEYS.reduce((s, k) => s + (product.branches?.[k] ?? 0), 0);
  return product.branches?.[branch] ?? 0;
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

/* ===========================================================
   FIREBASE INIT
=========================================================== */
function bootstrapAccountsIfMissing() {
  return get(ACCOUNTS_REF).then(snap => {
    if (snap.exists() && snap.val() && Object.keys(snap.val()).length >= 4) return;
    const defaults = getDefaultAccounts();
    const updates = {};
    defaults.forEach(a => { updates[a.id] = a; });
    return set(ACCOUNTS_REF, updates);
  });
}

function bootstrapProductsIfMissing() {
  return get(PRODUCTS_REF).then(snap => {
    if (snap.exists() && snap.val()) return;
    const defaults = getDefaultProducts();
    const updates = {};
    defaults.forEach(p => { updates[p.id] = p; });
    return set(PRODUCTS_REF, updates);
  });
}

function initFirebaseListeners() {
  showSyncIndicator('connecting');

  onValue(PRODUCTS_REF, (snap) => {
    const data = snap.val();
    state.products = data ? Object.values(data) : [];
    saveLocal(STORAGE_KEY, state.products);
    state.firebaseLoaded = true;
    renderAll();
    showSyncIndicator('ok');
  }, (err) => {
    console.error('[products]', err);
    if (!state.firebaseLoaded) {
      state.products = loadLocal(STORAGE_KEY) || [];
      state.firebaseLoaded = true;
      renderAll();
    }
    showSyncIndicator('error');
    showToast('⚠ Нет связи — работаем офлайн', 'error');
  });

  onValue(ACCOUNTS_REF, (snap) => {
    const data = snap.val();
    state.accounts = data ? Object.values(data) : [];
    saveLocal(ACCOUNTS_CACHE, state.accounts);
    revalidateCurrentSession();
    if (isManager()) renderManagerUsers();
  }, (err) => {
    console.error('[accounts]', err);
    state.accounts = loadLocal(ACCOUNTS_CACHE) || [];
    if (isManager()) renderManagerUsers();
  });

  if (isManager()) {
    onValue(LOGS_REF, (snap) => {
      const data = snap.val();
      state.logs = data ? Object.values(data).sort((a, b) => b.ts - a.ts) : [];
      saveLocal(LOGS_CACHE, state.logs);
      renderManagerLogs();
    }, () => {
      state.logs = loadLocal(LOGS_CACHE) || [];
      renderManagerLogs();
    });
  }
}

function revalidateCurrentSession() {
  if (!state.currentUser) return;
  const me = state.accounts.find(a => a.id === state.currentUser.id);

  if (!me) {
    forceLogout('Ваш аккаунт был удалён. Обратитесь к менеджеру.');
    return;
  }

  if (me.sessionVersion !== state.currentUser.sessionVersion) {
    forceLogout('Данные вашего аккаунта изменены менеджером. Войдите заново.');
    return;
  }

  const merged = { ...state.currentUser, name: me.name, username: me.username };
  state.currentUser = merged;
  saveSession(merged);
  updateUserChip();
  updateDrawerProfile();
  state.validatedSession = true;
}

function forceLogout(message) {
  clearSession();
  state.currentUser = null;
  ['mainHeader', 'mainToolbar', 'mainContent'].forEach(id => {
    const el = $(id); if (el) el.style.display = 'none';
  });
  const fab = $('fabAddBtn'); if (fab) fab.style.display = 'none';
  document.querySelectorAll('.modal-overlay.active').forEach(o => o.classList.remove('active'));
  const drawer = $('drawerOverlay'); if (drawer) drawer.classList.remove('active');
  const mgr = $('managerOverlay'); if (mgr) { mgr.classList.remove('active'); mgr.style.display = 'none'; }
  document.body.style.overflow = '';
  $('authOverlay').style.display = 'flex';
  $('loginUsername').value = '';
  $('loginPassword').value = '';
  $('loginError').textContent = message || '';
}

/* ===========================================================
   FIREBASE WRITE
=========================================================== */
async function fbSaveProduct(product) {
  try { await set(ref(db, `products/${product.id}`), product); }
  catch (e) { console.error('Save product error:', e); showToast('⚠ Ошибка синхронизации', 'error'); }
}
async function fbDeleteProduct(id) {
  try { await remove(ref(db, `products/${id}`)); }
  catch (e) { console.error('Delete product error:', e); showToast('⚠ Ошибка удаления', 'error'); }
}
async function fbUpdateAccount(id, patch) {
  try { await update(ref(db, `accounts/${id}`), patch); }
  catch (e) { console.error('Update account error:', e); showToast('⚠ Ошибка сохранения', 'error'); }
}
async function fbClearLogs() {
  try { await remove(LOGS_REF); }
  catch (e) { console.error('Clear logs error:', e); }
}

async function writeLog(type, details = '') {
  if (!state.currentUser) return;
  const entry = {
    id:       uid(),
    type,
    userId:   state.currentUser.id,
    userName: state.currentUser.name || state.currentUser.username,
    role:     state.currentUser.role,
    branch:   state.currentUser.branch || null,
    details,
    ts:       Date.now(),
  };
  try {
    await set(ref(db, `logs/${entry.id}`), entry);
  } catch (_) {
    state.logs.unshift(entry);
    saveLocal(LOGS_CACHE, state.logs);
  }
}

/* ===========================================================
   SYNC INDICATOR
=========================================================== */
function showSyncIndicator(status) {
  const el = $('syncIndicator');
  const map = {
    connecting: { text: '⏳ Подключение...',  cls: 'sync--connecting' },
    ok:         { text: '☁ Синхронизировано', cls: 'sync--ok'         },
    error:      { text: '⚠ Офлайн',           cls: 'sync--error'      },
  };
  const s = map[status] || map.ok;
  if (el) { el.textContent = s.text; el.className = `sync-indicator ${s.cls}`; }
  updateDrawerSync(status);
}

function updateDrawerSync(status) {
  const dot = $('drawerSyncDot');
  const txt = $('drawerSyncText');
  if (!dot || !txt) return;
  const map = {
    connecting: { text: 'Подключение...',   cls: 'connecting' },
    ok:         { text: 'Синхронизировано', cls: '' },
    error:      { text: 'Офлайн режим',     cls: 'error' },
  };
  const s = map[status] || map.ok;
  dot.className = 'drawer-sync__dot ' + s.cls;
  txt.textContent = s.text;
}

/* ===========================================================
   AUTH
=========================================================== */
function initAuth() {
  $('loginEye').addEventListener('click', () => {
    const inp = $('loginPassword');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  $('loginSubmitBtn').addEventListener('click', handleLogin);
  $('loginPassword').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
  $('loginUsername').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('loginPassword').focus();
  });

  const session = loadSession();
  if (session && session.id) {
    state.currentUser = session;
    enterApp(true);
    return;
  }

  $('authOverlay').style.display = 'flex';
  setTimeout(() => $('loginUsername').focus(), 200);

  bootstrapAccountsIfMissing().catch(() => {});
  bootstrapProductsIfMissing().catch(() => {});
}

async function handleLogin() {
  const username = $('loginUsername').value.trim();
  const password = $('loginPassword').value;
  const errEl    = $('loginError');

  if (!username || !password) {
    showLoginError('Заполните логин и пароль');
    return;
  }

  let accounts = [];
  try {
    await bootstrapAccountsIfMissing();
    const snap = await get(ACCOUNTS_REF);
    accounts = snap.val() ? Object.values(snap.val()) : [];
  } catch (_) {
    accounts = loadLocal(ACCOUNTS_CACHE) || [];
  }

  if (!accounts.length) accounts = getDefaultAccounts();

  const hashed = hashPassword(password);
  const acc = accounts.find(a =>
    a.username.toLowerCase() === username.toLowerCase() &&
    a.passwordHash === hashed
  );

  if (!acc) {
    showLoginError('Неверный логин или пароль');
    return;
  }

  state.currentUser = {
    id:             acc.id,
    role:           acc.role,
    branch:         acc.branch,
    name:           acc.name,
    username:       acc.username,
    sessionVersion: acc.sessionVersion || 1,
  };
  saveSession(state.currentUser);
  errEl.textContent = '';
  enterApp(false);
  await writeLog('login', `${ROLE_LABELS[acc.role]}: ${acc.username}`);
  showToast(`👋 Добро пожаловать, ${acc.name}!`, 'success');
}

function showLoginError(message) {
  const errEl = $('loginError');
  errEl.textContent = message;
  errEl.style.animation = 'none';
  requestAnimationFrame(() => { errEl.style.animation = 'shake 0.3s ease'; });
}

function enterApp() {
  $('authOverlay').style.display = 'none';
  ['mainHeader', 'mainToolbar', 'mainContent'].forEach(id => {
    const el = $(id); if (el) el.style.display = '';
  });

  if (isStaff()) {
    state.activeBranch = userBranch();
  } else {
    state.activeBranch = 'all';
  }

  applyRoleVisibility();
  updateUserChip();

  if (!enterApp._initialized) {
    initBranchNav();
    initFilters();
    initFilterModal();
    initPhotoUpload();
    initSteppers();
    initProductEvents();
    initManagerPanel();
    initUserChip();
    initMobileUI();
    enterApp._initialized = true;
  }

  initFirebaseListeners();
  updateDrawerProfile();
  updateBranchIndicator();
}

async function handleLogout() {
  await writeLog('logout', '');
  clearSession();
  state.currentUser = null;
  ['mainHeader', 'mainToolbar', 'mainContent'].forEach(id => {
    const el = $(id); if (el) el.style.display = 'none';
  });
  const fab = $('fabAddBtn'); if (fab) fab.style.display = 'none';
  $('drawerOverlay').classList.remove('active');
  const mgr = $('managerOverlay');
  mgr.classList.remove('active'); mgr.style.display = 'none';
  document.body.style.overflow = '';
  $('authOverlay').style.display = 'flex';
  $('loginUsername').value = '';
  $('loginPassword').value = '';
  $('loginError').textContent = '';
  showToast('👋 Вы вышли из системы');
  setTimeout(() => $('loginUsername').focus(), 200);
}

/* ===========================================================
   ВИДИМОСТЬ ПО РОЛИ
=========================================================== */
function applyRoleVisibility() {
  const manager = isManager();

  // Менеджер — панель менеджера
  $('addProductBtn').style.display    = manager ? '' : 'none';
  $('managerPanelBtn').style.display  = manager ? '' : 'none';
  $('drawerAddBtn').style.display     = ''; // видно всем — и менеджеру, и сотруднику
  $('drawerManagerBtn').style.display = manager ? '' : 'none';

  // Сотрудник — FAB кнопка «+»
  const fab = $('fabAddBtn');
  if (fab) fab.style.display = manager ? 'none' : 'flex';

  // Переключение филиалов — только менеджер
  $('branches').style.display        = manager ? '' : 'none';
  $('drawerBranchBtn').style.display = manager ? '' : 'none';
  $('branchIndicator').style.display = manager ? '' : 'none';

  if (!manager) {
    document.querySelectorAll('.branches .branch-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.branch === userBranch());
    });
  }

  document.body.classList.toggle('role-manager', manager);
  document.body.classList.toggle('role-staff', !manager);
}

/* ===========================================================
   USER CHIP
=========================================================== */
function updateUserChip() {
  if (!state.currentUser) return;
  const u = state.currentUser;
  const initial = (u.name || u.username || '?')[0].toUpperCase();
  $('userChipName').textContent = u.name || u.username;
  $('userAvatar').textContent   = initial;
  $('dropdownName').textContent = u.name || u.username;
  $('dropdownRole').textContent = ROLE_LABELS[u.role] || u.role;
}

function initUserChip() {
  const chip = $('userChip');
  chip.addEventListener('click', e => { e.stopPropagation(); chip.classList.toggle('open'); });
  document.addEventListener('click', () => chip.classList.remove('open'));
  $('logoutBtn').addEventListener('click', () => { chip.classList.remove('open'); handleLogout(); });
}

/* ===========================================================
   MOBILE UI: Drawer + branch modal
=========================================================== */
function initMobileUI() {
  initDrawer();
  initBranchModal();
}

function initDrawer() {
  const overlay = $('drawerOverlay');
  const closeBtn = $('drawerCloseBtn');

  const open = () => {
    updateDrawerProfile();
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  };

  $('burgerBtn').addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  $('drawerBranchBtn').addEventListener('click', () => { close(); setTimeout(openBranchModal, 200); });
  $('drawerAddBtn').addEventListener('click',    () => { close(); setTimeout(() => openEditModal(null), 200); });
  $('drawerPrintBtn').addEventListener('click',  () => { close(); setTimeout(preparePrint, 200); });
  $('drawerManagerBtn').addEventListener('click',() => { close(); setTimeout(openManagerPanel, 200); });
  $('drawerLogoutBtn').addEventListener('click', () => { close(); setTimeout(handleLogout, 200); });

  $('branchIndicator').addEventListener('click', () => { if (isManager()) openBranchModal(); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) close();
  });
}

function updateDrawerProfile() {
  if (!state.currentUser) return;
  const u = state.currentUser;
  const initial = (u.name || u.username || '?')[0].toUpperCase();
  $('drawerAvatar').textContent = initial;
  $('drawerName').textContent   = u.name || u.username;
  $('drawerRole').textContent   = ROLE_LABELS[u.role] || u.role;
}

function initBranchModal() {
  const modal = $('branchModal');
  $('branchModalClose').addEventListener('click', () => closeOverlay(modal));
  modal.addEventListener('click', e => { if (e.target === modal) closeOverlay(modal); });

  modal.querySelectorAll('.branch-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const branch = opt.dataset.branch;
      modal.querySelectorAll('.branch-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      state.activeBranch = branch;
      document.querySelectorAll('.branches .branch-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.branch === branch);
      });
      updateBranchIndicator();
      renderAll();
      setTimeout(() => closeOverlay(modal), 180);
    });
  });
}

function openBranchModal() {
  if (!isManager()) return;
  const modal = $('branchModal');
  modal.querySelectorAll('.branch-option').forEach(o => {
    o.classList.toggle('active', o.dataset.branch === state.activeBranch);
  });
  updateBranchModalStats();
  openOverlay(modal);
}

function updateBranchModalStats() {
  const elAll = $('branchStatAll');
  if (elAll) {
    const total = state.products.reduce((s, p) => s + getQty(p), 0);
    elAll.textContent = `${state.products.length} наименований • ${total} шт`;
  }
  BRANCH_KEYS.forEach((k, i) => {
    const el = $(`branchStat${i + 1}`);
    if (!el) return;
    const items  = state.products.reduce((s, p) => s + (p.branches?.[k] ?? 0), 0);
    const lowCnt = state.products.filter(p => { const q = p.branches?.[k] ?? 0; return q > 0 && q <= 5; }).length;
    const outCnt = state.products.filter(p => (p.branches?.[k] ?? 0) === 0).length;
    let extra = '';
    if (outCnt > 0)      extra = ` • ⚠ ${outCnt} нет`;
    else if (lowCnt > 0) extra = ` • ⚠ ${lowCnt} мало`;
    el.textContent = `${items} шт${extra}`;
  });
}

function updateBranchIndicator() {
  const label = state.activeBranch === 'all'
    ? 'Все филиалы'
    : (BRANCH_LABELS[state.activeBranch] || state.activeBranch);
  $('branchIndicatorValue').textContent = label;
  const sub = $('drawerBranchSub'); if (sub) sub.textContent = label;
}

function initBranchNav() {
  const branches = $('branches');
  branches.querySelectorAll('.branch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!isManager()) return;
      branches.querySelectorAll('.branch-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeBranch = btn.dataset.branch;
      updateBranchIndicator();
      renderAll();
    });
  });
}

/* ===========================================================
   MANAGER PANEL
=========================================================== */
function initManagerPanel() {
  $('managerPanelBtn').addEventListener('click', openManagerPanel);
  $('managerCloseBtn').addEventListener('click', closeManagerPanel);
  $('managerOverlay').addEventListener('click', e => {
    if (e.target === $('managerOverlay')) closeManagerPanel();
  });

  document.querySelectorAll('.manager-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.manager-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabId = tab.dataset.tab;
      $('tabUsers').style.display = tabId === 'users' ? 'block' : 'none';
      $('tabLogs').style.display  = tabId === 'logs'  ? 'block' : 'none';
    });
  });

  $('clearLogsBtn').addEventListener('click', async () => {
    await fbClearLogs();
    state.logs = [];
    renderManagerLogs();
    showToast('✓ Журнал очищен');
  });

  $('userEditClose').addEventListener('click', () => closeOverlay($('userEditModal')));
  $('userEditModal').addEventListener('click', e => {
    if (e.target === $('userEditModal')) closeOverlay($('userEditModal'));
  });
  $('ueEye').addEventListener('click', () => {
    const inp = $('uePassword');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });
  $('ueSubmitBtn').addEventListener('click', handleUserEditSubmit);
}

function openManagerPanel() {
  if (!isManager()) return;
  const overlay = $('managerOverlay');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('active'));
  renderManagerUsers();
  renderManagerLogs();
}

function closeManagerPanel() {
  const overlay = $('managerOverlay');
  overlay.classList.remove('active');
  setTimeout(() => { overlay.style.display = 'none'; }, 320);
}

function renderManagerUsers() {
  const list = $('managerUsersList');
  if (!list) return;

  if (!state.accounts.length) {
    list.innerHTML = '<div class="log-empty">Загрузка…</div>';
    return;
  }

  const sorted = [...state.accounts].sort((a, b) => {
    if (a.role === 'manager') return -1;
    if (b.role === 'manager') return 1;
    return BRANCH_KEYS.indexOf(a.branch) - BRANCH_KEYS.indexOf(b.branch);
  });

  list.innerHTML = sorted.map(acc => {
    const initial = (acc.name || acc.username || '?')[0].toUpperCase();
    const isMe    = acc.id === state.currentUser.id;
    const isMgr   = acc.role === 'manager';
    return `
      <div class="manager-user-card" data-uid="${escHtml(acc.id)}">
        <div class="manager-user-avatar role-${acc.role}">${escHtml(initial)}</div>
        <div class="manager-user-info">
          <div class="manager-user-name">
            ${escHtml(acc.name)}
            ${isMe ? ' <span class="user-tag-me">(вы)</span>' : ''}
          </div>
          <div class="manager-user-meta">
            <span class="user-meta-login">@${escHtml(acc.username)}</span>
            <span class="manager-user-role role-badge-${isMgr ? 'manager' : 'staff'}">
              ${isMgr ? '👑 Менеджер' : '🏪 ' + BRANCH_LABELS[acc.branch]}
            </span>
          </div>
        </div>
        <button class="manager-user-edit" data-uid="${escHtml(acc.id)}" title="Изменить">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </div>`;
  }).join('');

  list.querySelectorAll('.manager-user-edit').forEach(btn => {
    btn.addEventListener('click', () => openUserEditModal(btn.dataset.uid));
  });
}

function openUserEditModal(accId) {
  const acc = state.accounts.find(a => a.id === accId);
  if (!acc) return;
  state.editingUserId = accId;
  $('userEditTitle').textContent = acc.role === 'manager' ? 'Изменить аккаунт менеджера' : `Аккаунт филиала «${BRANCH_LABELS[acc.branch]}»`;
  $('userEditSubtitle').textContent = acc.role === 'manager'
    ? 'Будьте осторожны — это ваш аккаунт.'
    : 'После сохранения сотрудник будет автоматически разлогинен.';
  $('ueName').value     = acc.name || '';
  $('ueUsername').value = acc.username || '';
  $('uePassword').value = '';
  $('ueError').textContent = '';
  openOverlay($('userEditModal'));
  setTimeout(() => $('ueName').focus(), 200);
}

async function handleUserEditSubmit() {
  const accId = state.editingUserId;
  if (!accId) return;
  const acc = state.accounts.find(a => a.id === accId);
  if (!acc) return;

  const name     = $('ueName').value.trim();
  const username = $('ueUsername').value.trim();
  const newPass  = $('uePassword').value;
  const errEl    = $('ueError');

  if (!name)               { errEl.textContent = 'Введите имя'; return; }
  if (!username)           { errEl.textContent = 'Введите логин'; return; }
  if (username.length < 3) { errEl.textContent = 'Логин минимум 3 символа'; return; }
  if (newPass && newPass.length < 4) { errEl.textContent = 'Пароль минимум 4 символа'; return; }

  const dup = state.accounts.find(a => a.id !== accId && a.username.toLowerCase() === username.toLowerCase());
  if (dup) { errEl.textContent = 'Этот логин уже используется'; return; }

  const patch = { name, username };
  let credentialsChanged = false;

  if (username !== acc.username) credentialsChanged = true;
  if (newPass) {
    patch.passwordHash = hashPassword(newPass);
    credentialsChanged = true;
  }

  if (credentialsChanged) {
    patch.sessionVersion = (acc.sessionVersion || 1) + 1;
  }

  await fbUpdateAccount(accId, patch);
  await writeLog('userEdit', `${acc.name} → ${name}${credentialsChanged ? ' (логин/пароль обновлены)' : ''}`);

  closeOverlay($('userEditModal'));
  showToast(credentialsChanged ? '✓ Сохранено. Старая сессия закрыта.' : '✓ Сохранено');

  if (accId === state.currentUser.id && credentialsChanged) {
    const newSession = {
      ...state.currentUser,
      name, username,
      sessionVersion: patch.sessionVersion,
    };
    state.currentUser = newSession;
    saveSession(newSession);
    updateUserChip();
    updateDrawerProfile();
  }
}

function renderManagerLogs() {
  const list = $('managerLogsList');
  if (!list) return;

  if (!state.logs.length) {
    list.innerHTML = '<div class="log-empty">📭 Журнал пуст</div>';
    return;
  }

  list.innerHTML = state.logs.slice(0, 200).map(log => {
    const info = LOG_TYPES[log.type] || { icon: '📌', label: log.type };
    const cssClass = ['add','edit','delete','login','logout','qtyEdit','photoEdit','userEdit'].includes(log.type)
      ? 'log-' + log.type.toLowerCase()
      : 'log-other';
    const branchTag = log.branch ? `<span class="log-branch-tag">${BRANCH_LABELS[log.branch] || log.branch}</span>` : '';
    return `
      <div class="log-entry">
        <div class="log-entry__header">
          <div class="log-entry__icon ${cssClass}">${info.icon}</div>
          <span class="log-entry__user">${escHtml(log.userName || 'Неизвестно')}</span>
          ${branchTag}
          <span class="log-entry__time">${formatDateTime(log.ts)}</span>
        </div>
        <div class="log-entry__action">${escHtml(info.label)}${log.details ? ' — ' + escHtml(log.details) : ''}</div>
      </div>`;
  }).join('');
}

/* ===========================================================
   TOAST
=========================================================== */
let toastTimer = null;
function showToast(message, type = 'default') {
  clearTimeout(toastTimer);
  const el = $('toast');
  el.textContent = message;
  el.className   = `toast ${type} show`;
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ===========================================================
   ФИЛЬТРАЦИЯ / СОРТИРОВКА (без поиска и категории)
=========================================================== */
function getFilteredProducts() {
  let list = [...state.products];
  const branch = state.activeBranch;

  if (state.stockFilter !== 'all') {
    list = list.filter(p => getStockStatus(getQty(p, branch)) === state.stockFilter);
  }

  switch (state.sortMode) {
    case 'smart':
      list.sort((a, b) => {
        const qa = getQty(a, branch);
        const qb = getQty(b, branch);
        const pr = q => q === 0 ? 0 : q <= 5 ? 1 : 2;
        const pa = pr(qa), pb = pr(qb);
        if (pa !== pb) return pa - pb;
        return qa - qb;
      });
      break;
    case 'name':     list.sort((a, b) => a.name.localeCompare(b.name, 'ru')); break;
    case 'qty-asc':  list.sort((a, b) => getQty(a, branch) - getQty(b, branch)); break;
    case 'qty-desc': list.sort((a, b) => getQty(b, branch) - getQty(a, branch)); break;
  }

  return list;
}

/* ===========================================================
   FILTER BAR
=========================================================== */
function initFilters() {
  // Поиска нет — ничего не нужно инициализировать
}

function initFilterModal() {
  const modal = $('filterModal');
  $('filterBtn').addEventListener('click', openFilterModal);
  $('filterModalClose').addEventListener('click', () => closeOverlay(modal));
  modal.addEventListener('click', e => { if (e.target === modal) closeOverlay(modal); });

  modal.querySelectorAll('.filter-stock').forEach(chip => {
    chip.addEventListener('click', () => {
      modal.querySelectorAll('.filter-stock').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.stockFilter = chip.dataset.stock;
      updateFilterBadge();
      renderAll();
    });
  });

  $('filterSortSelect').addEventListener('change', () => {
    state.sortMode = $('filterSortSelect').value;
    updateFilterBadge();
    renderAll();
  });

  $('filterResetBtn').addEventListener('click', () => {
    state.stockFilter = 'all';
    state.sortMode    = 'smart';
    $('filterSortSelect').value = 'smart';
    modal.querySelectorAll('.filter-stock').forEach(c => c.classList.remove('active'));
    modal.querySelector('.filter-stock[data-stock="all"]').classList.add('active');
    updateFilterBadge();
    refreshFilterModalCounts();
    renderAll();
    showToast('✓ Фильтры сброшены');
  });

  $('filterApplyBtn').addEventListener('click', () => {
    closeOverlay(modal);
    showToast('✓ Фильтры применены');
  });
}

function openFilterModal() {
  document.querySelectorAll('.filter-stock').forEach(c => {
    c.classList.toggle('active', c.dataset.stock === state.stockFilter);
  });
  $('filterSortSelect').value = state.sortMode;
  refreshFilterModalCounts();
  openOverlay($('filterModal'));
}

function refreshFilterModalCounts() {
  const branch = state.activeBranch;
  const base   = [...state.products];
  let all = base.length, ok = 0, low = 0, out = 0;
  let totalQty = 0;
  base.forEach(p => {
    const q = getQty(p, branch);
    totalQty += q;
    const s = getStockStatus(q);
    if      (s === 'ok')  ok++;
    else if (s === 'low') low++;
    else                  out++;
  });

  $('filterCountAll').textContent = all;
  $('filterCountOk').textContent  = ok;
  $('filterCountLow').textContent = low;
  $('filterCountOut').textContent = out;

  const branchLabel = branch === 'all' ? 'Все филиалы' : BRANCH_LABELS[branch];
  $('filterSubtitle').textContent     = `${branchLabel} • Сколько товаров осталось`;
  $('filterSummaryTitle').textContent = `📊 Сводка${branch === 'all' && isManager() ? ' по филиалам' : ''}`;

  const summaryEl = $('filterSummary');
  if (isManager() && branch === 'all') {
    summaryEl.innerHTML = `
      <div class="summary-row summary-row--total">
        <span>Общее количество</span>
        <strong>${totalQty} шт</strong>
      </div>
      ${BRANCH_KEYS.map(k => {
        const sum = base.reduce((s, p) => s + (p.branches?.[k] ?? 0), 0);
        return `
          <div class="summary-row">
            <span>🏪 ${BRANCH_LABELS[k]}</span>
            <strong>${sum} шт</strong>
          </div>`;
      }).join('')}
    `;
  } else {
    summaryEl.innerHTML = `
      <div class="summary-row summary-row--total">
        <span>Общее количество</span>
        <strong>${totalQty} шт</strong>
      </div>
      <div class="summary-row">
        <span>✓ В наличии</span>
        <strong>${ok}</strong>
      </div>
      <div class="summary-row">
        <span>⚠ Мало запасов</span>
        <strong>${low}</strong>
      </div>
      <div class="summary-row">
        <span>❌ Нет в наличии</span>
        <strong>${out}</strong>
      </div>
    `;
  }
}

function updateFilterBadge() {
  const badge = $('filterBadge');
  let count = 0;
  if (state.stockFilter !== 'all')   count++;
  if (state.sortMode    !== 'smart') count++;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

/* ===========================================================
   RENDER GRID
=========================================================== */
function renderAll() {
  const myToken = ++renderToken;
  const list    = getFilteredProducts();
  $('statsText').textContent = `Товаров: ${list.length}`;
  if (myToken !== renderToken) return;

  if (!list.length) {
    $('productsGrid').innerHTML = '';
    $('emptyState').style.display = 'flex';
    return;
  }

  $('emptyState').style.display = 'none';
  $('productsGrid').innerHTML = list.map((p, i) => buildCard(p, i)).join('');
  $('productsGrid').querySelectorAll('.product-card').forEach(card => {
    // Клик на карточку → сразу открываем форму редактирования
    card.addEventListener('click', () => openEditModal(card.dataset.id));
  });
}

function buildCard(product, index) {
  const branch = state.activeBranch;
  const qty    = getQty(product, branch);
  const status = getStockStatus(qty);
  const badge  = STOCK_BADGE[status];
  const delay  = Math.min(index * 35, 350);
  const blink  = status === 'out' ? 'product-card--out' : status === 'low' ? 'product-card--low' : '';

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

  const showAllBranches = isManager() && branch === 'all';
  let branchesHtml = '';
  if (showAllBranches) {
    branchesHtml = BRANCH_KEYS.map(k => {
      const bqty = product.branches?.[k] ?? 0;
      const cls  = bqty === 0 ? 'branch-row__qty--out' : bqty <= 3 ? 'branch-row__qty--low' : '';
      return `
        <div class="branch-row">
          <span class="branch-row__label">${BRANCH_LABELS[k]}</span>
          <span class="branch-row__qty ${cls}">${bqty} шт</span>
        </div>`;
    }).join('');
  } else {
    const cls = qty === 0 ? 'branch-row__qty--out' : qty <= 3 ? 'branch-row__qty--low' : '';
    branchesHtml = `
      <div class="branch-row">
        <span class="branch-row__label">${BRANCH_LABELS[branch]}</span>
        <span class="branch-row__qty ${cls}">${qty} шт</span>
      </div>`;
  }

  const totalText  = showAllBranches ? `${getQty(product)} шт` : `${qty} шт`;
  const totalLabel = showAllBranches ? 'Итого' : 'Остаток';

  return `
    <div class="product-card ${blink}" data-id="${product.id}" style="animation-delay:${delay}ms">
      <div class="product-card__image-wrap">
        ${imageHtml}
        <div class="product-card__badge ${badge.cls}">${badge.label}</div>
      </div>
      <div class="product-card__body">
        <div class="product-card__name">${escHtml(product.name)}</div>
        <div class="product-card__branches">${branchesHtml}</div>
        <div class="product-card__footer">
          <span class="product-card__total-label">${totalLabel}</span>
          <span class="product-card__total-value">${totalText}</span>
        </div>
      </div>
    </div>`;
}

/* ===========================================================
   EDIT MODAL (клик на карточку → форма)
=========================================================== */
function openEditModal(productId) {
  state.editingProductId = productId || null;
  $('editModalTitle').textContent = productId ? 'Изменить товар' : 'Добавить товар';

  state.photoDataUrl                  = null;
  $('photoPreview').style.display     = 'none';
  $('photoPlaceholder').style.display = 'flex';
  $('photoRemoveBtn').style.display   = 'none';
  $('photoInput').value               = '';

  if (productId) {
    const p = state.products.find(pr => pr.id === productId);
    if (!p) return;
    $('editName').value = p.name;
    $('editDesc').value = p.description || '';
    $('qty1').value     = p.branches?.branch1 ?? 0;
    $('qty2').value     = p.branches?.branch2 ?? 0;
    $('qty3').value     = p.branches?.branch3 ?? 0;
    if (p.photo) {
      state.photoDataUrl                  = p.photo;
      $('photoPreview').src               = p.photo;
      $('photoPreview').style.display     = 'block';
      $('photoPlaceholder').style.display = 'none';
      $('photoRemoveBtn').style.display   = 'block';
    }

    // Превью для staff
    $('staffProductName').textContent = p.name;
  } else {
    $('editName').value = '';
    $('editDesc').value = '';
    $('qty1').value = $('qty2').value = $('qty3').value = '0';
    const sn = $('staffEditName'); if (sn) sn.value = '';
  }

  const manager = isManager();

  // Менеджер: поля названия и описания всегда видны
  // Сотрудник: поле названия видно при добавлении нового; при редактировании — только превью имени
  $('managerFields').style.display    = manager ? '' : 'none';
  $('staffProductInfo').style.display = (!manager && productId) ? 'block' : 'none';

  // Поле названия для сотрудника при добавлении нового товара
  const staffNameFieldWrap = $('staffNameFieldWrap');
  if (staffNameFieldWrap) {
    staffNameFieldWrap.style.display = (!manager && !productId) ? '' : 'none';
  }

  // Показать удаление только менеджеру и только при редактировании
  const delBtn = $('editDeleteBtn');
  if (delBtn) delBtn.style.display = (manager && productId) ? '' : 'none';

  // Поля кол-ва: staff видит только свой филиал
  document.querySelectorAll('.branch-qty-item').forEach(item => {
    if (manager) {
      item.style.display = '';
    } else {
      item.style.display = item.dataset.branch === userBranch() ? '' : 'none';
    }
  });
  $('branchesQtyTitle').textContent = manager
    ? 'Остатки по филиалам (шт)'
    : `Количество (${BRANCH_LABELS[userBranch()] || ''}, шт)`;

  openOverlay($('editModal'));
  if (manager) setTimeout(() => $('editName').focus(), 200);
}

async function saveProduct() {
  const isEdit  = !!state.editingProductId;
  const manager = isManager();

  if (manager) {
    const name = $('editName').value.trim();
    if (!name) {
      $('editName').style.borderColor = 'var(--danger)';
      $('editName').focus();
      showToast('Введите название товара', 'error');
      return;
    }
    $('editName').style.borderColor = '';
  }

  let original = isEdit ? state.products.find(p => p.id === state.editingProductId) : null;

  let product;
  if (manager) {
    product = {
      id:          state.editingProductId || uid(),
      name:        $('editName').value.trim(),
      category:    original?.category || 'other',
      description: $('editDesc').value.trim(),
      photo:       state.photoDataUrl,
      branches: {
        branch1: Math.max(0, parseInt($('qty1').value, 10) || 0),
        branch2: Math.max(0, parseInt($('qty2').value, 10) || 0),
        branch3: Math.max(0, parseInt($('qty3').value, 10) || 0),
      },
    };
  } else {
    const myBranch = userBranch();
    const myQtyId  = myBranch === 'branch1' ? 'qty1' : myBranch === 'branch2' ? 'qty2' : 'qty3';

    if (!isEdit) {
      // Сотрудник создаёт новый товар
      const staffNameInp = $('staffEditName');
      const staffName = staffNameInp ? staffNameInp.value.trim() : '';
      if (!staffName) {
        if (staffNameInp) { staffNameInp.style.borderColor = 'var(--danger)'; staffNameInp.focus(); }
        showToast('Введите название товара', 'error');
        return;
      }
      if (staffNameInp) staffNameInp.style.borderColor = '';
      const branches = { branch1: 0, branch2: 0, branch3: 0 };
      branches[myBranch] = Math.max(0, parseInt($(myQtyId).value, 10) || 0);
      product = {
        id:          uid(),
        name:        staffName,
        category:    'other',
        description: '',
        photo:       state.photoDataUrl,
        branches,
      };
    } else {
      if (!original) { showToast('⛔ Товар не найден', 'error'); return; }
      product = {
        ...original,
        photo: state.photoDataUrl,
        branches: {
          ...original.branches,
          [myBranch]: Math.max(0, parseInt($(myQtyId).value, 10) || 0),
        },
      };
    }
  }

  if (isEdit) {
    const idx = state.products.findIndex(p => p.id === state.editingProductId);
    if (idx > -1) state.products[idx] = product;

    if (manager) {
      await writeLog('edit', `"${product.name}"`);
    } else {
      const myBranch = userBranch();
      const oldQty = original?.branches?.[myBranch] ?? 0;
      const newQty = product.branches[myBranch];
      const photoChanged = (original?.photo || null) !== (product.photo || null);
      if (oldQty !== newQty) {
        await writeLog('qtyEdit', `"${product.name}": ${oldQty} → ${newQty} шт`);
      }
      if (photoChanged) {
        await writeLog('photoEdit', `"${product.name}"`);
      }
    }
    showToast('✓ Сохранено', 'success');
  } else {
    state.products.unshift(product);
    showToast('✓ Товар добавлен', 'success');
    await writeLog('add', `"${product.name}"`);
  }

  saveLocal(STORAGE_KEY, state.products);
  renderAll();
  closeOverlay($('editModal'));
  await fbSaveProduct(product);
}

/* ===========================================================
   DELETE
=========================================================== */
function openConfirmModal(productId) {
  if (!isManager()) { showToast('⛔ Удаление доступно только менеджеру', 'error'); return; }
  const p = state.products.find(pr => pr.id === productId);
  if (!p) return;
  $('confirmText').textContent = `Удалить "${p.name}"? Это действие нельзя отменить.`;
  state.pendingDeleteId = productId;
  openOverlay($('confirmModal'));
}

async function deleteProduct(productId) {
  if (!isManager()) return;
  const idx = state.products.findIndex(p => p.id === productId);
  if (idx > -1) {
    const name = state.products[idx].name;
    state.products.splice(idx, 1);
    saveLocal(STORAGE_KEY, state.products);
    renderAll();
    showToast(`✓ "${name}" удалён`, 'success');
    await writeLog('delete', `"${name}"`);
    await fbDeleteProduct(productId);
  }
}

/* ===========================================================
   MODAL HELPERS
=========================================================== */
function openOverlay(overlay)  { overlay.classList.add('active'); document.body.style.overflow = 'hidden'; }
function closeOverlay(overlay) {
  overlay.classList.remove('active');
  if (!document.querySelector('.modal-overlay.active')) document.body.style.overflow = '';
}

/* ===========================================================
   PHOTO UPLOAD — Камера / Галерея
=========================================================== */
function initPhotoUpload() {
  // Кнопка «Камера»
  $('btnCamera').addEventListener('click', () => {
    const input = $('photoInput');
    input.removeAttribute('capture');
    input.setAttribute('capture', 'environment');
    input.click();
  });

  // Кнопка «Галерея»
  $('btnGallery').addEventListener('click', () => {
    const input = $('photoInput');
    input.removeAttribute('capture');
    input.click();
  });

  // Клик на саму зону тоже открывает выбор (без capture — галерея по умолчанию)
  $('photoUploadArea').addEventListener('click', e => {
    if (e.target === $('photoRemoveBtn')) return;
    if (e.target.closest('#btnCamera') || e.target.closest('#btnGallery')) return;
    const input = $('photoInput');
    input.removeAttribute('capture');
    input.click();
  });

  $('photoInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    compressImage(file, 800, 0.8).then(dataUrl => {
      state.photoDataUrl                  = dataUrl;
      $('photoPreview').src               = dataUrl;
      $('photoPreview').style.display     = 'block';
      $('photoPlaceholder').style.display = 'none';
      $('photoRemoveBtn').style.display   = 'block';
    }).catch(() => {
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

function compressImage(file, maxDim = 800, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) { height = Math.round(height * maxDim / width); width = maxDim; }
          else                 { width  = Math.round(width  * maxDim / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        try { resolve(canvas.toDataURL('image/jpeg', quality)); }
        catch (e) { reject(e); }
      };
      img.onerror = reject;
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ===========================================================
   STEPPERS
=========================================================== */
function initSteppers() {
  document.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = $(btn.dataset.target);
      if (!input) return;
      let val = parseInt(input.value, 10) || 0;
      if (btn.dataset.action === 'plus')  val++;
      if (btn.dataset.action === 'minus') val = Math.max(0, val - 1);
      input.value = val;
    });
  });
}

/* ===========================================================
   PRINT
=========================================================== */
function preparePrint() {
  const list = getFilteredProducts();
  const now  = new Date();
  const dateStr = now.toLocaleDateString('ru-RU', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const showAll    = isManager() && state.activeBranch === 'all';
  const branchLabel = showAll ? 'Все филиалы' : BRANCH_LABELS[state.activeBranch];

  $('printBranchLabel').textContent = branchLabel;
  $('printTitle').textContent       = `Отчёт по остаткам — ${branchLabel}`;
  $('printDate').textContent        = dateStr;
  $('printFooterDate').textContent  = dateStr;

  const thead = $('printTableHead');
  if (showAll) {
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
    if (showAll) {
      const cells = BRANCH_KEYS.map(k => {
        const q = p.branches?.[k] ?? 0;
        return `<td style="text-align:center;${q === 0 ? 'color:#ccc' : ''}">${q}</td>`;
      }).join('');
      dataCells = `${cells}<td class="print-td-total">${getQty(p)} шт</td>`;
    } else {
      const q = p.branches?.[state.activeBranch] ?? 0;
      dataCells = `<td class="print-td-total" style="text-align:center;${q === 0 ? 'color:#ccc' : ''}">${q} шт</td>`;
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

/* ===========================================================
   PRODUCT EVENTS
=========================================================== */
function initProductEvents() {
  // Менеджер — кнопка «Добавить товар» в хедере
  $('addProductBtn').addEventListener('click', () => openEditModal(null));

  // Сотрудник — FAB кнопка «+»
  const fab = $('fabAddBtn');
  if (fab) {
    fab.addEventListener('click', () => {
      openEditModal(null);
    });
  }

  $('printBtn').addEventListener('click', preparePrint);

  $('editModalClose').addEventListener('click', () => closeOverlay($('editModal')));
  $('editCancelBtn').addEventListener('click',  () => closeOverlay($('editModal')));
  $('editModal').addEventListener('click', e => { if (e.target === $('editModal')) closeOverlay($('editModal')); });
  $('editSaveBtn').addEventListener('click', saveProduct);

  // Кнопка удаления внутри формы редактирования (только для менеджера)
  const delBtn = $('editDeleteBtn');
  if (delBtn) {
    delBtn.addEventListener('click', () => {
      const id = state.editingProductId;
      if (!id) return;
      closeOverlay($('editModal'));
      openConfirmModal(id);
    });
  }

  $('confirmCancelBtn').addEventListener('click', () => {
    closeOverlay($('confirmModal'));
    state.pendingDeleteId = null;
  });
  $('confirmModal').addEventListener('click', e => {
    if (e.target === $('confirmModal')) {
      closeOverlay($('confirmModal'));
      state.pendingDeleteId = null;
    }
  });
  $('confirmDeleteBtn').addEventListener('click', () => {
    closeOverlay($('confirmModal'));
    if (state.pendingDeleteId) {
      deleteProduct(state.pendingDeleteId);
      state.pendingDeleteId = null;
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = document.querySelectorAll('.modal-overlay.active');
    if (open.length) {
      const last = open[open.length - 1];
      last.classList.remove('active');
      if (!document.querySelector('.modal-overlay.active')) document.body.style.overflow = '';
    }
  });
}

/* ===========================================================
   INIT
=========================================================== */
function init() {
  initAuth();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
