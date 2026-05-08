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
const PROOFS_REF   = ref(db, 'proofs'); // отчёты сотрудников с фото-доказательствами

/* ===========================================================
   КОНСТАНТЫ
=========================================================== */
const STORAGE_KEY    = 'mone_products_v2';
const SESSION_KEY    = 'mone_session_v2';
const ACCOUNTS_CACHE = 'mone_accounts_v2';
const LOGS_CACHE     = 'mone_logs_v2';
const PROOFS_CACHE   = 'mone_proofs_v2';

const CATEGORY_LABELS = {
  drinks:     'Напитки',
  disposable: 'Одноразовая посуда',
  food:       'Продукты',
  cleaning:   'Чистящие средства',
  other:      'Прочее',
};
const CATEGORY_EMOJI = {
  drinks:     '🥤',
  disposable: '🍴',
  food:       '🍞',
  cleaning:   '🧴',
  other:      '📦',
};

const BRANCH_LABELS = { branch1: 'Сибирский', branch2: 'Фреско', branch3: 'Гелион' };
const BRANCH_FULL_LABELS = { branch1: 'Сибирский филиал', branch2: 'Фреско филиал', branch3: 'Гелион филиал' };
const BRANCH_KEYS   = ['branch1', 'branch2', 'branch3'];
const ROLE_LABELS   = { manager: 'Менеджер', staff: 'Сотрудник филиала' };

const LOG_TYPES = {
  login:       { icon: '🔑', label: 'Вход в систему' },
  logout:      { icon: '🚪', label: 'Выход из системы' },
  add:         { icon: '➕', label: 'Добавление товара' },
  edit:        { icon: '✏️', label: 'Редактирование товара' },
  delete:      { icon: '🗑️', label: 'Удаление товара' },
  qtyEdit:     { icon: '🔢', label: 'Изменение количества' },
  photoEdit:   { icon: '📷', label: 'Изменение фото' },
  userEdit:    { icon: '👤', label: 'Изменение аккаунта' },
  targetEdit:  { icon: '🎯', label: 'Изменение нормы' },
  proofSubmit: { icon: '📸', label: 'Отчёт-доказательство' },
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
    { id: uid(), name: 'Вилки металлические', category: 'disposable', description: '', photo: null, branches: { branch1: 19, branch2: 22, branch3: 18 }, targets: { branch1: 22, branch2: 22, branch3: 22 } },
    { id: uid(), name: 'Ложки металлические', category: 'disposable', description: '', photo: null, branches: { branch1: 22, branch2: 20, branch3: 22 }, targets: { branch1: 22, branch2: 22, branch3: 22 } },
    { id: uid(), name: 'Pepsi 0.5л',          category: 'drinks',     description: '', photo: null, branches: { branch1: 24, branch2: 8,  branch3: 3  }, targets: { branch1: 30, branch2: 30, branch3: 30 } },
    { id: uid(), name: 'Coca-Cola 1л',        category: 'drinks',     description: '', photo: null, branches: { branch1: 12, branch2: 20, branch3: 15 }, targets: { branch1: 20, branch2: 20, branch3: 20 } },
    { id: uid(), name: 'Сахар',               category: 'food',       description: '', photo: null, branches: { branch1: 10, branch2: 6,  branch3: 4  }, targets: { branch1: 15, branch2: 15, branch3: 15 } },
    { id: uid(), name: 'Fairy 500мл',         category: 'cleaning',   description: '', photo: null, branches: { branch1: 4,  branch2: 4,  branch3: 2  }, targets: { branch1: 6,  branch2: 6,  branch3: 6  } },
  ];
}

/* ===========================================================
   STATE
=========================================================== */
const state = {
  products:         [],
  accounts:         [],
  logs:             [],
  proofs:           [],
  activeBranch:     'all',
  stockFilter:      'all',
  sortMode:         'smart',
  pendingDeleteId:  null,
  pendingDeleteAccountId: null,
  editingProductId: null,
  editingUserId:    null,
  proofProductId:   null,
  photoDataUrl:     null,
  proofPhotoDataUrl: null,
  firebaseLoaded:   false,
  currentUser:      null,
  validatedSession: false,
  currentPage:      'products', // products | gallery | reports
  galleryFilter:    'all',
  reportsBranchFilter: 'all',
  reportsCategoryFilter: 'all',
  reportsSearchQuery: '',
  expandedProductIds: new Set(),       // id товаров, у которых раскрыта inline-панель
  inlinePhotos: new Map(),             // id → dataUrl (фото, прикреплённое в inline-панели)
  pendingPhotoForProductId: null,      // id товара, для которого сейчас выбираем фото
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

function getTarget(product, branch = 'all') {
  if (!product.targets) return 0;
  if (branch === 'all') return BRANCH_KEYS.reduce((s, k) => s + (product.targets?.[k] ?? 0), 0);
  return product.targets?.[branch] ?? 0;
}

function formatRelative(ts) {
  const diff = Date.now() - ts;
  const min  = Math.floor(diff / 60000);
  if (min < 1)  return 'только что';
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d < 7)    return `${d} д назад`;
  return new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

// Возвращает ключ-группу: "today", "yesterday" или "YYYY-MM-DD"
function getDateGroupKey(ts) {
  const d = new Date(ts);
  const today = new Date(); today.setHours(0,0,0,0);
  const date  = new Date(d); date.setHours(0,0,0,0);
  const dayMs = 24*60*60*1000;
  if (date.getTime() === today.getTime()) return 'today';
  if (date.getTime() === today.getTime() - dayMs) return 'yesterday';
  // YYYY-MM-DD для прочих
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// Человеко-читаемое название группы
function formatDateGroupLabel(key) {
  if (key === 'today')     return '📅 Сегодня';
  if (key === 'yesterday') return '📅 Вчера';
  // YYYY-MM-DD → красивая русская дата
  const [y, m, d] = key.split('-');
  const dt = new Date(+y, +m - 1, +d);
  return '📅 ' + dt.toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
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
    // Миграция: добавляем targets и category для старых товаров
    state.products.forEach(p => {
      if (!p.targets)  p.targets  = { branch1: 0, branch2: 0, branch3: 0 };
      if (!p.category) p.category = 'other';
    });
    saveLocal(STORAGE_KEY, state.products);
    state.firebaseLoaded = true;
    renderAll();
    showSyncIndicator('ok');
  }, (err) => {
    console.error('[products]', err);
    if (!state.firebaseLoaded) {
      state.products = loadLocal(STORAGE_KEY) || [];
      state.products.forEach(p => {
        if (!p.targets)  p.targets  = { branch1: 0, branch2: 0, branch3: 0 };
        if (!p.category) p.category = 'other';
      });
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

  // Proofs — отчёты-доказательства, видят все, но staff фильтруется на клиенте
  onValue(PROOFS_REF, (snap) => {
    const data = snap.val();
    state.proofs = data ? Object.values(data).sort((a, b) => b.ts - a.ts) : [];
    saveLocal(PROOFS_CACHE, state.proofs);
    if (state.currentPage === 'gallery') renderGalleryPage();
    if (state.currentPage === 'reports') renderReportsPage();
    renderAll(); // обновим карточки товаров (показ "последний отчёт")
  }, () => {
    state.proofs = loadLocal(PROOFS_CACHE) || [];
    if (state.currentPage === 'gallery') renderGalleryPage();
    if (state.currentPage === 'reports') renderReportsPage();
    renderAll();
  });
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
  ['mainHeader', 'mainToolbar'].forEach(id => {
    const el = $(id); if (el) el.style.display = 'none';
  });
  ['pageProducts', 'pageGallery', 'pageReports'].forEach(id => {
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

async function fbAddProof(entry) {
  try { await set(ref(db, `proofs/${entry.id}`), entry); }
  catch (e) { console.error('Add proof error:', e); throw e; }
}

async function fbDeleteAccount(id) {
  try { await remove(ref(db, `accounts/${id}`)); }
  catch (e) { console.error('Delete account error:', e); showToast('⚠ Ошибка удаления аккаунта', 'error'); }
}

async function writeLog(type, details = '', extra = {}) {
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
    ...extra,
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
  ['mainHeader', 'mainToolbar'].forEach(id => {
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
    initProofPhotoUpload();
    initSteppers();
    initProductEvents();
    initProofEvents();
    initManagerPanel();
    initUserChip();
    initMobileUI();
    initPageNavigation();
    initGalleryEvents();
    initReportsEvents();
    initLightbox();
    initPhotoChoiceSheet();
    enterApp._initialized = true;
  }

  initFirebaseListeners();
  updateDrawerProfile();
  updateBranchIndicator();
  switchPage('products');
}

async function handleLogout() {
  await writeLog('logout', '');
  clearSession();
  state.currentUser = null;
  ['mainHeader', 'mainToolbar'].forEach(id => {
    const el = $(id); if (el) el.style.display = 'none';
  });
  ['pageProducts', 'pageGallery', 'pageReports'].forEach(id => {
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

  $('addProductBtn').style.display    = manager ? '' : 'none';
  $('managerPanelBtn').style.display  = manager ? '' : 'none';
  $('drawerAddBtn').style.display     = manager ? '' : 'none'; // добавлять может только менеджер
  $('drawerManagerBtn').style.display = manager ? '' : 'none';
  $('drawerReportsBtn').style.display = manager ? '' : 'none';
  $('drawerExcelBtn').style.display   = manager ? '' : 'none';

  // Сотрудник — никаких FAB (он работает только через "Доказать")
  const fab = $('fabAddBtn');
  if (fab) fab.style.display = 'none';

  // Переключение филиалов — только менеджер
  $('branches').style.display        = manager ? '' : 'none';
  $('drawerBranchBtn').style.display = manager ? '' : 'none';
  $('branchIndicator').style.display = manager ? '' : 'none';

  // Фильтры галереи — только у менеджера; staff видит свой филиал
  const gFilters = $('galleryFilters');
  if (gFilters) gFilters.style.display = manager ? 'flex' : 'none';

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
  $('drawerExcelBtn').addEventListener('click',  () => { close(); setTimeout(exportToExcel, 200); });
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

  // Кнопка "Удалить аккаунт"
  $('ueDeleteBtn').addEventListener('click', () => {
    const accId = state.editingUserId;
    if (!accId) return;
    const acc = state.accounts.find(a => a.id === accId);
    if (!acc) return;
    if (acc.role === 'manager') { showToast('⛔ Нельзя удалить аккаунт менеджера', 'error'); return; }
    if (acc.id === state.currentUser.id) { showToast('⛔ Нельзя удалить собственный аккаунт', 'error'); return; }
    state.pendingDeleteAccountId = accId;
    $('accountDeleteText').textContent =
      `Аккаунт «${acc.name}» (логин: ${acc.username}) будет удалён. ` +
      `Сотрудник будет немедленно разлогинен и не сможет войти, пока вы не создадите новый аккаунт.`;
    closeOverlay($('userEditModal'));
    setTimeout(() => openOverlay($('accountDeleteModal')), 100);
  });

  $('accountDeleteCancelBtn').addEventListener('click', () => {
    closeOverlay($('accountDeleteModal'));
    state.pendingDeleteAccountId = null;
  });
  $('accountDeleteModal').addEventListener('click', e => {
    if (e.target === $('accountDeleteModal')) {
      closeOverlay($('accountDeleteModal'));
      state.pendingDeleteAccountId = null;
    }
  });
  $('accountDeleteConfirmBtn').addEventListener('click', async () => {
    const accId = state.pendingDeleteAccountId;
    closeOverlay($('accountDeleteModal'));
    state.pendingDeleteAccountId = null;
    if (!accId) return;
    const acc = state.accounts.find(a => a.id === accId);
    if (!acc) return;
    await fbDeleteAccount(accId);
    await writeLog('userEdit', `Удалён аккаунт: ${acc.name} (@${acc.username})`);
    showToast(`✓ Аккаунт «${acc.name}» удалён`);
    // У удалённого пользователя через onValue(ACCOUNTS_REF) сработает
    // revalidateCurrentSession → forceLogout. Заново войти не сможет, пока
    // менеджер не создаст новый аккаунт.
  });
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

  // Кнопка удаления — только для филиалов и не для себя
  const delBtn = $('ueDeleteBtn');
  if (delBtn) {
    const canDelete = acc.role !== 'manager' && acc.id !== state.currentUser.id;
    delBtn.style.display = canDelete ? '' : 'none';
  }

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
    const cssClass = ['add','edit','delete','login','logout','qtyEdit','photoEdit','userEdit','targetEdit','proofSubmit'].includes(log.type)
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
  if (state.currentPage !== 'products') return;
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

  // Клик по карточке: менеджеру — открывает форму редактирования,
  // сотруднику — раскрывает inline-панель (аккордеон) для ввода остатка.
  $('productsGrid').querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', e => {
      // Игнорируем клики на интерактивных элементах внутри карточки
      if (e.target.closest('.product-card__camera-btn')) return;
      if (e.target.closest('.product-card__inline-panel')) return;
      const id = card.dataset.id;
      if (isManager()) {
        openEditModal(id);
      } else {
        toggleInlinePanel(id);
      }
    });
  });

  // Иконка камеры (только сотрудник) — открываем выбор «камера или галерея»
  $('productsGrid').querySelectorAll('.product-card__camera-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      openInlinePhotoChoice(id);
    });
  });

  // Inline-стэппер плюс/минус
  $('productsGrid').querySelectorAll('.inline-stepper__btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.pid;
      const action = btn.dataset.inlineAction;
      const input = document.querySelector(`[data-inline-input="${id}"]`);
      if (!input) return;
      let v = parseInt(input.value, 10) || 0;
      v = action === 'plus' ? v + 1 : Math.max(0, v - 1);
      input.value = v;
      updateInlineHint(id);
    });
  });

  // Inline-input — обновляем подсказку при ручном вводе
  $('productsGrid').querySelectorAll('[data-inline-input]').forEach(inp => {
    inp.addEventListener('input', () => updateInlineHint(inp.dataset.inlineInput));
    inp.addEventListener('click', e => e.stopPropagation());
  });
  $('productsGrid').querySelectorAll('[data-inline-comment]').forEach(t => {
    t.addEventListener('click', e => e.stopPropagation());
  });

  // Кнопка «Сохранить» в inline-панели
  $('productsGrid').querySelectorAll('[data-inline-save]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.inlineSave;
      submitInlineProof(id);
    });
  });
  // Кнопка «Отмена» в inline-панели
  $('productsGrid').querySelectorAll('[data-inline-cancel]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.inlineCancel;
      closeInlinePanel(id);
    });
  });

  // Восстанавливаем уже открытые панели после ререндера
  if (state.expandedProductIds && state.expandedProductIds.size) {
    state.expandedProductIds.forEach(id => {
      const card = document.querySelector(`.product-card[data-id="${id}"]`);
      if (card) card.classList.add('is-expanded');
      updateInlineHint(id);
    });
  }
}

function buildCard(product, index) {
  const branch = state.activeBranch;
  const qty    = getQty(product, branch);
  const target = getTarget(product, branch);
  const delay  = Math.min(index * 35, 350);

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
      const btarget = product.targets?.[k] ?? 0;
      const cls  = bqty === 0 ? 'branch-row__qty--out' : bqty <= 3 ? 'branch-row__qty--low' : '';
      const targetTag = btarget > 0 ? `<span class="branch-row__target">из ${btarget}</span>` : '';
      return `
        <div class="branch-row">
          <span class="branch-row__label">${BRANCH_LABELS[k]}</span>
          <span class="branch-row__qty ${cls}">${bqty} шт ${targetTag}</span>
        </div>`;
    }).join('');
  } else {
    const cls = qty === 0 ? 'branch-row__qty--out' : qty <= 3 ? 'branch-row__qty--low' : '';
    const branchLabel = isManager() ? BRANCH_LABELS[branch] : 'Остаток';
    branchesHtml = `
      <div class="branch-row">
        <span class="branch-row__label">${branchLabel}</span>
        <span class="branch-row__qty ${cls}">${qty} шт</span>
      </div>`;
  }

  const totalText  = showAllBranches ? `${getQty(product)} шт` : `${qty} шт`;
  const totalLabel = showAllBranches ? 'Итого' : 'Сейчас';

  // Бейдж "Должно быть"
  let targetHtml = '';
  if (!showAllBranches && target > 0) {
    const isMiss = qty < target;
    targetHtml = `
      <div class="product-card__target ${isMiss ? 'product-card__target--miss' : ''}">
        <span class="product-card__target-label">🎯 Должно быть</span>
        <span class="product-card__target-value">${qty} / ${target}</span>
      </div>`;
  } else if (showAllBranches && getTarget(product) > 0) {
    const totalQ = getQty(product);
    const totalT = getTarget(product);
    const isMiss = totalQ < totalT;
    targetHtml = `
      <div class="product-card__target ${isMiss ? 'product-card__target--miss' : ''}">
        <span class="product-card__target-label">🎯 Норма (всего)</span>
        <span class="product-card__target-value">${totalQ} / ${totalT}</span>
      </div>`;
  }

  // Категория-чип
  const cat = product.category || 'other';
  const catHtml = `<div class="product-card__cat-badge">${CATEGORY_EMOJI[cat] || '📦'} ${escHtml(CATEGORY_LABELS[cat] || cat)}</div>`;

  // Иконка камеры (только для сотрудника) — на месте старого бейджа статуса
  let cameraBtnHtml = '';
  if (isStaff()) {
    cameraBtnHtml = `
      <button class="product-card__camera-btn" data-id="${product.id}" title="Сделать фото-доказательство" aria-label="Сделать фото">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
      </button>`;
  }

  // Inline-панель «аккордеон» — раскрывается при клике (только для сотрудника)
  let inlinePanelHtml = '';
  if (isStaff()) {
    inlinePanelHtml = `
      <div class="product-card__inline-panel" data-panel-for="${product.id}">
        <div class="product-card__inline-inner">
          <div class="inline-field">
            <label class="inline-field__label">📦 Фактический остаток (шт)</label>
            <div class="inline-stepper">
              <button class="inline-stepper__btn" data-inline-action="minus" data-pid="${product.id}">−</button>
              <input type="number" class="inline-stepper__input" data-inline-input="${product.id}" value="${qty}" min="0" inputmode="numeric"/>
              <button class="inline-stepper__btn" data-inline-action="plus" data-pid="${product.id}">+</button>
            </div>
            <div class="inline-field__hint" data-inline-hint="${product.id}"></div>
          </div>
          <div class="inline-field">
            <label class="inline-field__label">📝 Комментарий <span style="color:var(--text-muted);font-weight:400">(необязательно)</span></label>
            <textarea class="inline-field__textarea" data-inline-comment="${product.id}" rows="2" placeholder="Например: одна сломалась, выбросил..."></textarea>
          </div>
          <div class="inline-actions">
            <button class="inline-btn inline-btn--cancel" data-inline-cancel="${product.id}">Отмена</button>
            <button class="inline-btn inline-btn--save" data-inline-save="${product.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Сохранить
            </button>
          </div>
        </div>
      </div>`;
  }

  return `
    <div class="product-card" data-id="${product.id}" style="animation-delay:${delay}ms">
      <div class="product-card__image-wrap">
        ${imageHtml}
        ${cameraBtnHtml}
      </div>
      <div class="product-card__body">
        ${catHtml}
        <div class="product-card__name">${escHtml(product.name)}</div>
        <div class="product-card__branches">${branchesHtml}</div>
        ${targetHtml}
        <div class="product-card__footer">
          <span class="product-card__total-label">${totalLabel}</span>
          <span class="product-card__total-value">${totalText}</span>
        </div>
      </div>
      ${inlinePanelHtml}
    </div>`;
}

/* ===========================================================
   EDIT MODAL (клик на карточку → форма)
=========================================================== */
function openEditModal(productId) {
  // Сотрудники не могут открывать форму редактирования — для них есть proof модалка
  if (isStaff()) {
    openProofModal(productId);
    return;
  }
  state.editingProductId = productId || null;
  $('editModalTitle').textContent = productId ? 'Изменить товар' : 'Добавить товар';

  state.photoDataUrl                  = null;
  $('photoPreview').style.display     = 'none';
  $('photoPlaceholder').style.display = 'flex';
  $('photoRemoveBtn').style.display   = 'none';
  $('photoInput').value               = '';

  // Скрываем "последний отчёт" — у менеджера показываем только при редактировании
  $('lastProofInfo').style.display = 'none';

  if (productId) {
    const p = state.products.find(pr => pr.id === productId);
    if (!p) return;
    $('editName').value     = p.name;
    $('editDesc').value     = p.description || '';
    $('editCategory').value = p.category || 'other';
    $('qty1').value     = p.branches?.branch1 ?? 0;
    $('qty2').value     = p.branches?.branch2 ?? 0;
    $('qty3').value     = p.branches?.branch3 ?? 0;
    $('target1').value  = p.targets?.branch1 ?? 0;
    $('target2').value  = p.targets?.branch2 ?? 0;
    $('target3').value  = p.targets?.branch3 ?? 0;
    if (p.photo) {
      state.photoDataUrl                  = p.photo;
      $('photoPreview').src               = p.photo;
      $('photoPreview').style.display     = 'block';
      $('photoPlaceholder').style.display = 'none';
      $('photoRemoveBtn').style.display   = 'block';
    }
    // Показываем последний отчёт от любого филиала по этому товару
    const lastProof = state.proofs.find(pr => pr.productId === productId);
    if (lastProof) {
      const branchLabel = BRANCH_LABELS[lastProof.branch] || lastProof.branch;
      const photoHtml = lastProof.photo
        ? `<img src="${lastProof.photo}" alt=""/>`
        : `<div style="width:100%;height:100%;display:grid;place-items:center;color:var(--text-muted)">📷</div>`;
      $('lastProofBody').innerHTML = `
        <div class="last-proof-info__photo" data-proof-id="${escHtml(lastProof.id)}">${photoHtml}</div>
        <div class="last-proof-info__details">
          <div><strong>${escHtml(lastProof.userName)}</strong> (${branchLabel})</div>
          <div>${formatRelative(lastProof.ts)} · ${lastProof.qty} шт${lastProof.target ? ` / норма ${lastProof.target}` : ''}</div>
          ${lastProof.comment ? `<div style="margin-top:4px;font-style:italic;">«${escHtml(lastProof.comment)}»</div>` : ''}
        </div>`;
      $('lastProofInfo').style.display = '';
      // Клик на фото открывает lightbox
      const photoEl = $('lastProofBody').querySelector('.last-proof-info__photo');
      if (photoEl) {
        photoEl.addEventListener('click', () => openLightbox(lastProof));
      }
    }
  } else {
    $('editName').value = '';
    $('editDesc').value = '';
    $('editCategory').value = 'other';
    $('qty1').value = $('qty2').value = $('qty3').value = '0';
    $('target1').value = $('target2').value = $('target3').value = '0';
  }

  // Менеджер: показываем все поля, скрываем staff-блоки
  $('managerFields').style.display    = '';
  $('targetSection').style.display    = '';
  $('staffProductInfo').style.display = 'none';
  $('staffNameFieldWrap').style.display = 'none';
  $('staffTargetInfo').style.display  = 'none';

  // Удаление — только при редактировании
  const delBtn = $('editDeleteBtn');
  if (delBtn) delBtn.style.display = productId ? '' : 'none';

  // Все поля количества видны менеджеру
  document.querySelectorAll('#branchesQtyGrid .branch-qty-item').forEach(item => {
    item.style.display = '';
  });
  $('branchesQtyTitle').textContent = '📦 Остаток по филиалам (фактически, шт)';

  // Подсказки норма vs факт
  updateStockHints();
  ['qty1','qty2','qty3','target1','target2','target3'].forEach(id => {
    const el = $(id);
    if (el && !el._hintListenerAttached) {
      el.addEventListener('input', updateStockHints);
      el._hintListenerAttached = true;
    }
  });

  openOverlay($('editModal'));
  setTimeout(() => $('editName').focus(), 200);
}

function updateStockHints() {
  ['1','2','3'].forEach(i => {
    const qtyEl    = $('qty' + i);
    const targetEl = $('target' + i);
    const hintEl   = $('qty' + i + 'Hint');
    if (!qtyEl || !hintEl) return;
    const qty    = parseInt(qtyEl.value, 10) || 0;
    const target = parseInt(targetEl?.value, 10) || 0;
    if (target <= 0) {
      hintEl.textContent = '';
      hintEl.className = 'branch-qty-target-hint';
      return;
    }
    const diff = qty - target;
    if (diff < 0) {
      hintEl.textContent = `⚠ норма: ${target} (не хватает ${Math.abs(diff)})`;
      hintEl.className = 'branch-qty-target-hint hint-low';
    } else {
      hintEl.textContent = `✓ норма: ${target}`;
      hintEl.className = 'branch-qty-target-hint hint-ok';
    }
  });
}

async function saveProduct() {
  // Эта функция вызывается только менеджером (форма редактирования товара)
  if (!isManager()) {
    showToast('⛔ Только менеджер может редактировать товары', 'error');
    return;
  }

  const isEdit  = !!state.editingProductId;

  const name = $('editName').value.trim();
  if (!name) {
    $('editName').style.borderColor = 'var(--danger)';
    $('editName').focus();
    showToast('Введите название товара', 'error');
    return;
  }
  $('editName').style.borderColor = '';

  const original = isEdit ? state.products.find(p => p.id === state.editingProductId) : null;

  const product = {
    id:          state.editingProductId || uid(),
    name,
    category:    $('editCategory').value || 'other',
    description: $('editDesc').value.trim(),
    photo:       state.photoDataUrl,
    branches: {
      branch1: Math.max(0, parseInt($('qty1').value, 10) || 0),
      branch2: Math.max(0, parseInt($('qty2').value, 10) || 0),
      branch3: Math.max(0, parseInt($('qty3').value, 10) || 0),
    },
    targets: {
      branch1: Math.max(0, parseInt($('target1').value, 10) || 0),
      branch2: Math.max(0, parseInt($('target2').value, 10) || 0),
      branch3: Math.max(0, parseInt($('target3').value, 10) || 0),
    },
  };

  if (isEdit) {
    const idx = state.products.findIndex(p => p.id === state.editingProductId);
    if (idx > -1) state.products[idx] = product;

    // Логи
    let targetChanged = false;
    const targetChanges = [];
    if (original) {
      BRANCH_KEYS.forEach(k => {
        const oldT = original.targets?.[k] ?? 0;
        const newT = product.targets[k] ?? 0;
        if (oldT !== newT) {
          targetChanged = true;
          targetChanges.push(`${BRANCH_LABELS[k]}: ${oldT}→${newT}`);
        }
      });
    }
    if (targetChanged) {
      await writeLog('targetEdit', `"${product.name}" — норма: ${targetChanges.join(', ')}`, {
        productId: product.id, productName: product.name,
      });
    }
    await writeLog('edit', `"${product.name}"`, {
      productId: product.id, productName: product.name,
    });
    showToast('✓ Сохранено', 'success');
  } else {
    state.products.unshift(product);
    showToast('✓ Товар добавлен', 'success');
    await writeLog('add', `"${product.name}"`, {
      productId: product.id, productName: product.name,
    });
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
    await writeLog('delete', `"${name}"`, { productId, productName: name });
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
      input.dispatchEvent(new Event('input', { bubbles: true }));
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
      ${BRANCH_KEYS.map(k => `<th style="text-align:center">${BRANCH_LABELS[k]}<br><small style="font-weight:400;color:#888">факт / норма</small></th>`).join('')}
      <th>Итого</th>`;
  } else {
    thead.innerHTML = `<th style="width:60px">Фото</th><th>Товар</th><th>Категория</th><th style="text-align:center">Факт</th><th style="text-align:center">Норма</th>`;
  }

  $('printTableBody').innerHTML = list.map(p => {
    const imgHtml = p.photo
      ? `<img src="${p.photo}" alt="${escHtml(p.name)}" />`
      : `<div class="print-img-placeholder">—</div>`;
    let dataCells = '';
    if (showAll) {
      const cells = BRANCH_KEYS.map(k => {
        const q = p.branches?.[k] ?? 0;
        const t = p.targets?.[k] ?? 0;
        return `<td style="text-align:center;${q === 0 ? 'color:#ccc' : ''}">${q}${t > 0 ? ' / ' + t : ''}</td>`;
      }).join('');
      dataCells = `${cells}<td class="print-td-total">${getQty(p)} шт</td>`;
    } else {
      const q = p.branches?.[state.activeBranch] ?? 0;
      const t = p.targets?.[state.activeBranch] ?? 0;
      dataCells = `<td class="print-td-total" style="text-align:center;${q === 0 ? 'color:#ccc' : ''}">${q} шт</td><td style="text-align:center;color:#8a4d04">${t > 0 ? t + ' шт' : '—'}</td>`;
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

  $('printBtn').addEventListener('click', preparePrint);

  $('editModalClose').addEventListener('click', () => closeOverlay($('editModal')));
  $('editCancelBtn').addEventListener('click',  () => closeOverlay($('editModal')));
  $('editModal').addEventListener('click', e => { if (e.target === $('editModal')) closeOverlay($('editModal')); });
  $('editSaveBtn').addEventListener('click', saveProduct);

  // Кнопка удаления внутри формы редактирования
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
    // Сначала закрываем lightbox если открыт
    const lightbox = $('lightboxOverlay');
    if (lightbox && lightbox.classList.contains('active')) {
      closeLightbox();
      return;
    }
    const open = document.querySelectorAll('.modal-overlay.active');
    if (open.length) {
      const last = open[open.length - 1];
      last.classList.remove('active');
      if (!document.querySelector('.modal-overlay.active')) document.body.style.overflow = '';
    }
  });
}

/* ===========================================================
   PAGE NAVIGATION (Товары / Галерея / Отчёты)
=========================================================== */
function initPageNavigation() {
  document.querySelectorAll('.drawer-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      // Защита: отчёты — только менеджер
      if (page === 'reports' && !isManager()) {
        showToast('⛔ Отчёты доступны только менеджеру', 'error');
        return;
      }
      // Закрываем drawer
      const drawer = $('drawerOverlay');
      if (drawer) drawer.classList.remove('active');
      document.body.style.overflow = '';
      setTimeout(() => switchPage(page), 200);
    });
  });
}

function switchPage(page) {
  state.currentPage = page;

  // Подсветка активного пункта в drawer
  document.querySelectorAll('.drawer-nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.page === page);
  });

  // Показ/скрытие страниц
  ['products', 'gallery', 'reports'].forEach(p => {
    const id = 'page' + p.charAt(0).toUpperCase() + p.slice(1);
    const el = $(id);
    if (!el) return;
    if (p === page) {
      el.style.display = '';
      el.classList.add('active');
    } else {
      el.style.display = 'none';
      el.classList.remove('active');
    }
  });

  // Toolbar (фильтр товаров) показываем только на странице товаров
  const toolbar = $('mainToolbar');
  if (toolbar) toolbar.style.display = (page === 'products') ? '' : 'none';

  if (page === 'products')      renderAll();
  else if (page === 'gallery')  renderGalleryPage();
  else if (page === 'reports')  renderReportsPage();
}

/* ===========================================================
   INLINE PANEL (аккордеон) — сотрудник доказывает остаток
   прямо под карточкой товара, без модального окна
=========================================================== */
function toggleInlinePanel(productId) {
  const card = document.querySelector(`.product-card[data-id="${productId}"]`);
  if (!card) return;
  if (state.expandedProductIds.has(productId)) {
    closeInlinePanel(productId);
  } else {
    state.expandedProductIds.add(productId);
    card.classList.add('is-expanded');
    updateInlineHint(productId);
    // Скроллим карточку в обзор, чтобы панель влезла
    setTimeout(() => {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 250);
  }
}

function closeInlinePanel(productId) {
  state.expandedProductIds.delete(productId);
  state.inlinePhotos.delete(productId);
  const card = document.querySelector(`.product-card[data-id="${productId}"]`);
  if (card) card.classList.remove('is-expanded');
}

function updateInlineHint(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  const myBranch = userBranch();
  const target = product.targets?.[myBranch] ?? 0;
  const inp = document.querySelector(`[data-inline-input="${productId}"]`);
  const hint = document.querySelector(`[data-inline-hint="${productId}"]`);
  if (!inp || !hint) return;
  const qty = parseInt(inp.value, 10) || 0;
  if (target <= 0) {
    hint.textContent = '';
    hint.className = 'inline-field__hint';
    return;
  }
  const diff = qty - target;
  if (diff < 0) {
    hint.textContent = `⚠ должно быть ${target}, не хватает ${Math.abs(diff)}`;
    hint.className = 'inline-field__hint hint-low';
  } else if (diff === 0) {
    hint.textContent = `✓ всё на месте (норма ${target})`;
    hint.className = 'inline-field__hint hint-ok';
  } else {
    hint.textContent = `✓ норма ${target}, у вас на ${diff} больше`;
    hint.className = 'inline-field__hint hint-ok';
  }
}

// Открываем выбор «Камера / Галерея» для товара (как в Telegram при отправке фото)
function openInlinePhotoChoice(productId) {
  // Если карточка ещё не раскрыта — раскрываем её, чтобы пользователь видел поля
  if (!state.expandedProductIds.has(productId)) {
    toggleInlinePanel(productId);
  }
  state.pendingPhotoForProductId = productId;
  // Показываем bottom-sheet выбора источника
  const sheet = $('photoChoiceSheet');
  if (sheet) sheet.classList.add('active');
}

async function submitInlineProof(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) { showToast('⚠ Товар не найден', 'error'); return; }

  const photo = state.inlinePhotos.get(productId);
  if (!photo) {
    showToast('📸 Сначала сфотографируйте товар (нажмите на иконку камеры)', 'error');
    return;
  }

  const inp = document.querySelector(`[data-inline-input="${productId}"]`);
  const cmt = document.querySelector(`[data-inline-comment="${productId}"]`);
  const qty = Math.max(0, parseInt(inp?.value, 10) || 0);
  const comment = (cmt?.value || '').trim();
  const myBranch = userBranch();
  const target = product.targets?.[myBranch] ?? 0;
  const oldQty = product.branches?.[myBranch] ?? 0;

  const proofEntry = {
    id:          uid(),
    productId:   product.id,
    productName: product.name,
    category:    product.category || 'other',
    photo,
    qty,
    target,
    branch:      myBranch,
    userId:      state.currentUser.id,
    userName:    state.currentUser.name || state.currentUser.username,
    comment,
    ts:          Date.now(),
  };

  const saveBtn = document.querySelector(`[data-inline-save="${productId}"]`);
  if (saveBtn) saveBtn.disabled = true;

  try {
    await fbAddProof(proofEntry);

    const updated = {
      ...product,
      branches: { ...product.branches, [myBranch]: qty },
    };
    const idx = state.products.findIndex(p => p.id === product.id);
    if (idx > -1) state.products[idx] = updated;
    saveLocal(STORAGE_KEY, state.products);
    await fbSaveProduct(updated);

    await writeLog('proofSubmit',
      `"${product.name}": ${qty} шт${target ? ` / норма ${target}` : ''}` +
      (comment ? ` — ${comment}` : ''),
      { productId: product.id, productName: product.name, oldQty, newQty: qty, target });

    showToast('✓ Отчёт отправлен менеджеру', 'success');
    closeInlinePanel(productId);
  } catch (err) {
    console.error('Inline proof error', err);
    showToast('⚠ Ошибка отправки отчёта', 'error');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

// Инициализация bottom-sheet выбора «Камера / Галерея»
function initPhotoChoiceSheet() {
  const sheet = $('photoChoiceSheet');
  if (!sheet) return;

  const close = () => {
    sheet.classList.remove('active');
    state.pendingPhotoForProductId = null;
  };

  $('photoChoiceCancel').addEventListener('click', close);
  sheet.addEventListener('click', e => {
    if (e.target === sheet) close();
  });

  const fileInput = $('inlinePhotoInput');

  $('photoChoiceCamera').addEventListener('click', () => {
    fileInput.setAttribute('capture', 'environment');
    fileInput.click();
  });
  $('photoChoiceGallery').addEventListener('click', () => {
    fileInput.removeAttribute('capture');
    fileInput.click();
  });

  fileInput.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    const pid = state.pendingPhotoForProductId;
    fileInput.value = '';
    close();
    if (!file || !pid) return;
    try {
      const dataUrl = await compressImage(file);
      state.inlinePhotos.set(pid, dataUrl);
      // Подсвечиваем карточку — фото готово
      const card = document.querySelector(`.product-card[data-id="${pid}"]`);
      if (card) card.classList.add('has-photo');
      // Раскрываем панель если ещё не раскрыта
      if (!state.expandedProductIds.has(pid)) toggleInlinePanel(pid);
      showToast('📸 Фото готово — введите остаток и сохраните', 'success');
    } catch (err) {
      console.error(err);
      showToast('⚠ Ошибка загрузки фото', 'error');
    }
  });
}


function initProofPhotoUpload() {
  const input    = $('proofPhotoInput');
  const camBtn   = $('proofBtnCamera');
  const galBtn   = $('proofBtnGallery');
  const area     = $('proofPhotoArea');
  const removeBtn= $('proofPhotoRemoveBtn');
  if (!input) return;

  camBtn.addEventListener('click', () => {
    input.setAttribute('capture', 'environment');
    input.click();
  });
  galBtn.addEventListener('click', () => {
    input.removeAttribute('capture');
    input.click();
  });
  area.addEventListener('click', e => {
    if (e.target === removeBtn || removeBtn.contains(e.target)) return;
    input.removeAttribute('capture');
    input.click();
  });

  input.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      state.proofPhotoDataUrl = dataUrl;
      $('proofPhotoPreview').src = dataUrl;
      $('proofPhotoPreview').style.display = 'block';
      $('proofPhotoPlaceholder').style.display = 'none';
      $('proofPhotoRemoveBtn').style.display = 'block';
    } catch (err) {
      console.error(err);
      showToast('⚠ Ошибка загрузки фото', 'error');
    }
  });

  removeBtn.addEventListener('click', e => {
    e.stopPropagation();
    state.proofPhotoDataUrl = null;
    input.value = '';
    $('proofPhotoPreview').style.display = 'none';
    $('proofPhotoPlaceholder').style.display = 'flex';
    $('proofPhotoRemoveBtn').style.display = 'none';
  });
}

function initProofEvents() {
  $('proofModalClose').addEventListener('click', () => closeOverlay($('proofModal')));
  $('proofCancelBtn').addEventListener('click',  () => closeOverlay($('proofModal')));
  $('proofModal').addEventListener('click', e => {
    if (e.target === $('proofModal')) closeOverlay($('proofModal'));
  });
  $('proofSubmitBtn').addEventListener('click', submitProof);

  // Подсказка норма vs введённый остаток
  const qtyInput = $('proofQty');
  if (qtyInput) {
    qtyInput.addEventListener('input', updateProofHint);
  }
}

function updateProofHint() {
  const product = state.products.find(p => p.id === state.proofProductId);
  if (!product) return;
  const myBranch = userBranch();
  const target = product.targets?.[myBranch] ?? 0;
  const qty = parseInt($('proofQty').value, 10) || 0;
  const hint = $('proofQtyHint');
  if (!hint) return;
  if (target <= 0) {
    hint.textContent = '';
    hint.className = 'branch-qty-target-hint';
    return;
  }
  const diff = qty - target;
  if (diff < 0) {
    hint.textContent = `⚠ должно быть ${target}, не хватает ${Math.abs(diff)}`;
    hint.className = 'branch-qty-target-hint hint-low';
  } else if (diff === 0) {
    hint.textContent = `✓ всё на месте (норма ${target})`;
    hint.className = 'branch-qty-target-hint hint-ok';
  } else {
    hint.textContent = `✓ норма ${target}, у вас на ${diff} больше`;
    hint.className = 'branch-qty-target-hint hint-ok';
  }
}

function openProofModal(productId) {
  if (!isStaff()) return;
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  state.proofProductId = productId;
  state.proofPhotoDataUrl = null;

  const myBranch = userBranch();
  const target = product.targets?.[myBranch] ?? 0;
  const current = product.branches?.[myBranch] ?? 0;

  $('proofProductName').textContent = product.name;
  $('proofTargetValue').textContent = target > 0 ? `${target} шт` : 'не задано';
  $('proofCurrentValue').textContent = `${current} шт`;
  // Подсказку "должно быть" скрываем, если норма не задана
  $('proofTargetRow').style.display = target > 0 ? '' : 'none';

  // Пред-заполняем поле текущим значением
  $('proofQty').value = current;
  $('proofComment').value = '';

  // Сброс фото
  $('proofPhotoPreview').src = '';
  $('proofPhotoPreview').style.display = 'none';
  $('proofPhotoPlaceholder').style.display = 'flex';
  $('proofPhotoRemoveBtn').style.display = 'none';
  $('proofPhotoInput').value = '';

  updateProofHint();
  openOverlay($('proofModal'));
}

async function submitProof() {
  const product = state.products.find(p => p.id === state.proofProductId);
  if (!product) { showToast('⚠ Товар не найден', 'error'); return; }

  if (!state.proofPhotoDataUrl) {
    showToast('📸 Сначала сфотографируйте товар', 'error');
    return;
  }

  const qty = Math.max(0, parseInt($('proofQty').value, 10) || 0);
  const comment = $('proofComment').value.trim();
  const myBranch = userBranch();
  const target = product.targets?.[myBranch] ?? 0;
  const oldQty = product.branches?.[myBranch] ?? 0;

  const proofEntry = {
    id:          uid(),
    productId:   product.id,
    productName: product.name,
    category:    product.category || 'other',
    photo:       state.proofPhotoDataUrl,
    qty,
    target,
    branch:      myBranch,
    userId:      state.currentUser.id,
    userName:    state.currentUser.name || state.currentUser.username,
    comment,
    ts:          Date.now(),
  };

  // Блокируем кнопку
  const btn = $('proofSubmitBtn');
  btn.disabled = true;

  try {
    // 1. Сохраняем proof
    await fbAddProof(proofEntry);

    // 2. Обновляем фактический остаток
    const updated = {
      ...product,
      branches: { ...product.branches, [myBranch]: qty },
    };
    const idx = state.products.findIndex(p => p.id === product.id);
    if (idx > -1) state.products[idx] = updated;
    saveLocal(STORAGE_KEY, state.products);
    await fbSaveProduct(updated);

    // 3. Лог
    await writeLog('proofSubmit',
      `"${product.name}": ${qty} шт${target ? ` / норма ${target}` : ''}` +
      (comment ? ` — ${comment}` : ''),
      {
        productId: product.id,
        productName: product.name,
        oldQty, newQty: qty, target,
      });

    showToast('✓ Отчёт отправлен менеджеру', 'success');
    closeOverlay($('proofModal'));
    state.proofProductId = null;
    state.proofPhotoDataUrl = null;
  } catch (err) {
    console.error('Proof submit error', err);
    showToast('⚠ Ошибка отправки отчёта', 'error');
  } finally {
    btn.disabled = false;
  }
}

/* ===========================================================
   GALLERY PAGE — фотографии товаров с филиалом и датой
=========================================================== */
function initGalleryEvents() {
  document.querySelectorAll('#galleryFilters .reports-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#galleryFilters .reports-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.galleryFilter = btn.dataset.gfilter;
      renderGalleryPage();
    });
  });
}

function renderGalleryPage() {
  const grid    = $('galleryGrid');
  const empty   = $('galleryEmpty');
  const subText = $('galleryPageSub');
  if (!grid) return;

  if (subText) {
    if (isStaff()) {
      subText.textContent = `Фото товаров вашего филиала`;
    } else {
      subText.textContent = state.galleryFilter === 'all'
        ? 'Все фотографии со всех филиалов'
        : `Фото с филиала «${BRANCH_LABELS[state.galleryFilter]}»`;
    }
  }

  let list = [...state.proofs];
  if (isStaff()) {
    list = list.filter(p => p.branch === userBranch());
  } else if (state.galleryFilter !== 'all') {
    list = list.filter(p => p.branch === state.galleryFilter);
  }

  if (!list.length) {
    grid.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = list.map((entry, i) => {
    const delay = Math.min(i * 25, 300);
    const branchLabel = BRANCH_LABELS[entry.branch] || entry.branch;
    return `
      <div class="gallery-card" data-proof-id="${escHtml(entry.id)}" style="animation-delay:${delay}ms">
        <div class="gallery-card__image-wrap">
          <img class="gallery-card__image" src="${entry.photo}" alt="${escHtml(entry.productName)}" loading="lazy"/>
          <span class="gallery-card__branch-badge">${escHtml(branchLabel)}</span>
        </div>
        <div class="gallery-card__body">
          <div class="gallery-card__name">${escHtml(entry.productName)}</div>
          <div class="gallery-card__date">📅 ${new Date(entry.ts).toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}</div>
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.gallery-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.proofId;
      const entry = state.proofs.find(p => p.id === id);
      if (entry) openLightbox(entry);
    });
  });
}

/* ===========================================================
   LIGHTBOX — просмотр фото на весь экран
=========================================================== */
function initLightbox() {
  const overlay = $('lightboxOverlay');
  if (!overlay) return;
  $('lightboxClose').addEventListener('click', closeLightbox);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeLightbox();
  });
}

function openLightbox(entry) {
  $('lightboxImg').src = entry.photo;
  $('lightboxName').textContent = entry.productName || 'Фото';
  const branchLabel = BRANCH_LABELS[entry.branch] || entry.branch || '';
  const dt = new Date(entry.ts).toLocaleString('ru-RU', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });
  $('lightboxMeta').textContent = `${branchLabel} · ${entry.userName || ''} · ${dt}`;
  $('lightboxOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  $('lightboxOverlay').classList.remove('active');
  if (!document.querySelector('.modal-overlay.active')) document.body.style.overflow = '';
}

/* ===========================================================
   REPORTS PAGE — отчёты по дате/филиалу/категории
=========================================================== */
function initReportsEvents() {
  // Фильтры по филиалу
  document.querySelectorAll('#reportsBranchFilters .reports-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#reportsBranchFilters .reports-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.reportsBranchFilter = btn.dataset.rfilter;
      renderReportsPage();
    });
  });

  // Фильтры по категории
  document.querySelectorAll('#reportsCategoryFilters .reports-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#reportsCategoryFilters .reports-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.reportsCategoryFilter = btn.dataset.cfilter;
      renderReportsPage();
    });
  });

  // Поиск
  const searchInp = $('reportsSearchInput');
  if (searchInp) {
    searchInp.addEventListener('input', () => {
      state.reportsSearchQuery = searchInp.value.trim().toLowerCase();
      $('reportsSearchClear').style.display = state.reportsSearchQuery ? '' : 'none';
      renderReportsPage();
    });
  }
  const clearBtn = $('reportsSearchClear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchInp.value = '';
      state.reportsSearchQuery = '';
      clearBtn.style.display = 'none';
      renderReportsPage();
    });
  }

  // Кнопка Excel в шапке отчётов
  $('reportsExcelBtn').addEventListener('click', exportToExcel);
}

function getFilteredProofs() {
  let list = [...state.proofs];
  if (state.reportsBranchFilter !== 'all') {
    list = list.filter(p => p.branch === state.reportsBranchFilter);
  }
  if (state.reportsCategoryFilter !== 'all') {
    list = list.filter(p => (p.category || 'other') === state.reportsCategoryFilter);
  }
  if (state.reportsSearchQuery) {
    const q = state.reportsSearchQuery;
    list = list.filter(p =>
      (p.productName || '').toLowerCase().includes(q) ||
      (p.userName || '').toLowerCase().includes(q)
    );
  }
  return list;
}

function renderReportsPage() {
  if (!isManager()) return;

  const list = getFilteredProofs();

  // Сводка
  const summary = $('reportsSummary');
  const totalReports = list.length;
  const branches = new Set(list.map(p => p.branch));
  const missCount = list.filter(p => p.target > 0 && p.qty < p.target).length;
  const todayCount = list.filter(p => getDateGroupKey(p.ts) === 'today').length;

  summary.innerHTML = `
    <div class="reports-summary-card">
      <div class="reports-summary-card__label">Всего отчётов</div>
      <div class="reports-summary-card__value reports-summary-card__value--accent">${totalReports}</div>
    </div>
    <div class="reports-summary-card">
      <div class="reports-summary-card__label">Сегодня</div>
      <div class="reports-summary-card__value reports-summary-card__value--success">${todayCount}</div>
    </div>
    <div class="reports-summary-card">
      <div class="reports-summary-card__label">Филиалов отчиталось</div>
      <div class="reports-summary-card__value">${branches.size} / 3</div>
    </div>
    <div class="reports-summary-card">
      <div class="reports-summary-card__label">Недостача</div>
      <div class="reports-summary-card__value reports-summary-card__value--danger">${missCount}</div>
    </div>
  `;

  // Список отчётов
  const listEl = $('reportsList');
  const empty = $('reportsEmpty');

  if (!list.length) {
    listEl.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  // Группируем по дате
  const groups = {};
  list.forEach(proof => {
    const key = getDateGroupKey(proof.ts);
    if (!groups[key]) groups[key] = [];
    groups[key].push(proof);
  });

  // Сортировка ключей: today, yesterday, потом обратная сортировка по дате
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === 'today') return -1;
    if (b === 'today') return 1;
    if (a === 'yesterday') return -1;
    if (b === 'yesterday') return 1;
    return b.localeCompare(a);
  });

  listEl.innerHTML = sortedKeys.map(key => {
    const proofs = groups[key];
    const cards = proofs.map((proof, i) => {
      const delay = Math.min(i * 30, 300);
      const branchLabel = BRANCH_LABELS[proof.branch] || proof.branch;
      const cat = proof.category || 'other';
      const catLabel = `${CATEGORY_EMOJI[cat] || '📦'} ${CATEGORY_LABELS[cat] || 'Прочее'}`;
      const target = proof.target || 0;
      const qty = proof.qty || 0;
      const isMiss = target > 0 && qty < target;
      const isOk = target > 0 && qty >= target;
      const cardCls = isMiss ? 'proof-card--miss' : (isOk ? 'proof-card--ok' : '');
      const qtyCls = isMiss ? 'proof-card__qty--miss' : (isOk ? 'proof-card__qty--ok' : '');

      let deficitHtml = '';
      if (target > 0) {
        const diff = qty - target;
        if (diff < 0) {
          deficitHtml = `<span class="proof-card__deficit">−${Math.abs(diff)} шт не хватает</span>`;
        } else if (diff === 0) {
          deficitHtml = `<span class="proof-card__deficit proof-card__deficit--ok">✓ всё на месте</span>`;
        } else {
          deficitHtml = `<span class="proof-card__deficit proof-card__deficit--ok">+${diff} шт</span>`;
        }
      }

      const photoHtml = proof.photo
        ? `<img src="${proof.photo}" alt="${escHtml(proof.productName)}" loading="lazy"/>`
        : `<div class="proof-card__photo--empty">📷</div>`;

      return `
        <div class="proof-card ${cardCls}" data-proof-id="${escHtml(proof.id)}" style="animation-delay:${delay}ms">
          <div class="proof-card__photo">${photoHtml}</div>
          <div class="proof-card__body">
            <div class="proof-card__head">
              <div class="proof-card__product-name">${escHtml(proof.productName)}</div>
              <div class="proof-card__time">${formatTime(proof.ts)}</div>
            </div>
            <div class="proof-card__meta">
              <span class="proof-card__chip proof-card__chip--branch">🏪 ${escHtml(branchLabel)}</span>
              <span class="proof-card__chip proof-card__chip--cat">${escHtml(catLabel)}</span>
              <span class="proof-card__chip proof-card__chip--user">👤 ${escHtml(proof.userName || '')}</span>
            </div>
            <div class="proof-card__numbers">
              <span class="proof-card__qty ${qtyCls}">${qty} шт</span>
              ${target > 0 ? `<span class="proof-card__sep">/</span><span class="proof-card__target">норма ${target}</span>` : ''}
              ${deficitHtml}
            </div>
            ${proof.comment ? `<div class="proof-card__comment">«${escHtml(proof.comment)}»</div>` : ''}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="report-day-group">
        <div class="report-day-group__header">
          <span class="report-day-group__date">${formatDateGroupLabel(key)}</span>
          <span class="report-day-group__count">${proofs.length} отчёт${proofs.length === 1 ? '' : (proofs.length < 5 ? 'а' : 'ов')}</span>
        </div>
        <div class="report-day-group__body">${cards}</div>
      </div>`;
  }).join('');

  // Клик на фото → lightbox
  listEl.querySelectorAll('.proof-card__photo').forEach(ph => {
    ph.addEventListener('click', e => {
      e.stopPropagation();
      const card = ph.closest('.proof-card');
      if (!card) return;
      const id = card.dataset.proofId;
      const entry = state.proofs.find(p => p.id === id);
      if (entry) openLightbox(entry);
    });
  });
}

/* ===========================================================
   EXCEL EXPORT (SheetJS)
=========================================================== */
function exportToExcel() {
  if (!isManager()) {
    showToast('⛔ Только менеджер может выгружать Excel', 'error');
    return;
  }
  if (typeof XLSX === 'undefined') {
    showToast('⚠ Библиотека Excel не загружена', 'error');
    return;
  }

  const list = getFilteredProofs();
  if (!list.length) {
    showToast('Нет данных для экспорта', 'error');
    return;
  }

  // Заголовки и данные
  const header = ['Дата', 'Время', 'Филиал', 'Категория', 'Товар', 'Должно быть', 'Фактически', 'Расхождение', 'Сотрудник', 'Комментарий'];
  const rows = list.map(p => {
    const d = new Date(p.ts);
    const date = d.toLocaleDateString('ru-RU');
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const target = p.target || 0;
    const qty = p.qty || 0;
    const diff = target > 0 ? (qty - target) : '';
    return [
      date,
      time,
      BRANCH_LABELS[p.branch] || p.branch,
      CATEGORY_LABELS[p.category] || 'Прочее',
      p.productName || '',
      target > 0 ? target : '',
      qty,
      diff === '' ? '' : (diff > 0 ? `+${diff}` : `${diff}`),
      p.userName || '',
      p.comment || '',
    ];
  });

  const wsData = [header, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Ширина колонок
  ws['!cols'] = [
    { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 22 }, { wch: 32 },
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 40 },
  ];

  // Высота строки заголовка
  ws['!rows'] = [{ hpt: 28 }];

  // Стили заголовка (SheetJS Community поддерживает только базовые стили,
  // но мы добавим bold/fill через расширенный подход)
  const headerRange = XLSX.utils.decode_range(ws['!ref']);
  for (let C = headerRange.s.c; C <= headerRange.e.c; C++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[cellRef]) continue;
    ws[cellRef].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 },
      fill: { fgColor: { rgb: '1877F2' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top:    { style: 'thin', color: { rgb: '888888' } },
        bottom: { style: 'thin', color: { rgb: '888888' } },
        left:   { style: 'thin', color: { rgb: '888888' } },
        right:  { style: 'thin', color: { rgb: '888888' } },
      },
    };
  }

  // Подсветка строк с недостачей и зебра
  for (let R = 1; R <= rows.length; R++) {
    const isMiss = typeof rows[R-1][7] === 'string' && rows[R-1][7].startsWith('-');
    const isZebra = R % 2 === 0;
    const fillRgb = isMiss ? 'FDECEC' : (isZebra ? 'F7F8FA' : 'FFFFFF');
    for (let C = headerRange.s.c; C <= headerRange.e.c; C++) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
      ws[cellRef].s = {
        font: { sz: 11, color: { rgb: isMiss && C === 7 ? 'C42424' : '222222' }, bold: isMiss && C === 7 },
        fill: { fgColor: { rgb: fillRgb } },
        alignment: { vertical: 'center', wrapText: true,
          horizontal: ([5, 6, 7].includes(C)) ? 'center' : 'left' },
        border: {
          top:    { style: 'thin', color: { rgb: 'E5E7EB' } },
          bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
          left:   { style: 'thin', color: { rgb: 'E5E7EB' } },
          right:  { style: 'thin', color: { rgb: 'E5E7EB' } },
        },
      };
    }
  }

  // Создаём книгу
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Отчёты');

  // Имя файла с датой
  const today = new Date();
  const dateStr = today.toLocaleDateString('ru-RU').replaceAll('.', '-');
  const fileName = `Отчёт_${dateStr}.xlsx`;

  XLSX.writeFile(wb, fileName);
  showToast(`✓ Скачано: ${fileName}`, 'success');
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
