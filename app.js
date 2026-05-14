
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
const CATEGORIES_REF = ref(db, 'categories'); // динамические категории, управляемые менеджером

/* ===========================================================
   КОНСТАНТЫ
=========================================================== */
const STORAGE_KEY    = 'mone_products_v2';
const SESSION_KEY    = 'mone_session_v2';
const ACCOUNTS_CACHE = 'mone_accounts_v2';
const LOGS_CACHE     = 'mone_logs_v2';
const PROOFS_CACHE   = 'mone_proofs_v2';
const CATEGORIES_CACHE = 'mone_categories_v2';

/* Дефолтные категории — используются как fallback, если БД пуста.
   В UI отображаются БЕЗ эмодзи (серьёзный стиль). */
const DEFAULT_CATEGORIES = [
  { id: 'drinks',     label: 'Напитки',              order: 1 },
  { id: 'disposable', label: 'Одноразовая посуда',   order: 2 },
  { id: 'cleaning',   label: 'Чистящие средства',    order: 3 },
  { id: 'other',      label: 'Прочее',               order: 99 },
];

/* Геттер: подпись категории по id */
function getCategoryLabel(catId) {
  if (!catId) return 'Прочее';
  const found = state.categories.find(c => c.id === catId);
  if (found) return found.label;
  // fallback на дефолты
  const def = DEFAULT_CATEGORIES.find(c => c.id === catId);
  return def ? def.label : (catId === 'other' ? 'Прочее' : catId);
}

/* Сортированный список категорий */
function getCategoriesSorted() {
  const list = state.categories.length ? state.categories : DEFAULT_CATEGORIES;
  return [...list].sort((a, b) => (a.order || 0) - (b.order || 0));
}


const BRANCH_LABELS = { branch1: 'Сибирский', branch2: 'Фреско', branch3: 'Гелион' };
const BRANCH_FULL_LABELS = { branch1: 'Сибирский филиал', branch2: 'Фреско филиал', branch3: 'Гелион филиал' };
const BRANCH_KEYS   = ['branch1', 'branch2', 'branch3'];
const ROLE_LABELS   = { manager: 'Менеджер', staff: 'Сотрудник филиала' };

const LOG_TYPES = {
  login:       { icon: 'LOGIN',  label: 'Вход в систему' },
  logout:      { icon: 'LOGOUT', label: 'Выход из системы' },
  add:         { icon: 'ADD',    label: 'Добавление товара' },
  edit:        { icon: 'EDIT',   label: 'Редактирование товара' },
  delete:      { icon: 'DEL',    label: 'Удаление товара' },
  qtyEdit:     { icon: 'QTY',    label: 'Изменение количества' },
  photoEdit:   { icon: 'PHOTO',  label: 'Изменение фото' },
  userEdit:    { icon: 'USER',   label: 'Изменение аккаунта' },
  targetEdit:  { icon: 'TGT',    label: 'Изменение нормы' },
  proofSubmit: { icon: 'RPT',    label: 'Отчёт-доказательство' },
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
  const now = Date.now();
  return [
    { id: uid(), name: 'Вилки металлические', category: 'disposable', description: '', photo: null, branches: { branch1: 19, branch2: 22, branch3: 18 }, targets: { branch1: 22, branch2: 22, branch3: 22 }, createdAt: now + 1 },
    { id: uid(), name: 'Ложки металлические', category: 'disposable', description: '', photo: null, branches: { branch1: 22, branch2: 20, branch3: 22 }, targets: { branch1: 22, branch2: 22, branch3: 22 }, createdAt: now + 2 },
    { id: uid(), name: 'Pepsi 0.5л',          category: 'drinks',     description: '', photo: null, branches: { branch1: 24, branch2: 8,  branch3: 3  }, targets: { branch1: 30, branch2: 30, branch3: 30 }, createdAt: now + 3 },
    { id: uid(), name: 'Coca-Cola 1л',        category: 'drinks',     description: '', photo: null, branches: { branch1: 12, branch2: 20, branch3: 15 }, targets: { branch1: 20, branch2: 20, branch3: 20 }, createdAt: now + 4 },
    { id: uid(), name: 'Сахар',               category: 'other',      description: '', photo: null, branches: { branch1: 10, branch2: 6,  branch3: 4  }, targets: { branch1: 15, branch2: 15, branch3: 15 }, createdAt: now + 5 },
    { id: uid(), name: 'Fairy 500мл',         category: 'cleaning',   description: '', photo: null, branches: { branch1: 4,  branch2: 4,  branch3: 2  }, targets: { branch1: 6,  branch2: 6,  branch3: 6  }, createdAt: now + 6 },
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
  categories:       [],   // динамические категории {id, label, order}
  activeBranch:     'all',
  stockFilter:      'all',
  categoryFilter:   'all',
  searchQuery:      '',
  sortMode:         'manual',
  pendingDeleteId:  null,
  pendingDeleteAccountId: null,
  pendingDeleteCategoryId: null,
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
  pendingQtyChange: null,              // {productId, newQty, originalQty, inputEl} — ожидающая смена цифры с фото
  // ── Режим выбора в галерее (iPhone-style) ──
  gallerySelectMode: false,            // включён ли режим выбора
  gallerySelected: new Set(),          // id выбранных proof
  // ── Excel экспорт по дате ──
  excelDateMode: 'today',              // today | yesterday | week | month | all | custom
  excelDateFrom: null,                 // YYYY-MM-DD
  excelDateTo:   null,                 // YYYY-MM-DD
  excelBranch:   'all',                // all | branch1 | branch2 | branch3 — выбор филиала в самой модалке
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

/**
 * Возвращает timestamp начала сегодняшнего дня (00:00 локального времени).
 * Используется для определения «вчерашних» вводов.
 */
function getTodayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Возвращает информацию о «последнем остатке за прошлый день» для конкретного филиала.
 * Если последний ввод был СЕГОДНЯ (>= 00:00 сегодня) → возвращает null
 *   (показывать «Вчера: X» не нужно, цифра в инпуте — это и есть свежий ввод).
 * Если последний ввод был ВЧЕРА или раньше → возвращает {qty, ts, userName, label}
 *   где label = «Вчера», «2 дня назад», «12 авг», и т.д.
 */
function getYesterdayInfo(product, branch) {
  const entry = product.lastEntries?.[branch];
  if (!entry || typeof entry.qty !== 'number') return null;

  const todayStart = getTodayStart();
  if (entry.ts >= todayStart) return null; // ввод был сегодня — это не «вчера»

  // Определяем подпись
  const dayMs = 24 * 60 * 60 * 1000;
  const yesterdayStart = todayStart - dayMs;
  let label;
  if (entry.ts >= yesterdayStart) {
    label = 'Вчера';
  } else {
    const daysAgo = Math.floor((todayStart - entry.ts) / dayMs);
    if (daysAgo < 7) {
      label = `${daysAgo} ${daysAgo === 1 ? 'день' : daysAgo < 5 ? 'дня' : 'дней'} назад`;
    } else {
      label = new Date(entry.ts).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
    }
  }

  return { qty: entry.qty, ts: entry.ts, userName: entry.userName || '', label };
}

/**
 * Возвращает количество ШТУК, которое нужно показать в поле ввода у сотрудника.
 * Если последний ввод был сегодня → показываем то значение, что в branches[k].
 * Если последний ввод был вчера или раньше → показываем 0 (новый день — новый ввод).
 */
function getCurrentInputQty(product, branch) {
  const entry = product.lastEntries?.[branch];
  if (!entry) {
    // Нет записи о вводе — это либо новый товар, либо мигрированный.
    // Показываем то, что лежит в branches[k] (для обратной совместимости).
    return product.branches?.[branch] ?? 0;
  }
  const todayStart = getTodayStart();
  if (entry.ts >= todayStart) {
    // Ввод был сегодня → показываем его
    return product.branches?.[branch] ?? entry.qty ?? 0;
  }
  // Ввод был вчера или раньше → новый день начинается с 0
  return 0;
}

/**
 * Есть ли отчёт-фото (proof) для товара за последние 24 часа?
 * Для сотрудника — только в его филиале.
 * Для менеджера — в любом филиале (или в активном, если выбран конкретный).
 */
function hasRecentProof(productId, branch) {
  if (!state.proofs || !state.proofs.length) return false;
  const dayMs = 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - dayMs;
  return state.proofs.some(p => {
    if (p.productId !== productId) return false;
    if (p.ts < cutoff) return false;
    if (branch && branch !== 'all') {
      if (p.branch !== branch) return false;
    }
    return true;
  });
}

/**
 * Обновляет класс has-photo-recent на всех карточках товаров.
 * Вызывается когда меняются proofs или каждые 5 минут (на случай если 24ч истекли).
 */
function refreshAllPhotoBadges() {
  const cards = document.querySelectorAll('.product-card[data-id]');
  if (!cards.length) {
    // Если карточек ещё нет — делаем обычный ререндер
    if (state.currentPage === 'products') renderAll();
    return;
  }
  const branchForCheck = isStaff() ? userBranch() : (state.activeBranch === 'all' ? null : state.activeBranch);
  cards.forEach(card => {
    const id = card.dataset.id;
    const recent = hasRecentProof(id, branchForCheck);
    card.classList.toggle('has-photo-recent', recent);
  });
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
  if (key === 'today')     return 'Сегодня';
  if (key === 'yesterday') return 'Вчера';
  // YYYY-MM-DD → красивая русская дата
  const [y, m, d] = key.split('-');
  const dt = new Date(+y, +m - 1, +d);
  return dt.toLocaleDateString('ru-RU', {
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

/* Если в БД нет ни одной категории — заливаем дефолтный набор. */
function bootstrapCategoriesIfMissing() {
  return get(CATEGORIES_REF).then(snap => {
    if (snap.exists() && snap.val() && Object.keys(snap.val()).length > 0) return;
    const updates = {};
    DEFAULT_CATEGORIES.forEach(c => { updates[c.id] = c; });
    return set(CATEGORIES_REF, updates);
  }).catch(() => {});
}

function initFirebaseListeners() {
  showSyncIndicator('connecting');

  // Снимок предыдущей версии товаров для сравнения
  let prevSnapshot = null;

  onValue(PRODUCTS_REF, (snap) => {
    const data = snap.val();
    const newProducts = data ? Object.values(data) : [];
    // Миграция: добавляем targets, category и createdAt для старых товаров
    let baseTs = Date.now() - newProducts.length * 1000;
    newProducts.forEach((p, idx) => {
      if (!p.targets)   p.targets   = { branch1: 0, branch2: 0, branch3: 0 };
      if (!p.category)  p.category  = 'other';
      if (!p.createdAt) p.createdAt = baseTs + idx * 1000; // стабильный порядок для старых
      // Если есть остатки но нет истории lastEntries — создаём её с датой ВЧЕРАШНЕГО дня,
      // чтобы существующие данные отобразились как «Вчера: X шт», а инпут стал 0.
      if (!p.lastEntries) {
        const dayMs = 24 * 60 * 60 * 1000;
        const yesterdayTs = Date.now() - dayMs;
        p.lastEntries = {};
        BRANCH_KEYS.forEach(k => {
          const q = p.branches?.[k] ?? 0;
          if (q > 0) {
            p.lastEntries[k] = { qty: q, ts: yesterdayTs, userName: '' };
          }
        });
      }
    });

    // Проверяем: изменилось ли что-то кроме остатков?
    // Если только остатки — делаем мягкое обновление БЕЗ ререндера (товары не перепрыгивают).
    const onlyQtyChanged = canDoSoftUpdate(prevSnapshot, newProducts);

    state.products = newProducts;
    saveLocal(STORAGE_KEY, state.products);
    state.firebaseLoaded = true;

    if (onlyQtyChanged || shouldDoPartialUpdate()) {
      // Мягкое обновление: меняем числа в карточках, порядок не трогаем
      state.products.forEach(p => updateCardQtyDisplay(p.id));
      $('statsText').textContent = `Товаров: ${getFilteredProducts().length}`;
    } else {
      renderAll();
    }

    // Сохраняем снимок для следующего сравнения
    prevSnapshot = newProducts.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      photo: p.photo,
      branches: { ...p.branches },
      targets: { ...p.targets },
    }));

    showSyncIndicator('ok');
  }, (err) => {
    console.error('[products]', err);
    if (!state.firebaseLoaded) {
      state.products = loadLocal(STORAGE_KEY) || [];
      let baseTs = Date.now() - state.products.length * 1000;
      state.products.forEach((p, idx) => {
        if (!p.targets)   p.targets   = { branch1: 0, branch2: 0, branch3: 0 };
        if (!p.category)  p.category  = 'other';
        if (!p.createdAt) p.createdAt = baseTs + idx * 1000;
        if (!p.lastEntries) {
          const dayMs = 24 * 60 * 60 * 1000;
          const yesterdayTs = Date.now() - dayMs;
          p.lastEntries = {};
          BRANCH_KEYS.forEach(k => {
            const q = p.branches?.[k] ?? 0;
            if (q > 0) {
              p.lastEntries[k] = { qty: q, ts: yesterdayTs, userName: '' };
            }
          });
        }
      });
      state.firebaseLoaded = true;
      renderAll();
    }
    showSyncIndicator('error');
    showToast('Нет связи — работаем офлайн', 'error');
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
    // Обновляем зелёные галочки на карточках товаров — не делаем полный ререндер,
    // только переключаем класс has-photo-recent.
    refreshAllPhotoBadges();
  }, () => {
    state.proofs = loadLocal(PROOFS_CACHE) || [];
    if (state.currentPage === 'gallery') renderGalleryPage();
    if (state.currentPage === 'reports') renderReportsPage();
    refreshAllPhotoBadges();
  });

  // Категории — слушают все пользователи (нужны для отображения и фильтров)
  onValue(CATEGORIES_REF, (snap) => {
    const data = snap.val();
    state.categories = data ? Object.values(data) : [];
    if (!state.categories.length) state.categories = [...DEFAULT_CATEGORIES];
    saveLocal(CATEGORIES_CACHE, state.categories);
    refreshCategoryDropdowns();
    if (state.currentPage === 'products') renderAll();
    if (state.currentPage === 'reports')  renderReportsPage();
  }, () => {
    state.categories = loadLocal(CATEGORIES_CACHE) || [...DEFAULT_CATEGORIES];
    refreshCategoryDropdowns();
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
  catch (e) { console.error('Save product error:', e); showToast('Ошибка синхронизации', 'error'); }
}
async function fbDeleteProduct(id) {
  try { await remove(ref(db, `products/${id}`)); }
  catch (e) { console.error('Delete product error:', e); showToast('Ошибка удаления', 'error'); }
}
async function fbUpdateAccount(id, patch) {
  try { await update(ref(db, `accounts/${id}`), patch); }
  catch (e) { console.error('Update account error:', e); showToast('Ошибка сохранения', 'error'); }
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
  catch (e) { console.error('Delete account error:', e); showToast('Ошибка удаления аккаунта', 'error'); }
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
    ok:         { text: 'Синхронизировано', cls: 'sync--ok'         },
    error:      { text: 'Офлайн',           cls: 'sync--error'      },
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

  // Время показа сплеша: 2.2s (анимация в CSS). Ждём, пока он исчезнет.
  const SPLASH_DURATION = 2200;

  const session = loadSession();
  if (session && session.id) {
    // У пользователя есть аккаунт — после сплеша сразу открываем склад
    state.currentUser = session;
    setTimeout(() => enterApp(true), SPLASH_DURATION);
    return;
  }

  // Нет сессии — после сплеша показываем форму логина
  setTimeout(() => {
    $('authOverlay').style.display = 'flex';
    setTimeout(() => $('loginUsername').focus(), 200);
  }, SPLASH_DURATION);

  bootstrapAccountsIfMissing().catch(() => {});
  bootstrapProductsIfMissing().catch(() => {});
  bootstrapCategoriesIfMissing().catch(() => {});
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
  showToast(`Добро пожаловать, ${acc.name}!`, 'success');
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
    initExcelDateModal();
    enterApp._initialized = true;
  }

  initFirebaseListeners();
  updateDrawerProfile();
  updateBranchIndicator();
  switchPage('products');

  // Планируем срабатывание ровно в полночь — чтобы карточки обновились
  // и «Вчера: X шт» появилось, а инпуты сбросились в 0.
  scheduleMidnightRefresh();

  // Каждые 5 минут обновляем зелёные галочки (на случай если 24 часа истекли,
  // и «Вчера» (на случай если новый день только что наступил без срабатывания таймера).
  scheduleBadgeRefresh();

  // Автоочистка старых фото-отчётов — только для менеджера, не чаще раза в день.
  // Если последняя очистка была меньше 24 часов назад — пропускаем.
  if (isManager()) {
    setTimeout(maybeAutoCleanupOldProofs, 8000); // ждём 8 секунд после входа чтобы proofs загрузились
  }
}

const AUTO_CLEANUP_KEY = 'mone_last_auto_cleanup_v1';
async function maybeAutoCleanupOldProofs() {
  if (!isManager()) return;
  const last = parseInt(localStorage.getItem(AUTO_CLEANUP_KEY) || '0', 10);
  const dayMs = 24 * 60 * 60 * 1000;
  if (last && (Date.now() - last) < dayMs) return; // запускали меньше суток назад

  const removed = await cleanupOldProofs(false);
  localStorage.setItem(AUTO_CLEANUP_KEY, String(Date.now()));
  if (removed > 0) {
    showToast(`Автоочистка: удалено ${removed} фото старше 60 дней`, 'success');
  }
}

let _midnightTimer = null;
function scheduleMidnightRefresh() {
  if (_midnightTimer) clearTimeout(_midnightTimer);
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5); // +5 сек после полуночи на всякий случай
  const ms = tomorrow.getTime() - now.getTime();
  _midnightTimer = setTimeout(() => {
    // Полночь наступила — перерисовываем сетку
    if (state.currentPage === 'products') renderAll();
    scheduleMidnightRefresh(); // на следующий день
  }, ms);
}

let _badgeTimer = null;
function scheduleBadgeRefresh() {
  if (_badgeTimer) clearInterval(_badgeTimer);
  // Каждые 5 минут — обновляем galочки has-photo-recent (24-часовое окно)
  _badgeTimer = setInterval(() => {
    if (state.currentPage === 'products') refreshAllPhotoBadges();
  }, 5 * 60 * 1000);
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
  showToast('Вы вышли из системы');
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
  $('drawerExcelBtn').addEventListener('click',  () => { close(); setTimeout(openExcelDateModal, 200); });
  $('drawerManagerBtn').addEventListener('click',() => { close(); setTimeout(openManagerPanel, 200); });
  $('installAppBtn').addEventListener('click',   () => { close(); setTimeout(triggerInstallPrompt, 200); });
  $('drawerLogoutBtn').addEventListener('click', () => { close(); setTimeout(handleLogout, 200); });

  // iOS не вызывает beforeinstallprompt, но установка через «Поделиться → На экран Домой» возможна.
  // Поэтому на iOS показываем кнопку всегда (если приложение уже не открыто как standalone).
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (isIOS && !isStandalone) {
    $('installAppBtn').style.display = '';
  }

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
    if (outCnt > 0)      extra = ` • ${outCnt} нет`;
    else if (lowCnt > 0) extra = ` • ${lowCnt} мало`;
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
      $('tabData').style.display  = tabId === 'data'  ? 'block' : 'none';
      if (tabId === 'data') updateCleanupBtnLabel();
    });
  });

  $('clearLogsBtn').addEventListener('click', async () => {
    await fbClearLogs();
    state.logs = [];
    renderManagerLogs();
    showToast('Журнал очищен');
  });

  // Резервная копия и очистка
  $('backupDownloadBtn').addEventListener('click', downloadBackup);
  $('backupRestoreBtn').addEventListener('click', () => $('backupRestoreInput').click());
  $('backupRestoreInput').addEventListener('change', restoreBackup);
  $('cleanupOldProofsBtn').addEventListener('click', () => cleanupOldProofs(true));

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
    if (acc.role === 'manager') { showToast('Нельзя удалить аккаунт менеджера', 'error'); return; }
    if (acc.id === state.currentUser.id) { showToast('Нельзя удалить собственный аккаунт', 'error'); return; }
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
    showToast(`Аккаунт «${acc.name}» удалён`);
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
              ${isMgr ? 'Менеджер' : BRANCH_LABELS[acc.branch]}
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
  showToast(credentialsChanged ? 'Сохранено. Старая сессия закрыта.' : 'Сохранено');

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
    list.innerHTML = '<div class="log-empty">Журнал пуст</div>';
    return;
  }

  list.innerHTML = state.logs.slice(0, 200).map(log => {
    const info = LOG_TYPES[log.type] || { icon: '?', label: log.type };
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
   КАТЕГОРИИ — управление (CRUD)
   Менеджер может добавлять, переименовывать, удалять.
=========================================================== */

/* Обновляем все выпадающие списки и фильтры категорий */
function refreshCategoryDropdowns() {
  const cats = getCategoriesSorted();

  // Выпадающий список в фильтре
  const filterSel = $('filterCategorySelect');
  if (filterSel) {
    const current = state.categoryFilter || filterSel.value || 'all';
    filterSel.innerHTML =
      '<option value="all">Все категории</option>' +
      cats.map(c => `<option value="${escHtml(c.id)}">${escHtml(c.label)}</option>`).join('');
    filterSel.value = current;
  }

  // Выпадающий список в форме редактирования товара
  const editSel = $('editCategory');
  if (editSel) {
    const current = editSel.value || 'other';
    editSel.innerHTML = cats.map(c =>
      `<option value="${escHtml(c.id)}">${escHtml(c.label)}</option>`
    ).join('');
    editSel.value = cats.find(c => c.id === current) ? current : (cats[0]?.id || 'other');
  }

  // Фильтр категорий на странице отчётов
  const reportsCatBox = $('reportsCategoryFilters');
  if (reportsCatBox) {
    const active = state.reportsCategoryFilter || 'all';
    reportsCatBox.innerHTML =
      `<button class="reports-filter-btn ${active === 'all' ? 'active' : ''}" data-cfilter="all">Все</button>` +
      cats.map(c =>
        `<button class="reports-filter-btn ${active === c.id ? 'active' : ''}" data-cfilter="${escHtml(c.id)}">${escHtml(c.label)}</button>`
      ).join('');
    // Заново навешиваем обработчики
    reportsCatBox.querySelectorAll('.reports-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        reportsCatBox.querySelectorAll('.reports-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.reportsCategoryFilter = btn.dataset.cfilter;
        renderReportsPage();
      });
    });
  }
}

function openCategoriesModal() {
  if (!isManager()) return;
  renderCategoriesList();
  $('newCategoryName').value = '';
  $('catError').textContent = '';
  openOverlay($('categoriesModal'));
  setTimeout(() => $('newCategoryName').focus(), 200);
}

function renderCategoriesList() {
  const box = $('categoriesList');
  if (!box) return;
  const cats = getCategoriesSorted();
  if (!cats.length) {
    box.innerHTML = '<div class="log-empty">Нет категорий</div>';
    return;
  }
  box.innerHTML = cats.map(c => {
    const usageCount = state.products.filter(p => (p.category || 'other') === c.id).length;
    return `
      <div class="category-row" data-cid="${escHtml(c.id)}">
        <input class="category-row__input" type="text" value="${escHtml(c.label)}" data-cid="${escHtml(c.id)}"/>
        <span class="category-row__count" title="Используется в товарах">${usageCount}</span>
        <button class="category-row__del" data-cid="${escHtml(c.id)}" title="Удалить">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
          </svg>
        </button>
      </div>`;
  }).join('');

  // Сохранение при изменении подписи
  box.querySelectorAll('.category-row__input').forEach(inp => {
    inp.addEventListener('blur', async () => {
      const id = inp.dataset.cid;
      const label = inp.value.trim();
      if (!label) {
        inp.value = getCategoryLabel(id);
        return;
      }
      const cat = state.categories.find(c => c.id === id);
      if (!cat || cat.label === label) return;
      await fbUpdateCategory(id, { label });
      await writeLog('userEdit', `Категория переименована: ${cat.label} → ${label}`);
      showToast('Сохранено', 'success');
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
    });
  });

  // Удаление
  box.querySelectorAll('.category-row__del').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.cid;
      const cat = state.categories.find(c => c.id === id);
      if (!cat) return;
      const usage = state.products.filter(p => (p.category || 'other') === id).length;
      if (usage > 0) {
        if (!confirm(`Категория "${cat.label}" используется в ${usage} товар(ах). Удалить? Товары перейдут в "Прочее".`)) return;
      } else {
        if (!confirm(`Удалить категорию "${cat.label}"?`)) return;
      }
      deleteCategoryAndReassign(id);
    });
  });
}

async function addCategory() {
  if (!isManager()) return;
  const name = $('newCategoryName').value.trim();
  if (!name) {
    $('catError').textContent = 'Введите название категории';
    return;
  }
  if (name.length > 40) {
    $('catError').textContent = 'Слишком длинное название (макс. 40 символов)';
    return;
  }
  // Проверка уникальности
  const dup = state.categories.find(c => c.label.toLowerCase() === name.toLowerCase());
  if (dup) {
    $('catError').textContent = 'Такая категория уже существует';
    return;
  }
  const newId = 'cat_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const maxOrder = Math.max(0, ...state.categories.map(c => c.order || 0));
  const newCat = { id: newId, label: name, order: maxOrder + 1 };
  await fbSaveCategory(newCat);
  await writeLog('userEdit', `Добавлена категория: ${name}`);
  $('newCategoryName').value = '';
  $('catError').textContent = '';
  showToast('Категория добавлена', 'success');
  // renderCategoriesList сработает автоматически после обновления state.categories через onValue
}

async function deleteCategoryAndReassign(catId) {
  if (!isManager()) return;
  // Переназначаем все товары этой категории на 'other'
  const affected = state.products.filter(p => (p.category || 'other') === catId);
  for (const p of affected) {
    p.category = 'other';
    await fbSaveProduct(p);
  }
  await fbDeleteCategory(catId);
  await writeLog('userEdit', `Удалена категория (${affected.length} товаров → Прочее)`);
  showToast('Категория удалена', 'success');
}

async function fbSaveCategory(cat) {
  try { await set(ref(db, `categories/${cat.id}`), cat); }
  catch (e) { console.error('Save category error:', e); showToast('Ошибка сохранения', 'error'); }
}
async function fbUpdateCategory(id, patch) {
  try { await update(ref(db, `categories/${id}`), patch); }
  catch (e) { console.error('Update category error:', e); }
}
async function fbDeleteCategory(id) {
  try { await remove(ref(db, `categories/${id}`)); }
  catch (e) { console.error('Delete category error:', e); }
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

  // Поиск по названию
  if (state.searchQuery && state.searchQuery.trim()) {
    const q = state.searchQuery.trim().toLowerCase();
    list = list.filter(p => (p.name || '').toLowerCase().includes(q));
  }

  // Фильтр по категории
  if (state.categoryFilter && state.categoryFilter !== 'all') {
    list = list.filter(p => (p.category || 'other') === state.categoryFilter);
  }

  // Фильтр по остатку
  if (state.stockFilter !== 'all') {
    list = list.filter(p => getStockStatus(getQty(p, branch)) === state.stockFilter);
  }

  // Сортировка. 'manual' = сохраняем порядок добавления (по createdAt),
  // т.е. товары НЕ перепрыгивают при изменении количества.
  switch (state.sortMode) {
    case 'name':     list.sort((a, b) => a.name.localeCompare(b.name, 'ru')); break;
    case 'qty-asc':  list.sort((a, b) => getQty(a, branch) - getQty(b, branch)); break;
    case 'qty-desc': list.sort((a, b) => getQty(b, branch) - getQty(a, branch)); break;
    case 'manual':
    default:
      list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      break;
  }

  return list;
}

/* ===========================================================
   FILTER BAR
=========================================================== */
function initFilters() {
  // Поиск в шапке (toolbar) — теперь главное место для поиска товаров
  const inp = $('headerSearchInput');
  const clearBtn = $('headerSearchClear');
  if (!inp) return;

  let searchTimer = null;
  inp.addEventListener('input', () => {
    const v = inp.value;
    if (clearBtn) clearBtn.style.display = v ? 'flex' : 'none';
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.searchQuery = v;
      updateFilterBadge();
      renderAll();
    }, 180);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      inp.value = '';
      clearBtn.style.display = 'none';
      state.searchQuery = '';
      updateFilterBadge();
      renderAll();
      inp.focus();
    });
  }
}

function initFilterModal() {
  const modal = $('filterModal');
  $('filterBtn').addEventListener('click', openFilterModal);
  $('filterModalClose').addEventListener('click', () => closeOverlay(modal));
  modal.addEventListener('click', e => { if (e.target === modal) closeOverlay(modal); });

  // Чипы статуса остатков
  modal.querySelectorAll('.filter-stock').forEach(chip => {
    chip.addEventListener('click', () => {
      modal.querySelectorAll('.filter-stock').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.stockFilter = chip.dataset.stock;
      updateFilterBadge();
      renderAll();
    });
  });

  // Категории
  $('filterCategorySelect').addEventListener('change', () => {
    state.categoryFilter = $('filterCategorySelect').value;
    updateFilterBadge();
    renderAll();
  });

  // Кнопка «Управлять» категориями — только менеджер
  $('filterManageCatsBtn').addEventListener('click', () => {
    closeOverlay(modal);
    setTimeout(openCategoriesModal, 200);
  });

  // Сортировка
  $('filterSortSelect').addEventListener('change', () => {
    state.sortMode = $('filterSortSelect').value;
    updateFilterBadge();
    renderAll();
  });

  $('filterResetBtn').addEventListener('click', () => {
    state.stockFilter = 'all';
    state.categoryFilter = 'all';
    state.searchQuery = '';
    state.sortMode    = 'manual';
    // Сбрасываем поле поиска в шапке
    const hsi = $('headerSearchInput');
    const hsc = $('headerSearchClear');
    if (hsi) hsi.value = '';
    if (hsc) hsc.style.display = 'none';
    $('filterSortSelect').value = 'manual';
    $('filterCategorySelect').value = 'all';
    modal.querySelectorAll('.filter-stock').forEach(c => c.classList.remove('active'));
    modal.querySelector('.filter-stock[data-stock="all"]').classList.add('active');
    updateFilterBadge();
    refreshFilterModalCounts();
    renderAll();
    showToast('Фильтры сброшены');
  });

  $('filterApplyBtn').addEventListener('click', () => {
    closeOverlay(modal);
  });

  // Модалка категорий
  $('categoriesModalClose').addEventListener('click', () => closeOverlay($('categoriesModal')));
  $('categoriesModal').addEventListener('click', e => {
    if (e.target === $('categoriesModal')) closeOverlay($('categoriesModal'));
  });
  $('addCategoryBtn').addEventListener('click', addCategory);
  $('newCategoryName').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addCategory(); }
  });
}

function openFilterModal() {
  document.querySelectorAll('.filter-stock').forEach(c => {
    c.classList.toggle('active', c.dataset.stock === state.stockFilter);
  });
  $('filterSortSelect').value = state.sortMode;
  $('filterCategorySelect').value = state.categoryFilter;
  // Кнопку «Управлять категориями» показываем только менеджеру
  $('filterManageCatsBtn').style.display = isManager() ? '' : 'none';
  refreshFilterModalCounts();
  openOverlay($('filterModal'));
}

function refreshFilterModalCounts() {
  const branch = state.activeBranch;
  // Считаем по текущим (но без stock filter — чтобы видеть распределение)
  let base = [...state.products];
  if (state.searchQuery && state.searchQuery.trim()) {
    const q = state.searchQuery.trim().toLowerCase();
    base = base.filter(p => (p.name || '').toLowerCase().includes(q));
  }
  if (state.categoryFilter && state.categoryFilter !== 'all') {
    base = base.filter(p => (p.category || 'other') === state.categoryFilter);
  }
  let all = base.length, ok = 0, low = 0, out = 0;
  base.forEach(p => {
    const q = getQty(p, branch);
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
  $('filterSubtitle').textContent = branchLabel;
}

function updateFilterBadge() {
  const badge = $('filterBadge');
  let count = 0;
  if (state.stockFilter !== 'all')    count++;
  if (state.categoryFilter !== 'all') count++;
  if (state.searchQuery && state.searchQuery.trim()) count++;
  if (state.sortMode    !== 'manual') count++;
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

  // Клик по карточке: только менеджер открывает редактирование.
  // Сотрудник не открывает ничего — все действия через степпер и иконку камеры.
  $('productsGrid').querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', e => {
      // Игнорируем клики на интерактивных элементах внутри карточки
      if (e.target.closest('.product-card__camera-btn')) return;
      if (e.target.closest('.product-card__stepper')) return;
      if (!isManager()) return;
      openEditModal(card.dataset.id);
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

  // Поле количества на карточке сотрудника:
  // — клик не пробрасывается на карточку
  // — при фокусе значение выделяется
  // — при blur/Enter если ЦИФРА ИЗМЕНИЛАСЬ — открываем выбор фото
  //   и сохранение происходит ТОЛЬКО после получения фото-доказательства.
  //   Если фото не выбрано — значение откатывается к исходному.
  $('productsGrid').querySelectorAll('[data-qty-input]').forEach(inp => {
    inp.addEventListener('click', e => e.stopPropagation());
    inp.addEventListener('focus', e => {
      e.stopPropagation();
      // Запоминаем исходное значение чтобы можно было откатить если фото не выбрано
      inp.dataset.originalValue = inp.value;
      try { inp.select(); } catch (_) {}
      try { inp.setSelectionRange(0, inp.value.length); } catch (_) {}
    });
    inp.addEventListener('blur', () => {
      const id = inp.dataset.qtyInput;
      const original = parseInt(inp.dataset.originalValue, 10) || 0;
      let v = Math.max(0, parseInt(inp.value, 10) || 0);
      inp.value = v;
      // Не изменилось — ничего не делаем
      if (v === original) return;
      // Изменилось → требуем фото-доказательство
      requestPhotoForQtyChange(id, v, original, inp);
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
    });
  });
}

/**
 * Запрашивает фото-доказательство для изменения количества.
 * Сохраняет контекст в state.pendingQtyChange и открывает выбор Камера/Галерея.
 * Дальше — initPhotoChoiceSheet обрабатывает выбор файла или отмену.
 */
function requestPhotoForQtyChange(productId, newQty, originalQty, inputEl) {
  state.pendingQtyChange = { productId, newQty, originalQty, inputEl };
  state.pendingPhotoForProductId = productId;
  const sheet = $('photoChoiceSheet');
  if (sheet) {
    sheet.classList.add('active');
    // Показываем явное сообщение что фото обязательно
    const hint = sheet.querySelector('.photo-choice-sheet__hint');
    if (hint) hint.textContent = `Фото обязательно: ${originalQty} → ${newQty} шт`;
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
  const showNorm = isManager(); // норма видна ТОЛЬКО менеджеру
  let branchesHtml = '';
  if (showAllBranches) {
    branchesHtml = BRANCH_KEYS.map(k => {
      const bqty = product.branches?.[k] ?? 0;
      const btarget = product.targets?.[k] ?? 0;
      const cls  = bqty === 0 ? 'branch-row__qty--out' : bqty <= 3 ? 'branch-row__qty--low' : '';
      // Скромная норма серым, в скобках — только для менеджера
      const normHint = (showNorm && btarget > 0)
        ? `<span class="branch-row__norm">(норма: ${btarget})</span>`
        : '';
      return `
        <div class="branch-row">
          <span class="branch-row__label">${BRANCH_LABELS[k]}</span>
          <span class="branch-row__qty-wrap">
            <span class="branch-row__qty ${cls}">${bqty} шт</span>
            ${normHint}
          </span>
        </div>`;
    }).join('');
  } else {
    const cls = qty === 0 ? 'branch-row__qty--out' : qty <= 3 ? 'branch-row__qty--low' : '';
    const branchLabel = isManager() ? BRANCH_LABELS[branch] : 'Остаток';
    const normHint = (showNorm && target > 0)
      ? `<span class="branch-row__norm">(норма: ${target})</span>`
      : '';
    branchesHtml = `
      <div class="branch-row">
        <span class="branch-row__label">${branchLabel}</span>
        <span class="branch-row__qty-wrap">
          <span class="branch-row__qty ${cls}">${qty} шт</span>
          ${normHint}
        </span>
      </div>`;
  }

  // Блок «Должно быть / Норма» удалён полностью — норма теперь скромно под штуками

  // Иконка камеры (только для сотрудника) — для прикрепления фото-доказательства
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

  // Степпер внизу карточки (только для сотрудника)
  // Значение в инпуте — это ТЕКУЩИЙ ввод за СЕГОДНЯ.
  // Если последний ввод был вчера или раньше → 0 (новый день, новый отсчёт).
  let stepperHtml = '';
  if (isStaff()) {
    const inputQty = getCurrentInputQty(product, branch);
    stepperHtml = `
      <div class="product-card__stepper product-card__stepper--simple" data-stepper-for="${product.id}">
        <input
          type="number"
          class="product-card__stepper-input product-card__stepper-input--solo"
          data-qty-input="${product.id}"
          value="${inputQty}"
          min="0"
          inputmode="numeric"
          aria-label="Количество (шт)"
        />
        <span class="product-card__stepper-unit">шт</span>
      </div>`;
  }

  // «Вчера: X шт» — видно ВСЕМ (и сотруднику, и менеджеру).
  // Для сотрудника — по его филиалу.
  // Для менеджера: если активен конкретный филиал — по нему,
  //                если активны «Все филиалы» — берём самый свежий по всем филиалам.
  let yesterdayHtml = '';
  let yest = null;
  if (isStaff()) {
    yest = getYesterdayInfo(product, branch);
  } else {
    // Менеджер
    if (branch === 'all') {
      // Берём самый свежий "вчера-или-раньше" из всех филиалов
      let best = null;
      for (const k of BRANCH_KEYS) {
        const y = getYesterdayInfo(product, k);
        if (y && (!best || y.ts > best.ts)) {
          best = { ...y, branch: k };
        }
      }
      yest = best;
    } else {
      yest = getYesterdayInfo(product, branch);
    }
  }
  if (yest) {
    // Для менеджера в режиме «все филиалы» добавим название филиала в подпись
    const branchSuffix = (!isStaff() && branch === 'all' && yest.branch)
      ? ` <span class="product-card__yesterday-branch">· ${BRANCH_LABELS[yest.branch] || ''}</span>`
      : '';
    yesterdayHtml = `
      <div class="product-card__yesterday">
        <span class="product-card__yesterday-label">${escHtml(yest.label)}:</span>
        <span class="product-card__yesterday-qty">${yest.qty} шт</span>${branchSuffix}
      </div>`;
  }

  // Класс has-photo-recent: горит зелёным 24 часа после загрузки фото-отчёта.
  // Для сотрудника проверяем по его филиалу, для менеджера — по активному (или any).
  const myBranchForProof = isStaff() ? userBranch() : (branch === 'all' ? null : branch);
  const photoRecent = hasRecentProof(product.id, myBranchForProof);

  return `
    <div class="product-card ${photoRecent ? 'has-photo-recent' : ''}" data-id="${product.id}" style="animation-delay:${delay}ms">
      <div class="product-card__image-wrap">
        ${imageHtml}
        ${cameraBtnHtml}
      </div>
      <div class="product-card__body">
        <div class="product-card__name">${escHtml(product.name)}</div>
        ${yesterdayHtml}
        ${isStaff() ? '' : `<div class="product-card__branches">${branchesHtml}</div>`}
      </div>
      ${stepperHtml}
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

  // Контекст: текущий активный филиал менеджера (может быть 'all')
  const activeBranch = state.activeBranch;
  const isAll = activeBranch === 'all';

  if (productId) {
    const p = state.products.find(pr => pr.id === productId);
    if (!p) return;
    $('editName').value     = p.name;
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
        : `<div style="width:100%;height:100%;display:grid;place-items:center;color:var(--text-muted)">—</div>`;
      $('lastProofBody').innerHTML = `
        <div class="last-proof-info__photo" data-proof-id="${escHtml(lastProof.id)}">${photoHtml}</div>
        <div class="last-proof-info__details">
          <div><strong>${escHtml(lastProof.userName)}</strong> (${branchLabel})</div>
          <div>${formatRelative(lastProof.ts)} · ${lastProof.qty} шт${lastProof.target ? ` / норма ${lastProof.target}` : ''}</div>
          ${lastProof.comment ? `<div style="margin-top:4px;font-style:italic;">«${escHtml(lastProof.comment)}»</div>` : ''}
        </div>`;
      $('lastProofInfo').style.display = '';
      const photoEl = $('lastProofBody').querySelector('.last-proof-info__photo');
      if (photoEl) photoEl.addEventListener('click', () => openLightbox(lastProof));
    }
  } else {
    $('editName').value = '';
    // Категория по умолчанию — первая из доступных, либо 'other'
    const cats = getCategoriesSorted();
    $('editCategory').value = cats[0]?.id || 'other';
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

  // ВЫБОР ФИЛИАЛА при добавлении нового товара:
  // Если менеджер на конкретном филиале — товар добавляется именно туда (поле скрыто).
  // Если на «Все филиалы» — показываем выбор.
  const branchSelectWrap = $('editBranchSelectWrap');
  if (!productId) {
    // Создание нового товара
    if (isAll) {
      branchSelectWrap.style.display = '';
      $('editBranchSelect').value = 'branch1';
    } else {
      branchSelectWrap.style.display = 'none';
      $('editBranchSelect').value = activeBranch;
    }
  } else {
    branchSelectWrap.style.display = 'none';
  }

  // ПОКАЗ ФИЛИАЛОВ В ФОРМЕ КОЛИЧЕСТВА:
  // — При создании: показываем только выбранный филиал (или все, если 'all')
  // — При редактировании существующего: показываем только активный филиал
  //   (если 'all' — показываем все три)
  const showAllBranchFields = isAll;
  document.querySelectorAll('#branchesQtyGrid .branch-qty-item').forEach(item => {
    if (showAllBranchFields) {
      item.style.display = '';
    } else {
      item.style.display = (item.dataset.branch === activeBranch) ? '' : 'none';
    }
  });
  document.querySelectorAll('#targetSection .branch-qty-item').forEach(item => {
    if (showAllBranchFields) {
      item.style.display = '';
    } else {
      item.style.display = (item.dataset.branch === activeBranch) ? '' : 'none';
    }
  });

  // Заголовок блока остатков
  if (showAllBranchFields) {
    $('branchesQtyTitle').textContent = 'Остаток по филиалам (фактически, шт)';
  } else {
    $('branchesQtyTitle').textContent = `Остаток на филиале «${BRANCH_LABELS[activeBranch]}» (шт)`;
  }
  // Заголовок блока норм
  const targetTitle = document.querySelector('#targetSection .branches-qty-title');
  if (targetTitle) {
    if (showAllBranchFields) {
      targetTitle.textContent = 'Должно быть (норма по филиалам, шт)';
    } else {
      targetTitle.textContent = `Норма для «${BRANCH_LABELS[activeBranch]}» (шт)`;
    }
  }

  // Подсказки норма vs факт
  updateStockHints();
  ['qty1','qty2','qty3','target1','target2','target3'].forEach(id => {
    const el = $(id);
    if (el && !el._hintListenerAttached) {
      el.addEventListener('input', updateStockHints);
      el._hintListenerAttached = true;
    }
  });

  // Обработчик переключения филиала при создании (показывает соответствующее поле количества)
  const branchSel = $('editBranchSelect');
  if (branchSel && !branchSel._listenerAttached) {
    branchSel.addEventListener('change', () => {
      if (state.editingProductId) return; // только при создании
      const chosen = branchSel.value;
      // Если мы в режиме «выбор филиала» (т.е. 'all') — переключаем видимость
      if (state.activeBranch === 'all') {
        document.querySelectorAll('#branchesQtyGrid .branch-qty-item, #targetSection .branch-qty-item').forEach(item => {
          item.style.display = (item.dataset.branch === chosen) ? '' : 'none';
        });
        $('branchesQtyTitle').textContent = `Остаток на филиале «${BRANCH_LABELS[chosen]}» (шт)`;
        if (targetTitle) targetTitle.textContent = `Норма для «${BRANCH_LABELS[chosen]}» (шт)`;
      }
    });
    branchSel._listenerAttached = true;
  }
  // При создании с активным филиалом 'all' — сразу применяем фильтр видимости по выбранному branchSel
  if (!productId && isAll) {
    const chosen = branchSel.value;
    document.querySelectorAll('#branchesQtyGrid .branch-qty-item, #targetSection .branch-qty-item').forEach(item => {
      item.style.display = (item.dataset.branch === chosen) ? '' : 'none';
    });
    $('branchesQtyTitle').textContent = `Остаток на филиале «${BRANCH_LABELS[chosen]}» (шт)`;
    if (targetTitle) targetTitle.textContent = `Норма для «${BRANCH_LABELS[chosen]}» (шт)`;
  }

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
      hintEl.textContent = `Норма: ${target} (не хватает ${Math.abs(diff)})`;
      hintEl.className = 'branch-qty-target-hint hint-low';
    } else {
      hintEl.textContent = `Норма: ${target}`;
      hintEl.className = 'branch-qty-target-hint hint-ok';
    }
  });
}

async function saveProduct() {
  // Эта функция вызывается только менеджером (форма редактирования товара)
  if (!isManager()) {
    showToast('Только менеджер может редактировать товары', 'error');
    return;
  }

  const isEdit  = !!state.editingProductId;
  const activeBranch = state.activeBranch;
  const isAll = activeBranch === 'all';

  const name = $('editName').value.trim();
  if (!name) {
    $('editName').style.borderColor = 'var(--danger)';
    $('editName').focus();
    showToast('Введите название товара', 'error');
    return;
  }
  $('editName').style.borderColor = '';

  const original = isEdit ? state.products.find(p => p.id === state.editingProductId) : null;

  // ===== ПОСТРОЕНИЕ ВЕТОК ОСТАТКОВ И НОРМ =====
  // При редактировании существующего товара с активным филиалом —
  // меняем ТОЛЬКО этот филиал, остальные оставляем как были.
  // При создании нового — товар идёт в выбранный филиал (остальные = 0).
  // При активном «все филиалы» — меняются/задаются все три.

  let branches = original ? { ...(original.branches || {}) } : { branch1: 0, branch2: 0, branch3: 0 };
  let targets  = original ? { ...(original.targets  || {}) } : { branch1: 0, branch2: 0, branch3: 0 };
  // На всякий случай гарантируем все три ключа
  BRANCH_KEYS.forEach(k => {
    if (typeof branches[k] !== 'number') branches[k] = 0;
    if (typeof targets[k]  !== 'number') targets[k]  = 0;
  });

  if (!isEdit) {
    // СОЗДАНИЕ нового товара
    if (isAll) {
      // Менеджер на «все филиалы» — выбирает один филиал через editBranchSelect
      const chosen = $('editBranchSelect').value || 'branch1';
      // Сбрасываем всё в 0, и заполняем только выбранный филиал
      branches = { branch1: 0, branch2: 0, branch3: 0 };
      targets  = { branch1: 0, branch2: 0, branch3: 0 };
      const qtyId = 'qty' + (BRANCH_KEYS.indexOf(chosen) + 1);
      const tgtId = 'target' + (BRANCH_KEYS.indexOf(chosen) + 1);
      branches[chosen] = Math.max(0, parseInt($(qtyId).value, 10) || 0);
      targets[chosen]  = Math.max(0, parseInt($(tgtId).value, 10) || 0);
    } else {
      // Активный конкретный филиал — туда и добавляем
      branches = { branch1: 0, branch2: 0, branch3: 0 };
      targets  = { branch1: 0, branch2: 0, branch3: 0 };
      const qtyId = 'qty' + (BRANCH_KEYS.indexOf(activeBranch) + 1);
      const tgtId = 'target' + (BRANCH_KEYS.indexOf(activeBranch) + 1);
      branches[activeBranch] = Math.max(0, parseInt($(qtyId).value, 10) || 0);
      targets[activeBranch]  = Math.max(0, parseInt($(tgtId).value, 10) || 0);
    }
  } else {
    // РЕДАКТИРОВАНИЕ существующего товара
    if (isAll) {
      // Видны все три филиала — обновляем все
      BRANCH_KEYS.forEach((k, idx) => {
        branches[k] = Math.max(0, parseInt($('qty' + (idx + 1)).value, 10) || 0);
        targets[k]  = Math.max(0, parseInt($('target' + (idx + 1)).value, 10) || 0);
      });
    } else {
      // Виден только активный филиал — меняем только его
      const idx = BRANCH_KEYS.indexOf(activeBranch);
      branches[activeBranch] = Math.max(0, parseInt($('qty' + (idx + 1)).value, 10) || 0);
      targets[activeBranch]  = Math.max(0, parseInt($('target' + (idx + 1)).value, 10) || 0);
    }
  }

  const product = {
    id:          state.editingProductId || uid(),
    name,
    category:    $('editCategory').value || 'other',
    description: original?.description || '', // поле описания удалено из UI, но сохраняем совместимость
    photo:       state.photoDataUrl,
    branches,
    targets,
    // createdAt — нужен для стабильной «manual» сортировки
    createdAt:   original?.createdAt || Date.now(),
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
    showToast('Сохранено', 'success');
  } else {
    // НЕ unshift! Добавляем в конец, чтобы порядок «как добавили» работал стабильно
    state.products.push(product);
    showToast('Товар добавлен', 'success');
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
  if (!isManager()) { showToast('Удаление доступно только менеджеру', 'error'); return; }
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
    showToast(`"${name}" удалён`, 'success');
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
      <th style="width:60px">Фото</th><th>Товар</th>
      ${BRANCH_KEYS.map(k => `<th style="text-align:center">${BRANCH_LABELS[k]}<br><small style="font-weight:400;color:#888">факт / норма</small></th>`).join('')}
      <th>Итого</th>`;
  } else {
    thead.innerHTML = `<th style="width:60px">Фото</th><th>Товар</th><th style="text-align:center">Факт</th><th style="text-align:center">Норма</th>`;
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
    // Без описания и без столбца категории — только название и данные
    return `
      <tr>
        <td>${imgHtml}</td>
        <td>
          <div class="print-td-name">${escHtml(p.name)}</div>
        </td>
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
        showToast('Отчёты доступны только менеджеру', 'error');
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

  // При уходе со страницы галереи — сбрасываем режим выбора
  if (page !== 'gallery' && state.gallerySelectMode) {
    exitGallerySelectMode();
  }

  if (page === 'products')      renderAll();
  else if (page === 'gallery')  renderGalleryPage();
  else if (page === 'reports')  renderReportsPage();
}

/* ===========================================================
   INSTANT QTY SAVE — мгновенное сохранение остатка с карточки
   Сотрудник нажимает +/− или вводит число вручную → сразу пишется в БД.
   Если есть прикреплённое фото — отправляется как отчёт-доказательство.
   Если фото нет — просто обновляется количество (и лог qtyEdit).
=========================================================== */

// Debounce-сохранения, чтобы быстрые тапы по +/− не спамили сеть
const _qtySaveTimers = new Map();

// Возвращает true, если сейчас не следует делать полный ререндер карточек
// (пользователь работает с инпутом или ждёт ответа сети)
/**
 * Можно ли обновить страницу «мягко» — без полного ререндера и без перепрыгивания товаров?
 * Возвращает true, если изменились ТОЛЬКО остатки (branches) или нормы (targets)
 * у уже существующих товаров. Если добавили/удалили товар, поменяли имя/фото/категорию —
 * нужен полный ререндер.
 */
function canDoSoftUpdate(prev, next) {
  if (!prev) return false; // первая загрузка — нужен полный рендер
  if (prev.length !== next.length) return false;

  // Индексируем prev по id для быстрой проверки
  const prevById = new Map(prev.map(p => [p.id, p]));
  for (const np of next) {
    const op = prevById.get(np.id);
    if (!op) return false;             // появился новый id
    if (op.name !== np.name) return false;
    if (op.category !== np.category) return false;
    if (op.photo !== np.photo) return false;
    // branches и targets могут меняться — это и есть «мягкое» обновление, разрешаем
  }
  return true;
}

function shouldDoPartialUpdate() {
  if (!isStaff()) return false;
  if (state.currentPage !== 'products') return false;
  if (_qtySaveTimers.size > 0) return true;
  const active = document.activeElement;
  if (active && active.matches?.('[data-qty-input]')) return true;
  return false;
}

function saveQtyInstant(productId, newQty) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  const myBranch = userBranch();
  const oldQty = product.branches?.[myBranch] ?? 0;

  newQty = Math.max(0, parseInt(newQty, 10) || 0);
  if (newQty === oldQty) return; // ничего не изменилось

  const now = Date.now();
  const userName = state.currentUser?.name || state.currentUser?.username || '';

  // Обновляем lastEntries — запоминаем кто/когда вводил.
  // Это и есть «Вчера: X шт» на следующий день.
  const lastEntries = { ...(product.lastEntries || {}) };
  lastEntries[myBranch] = { qty: newQty, ts: now, userName };

  // Сразу обновляем локально, чтобы UI откликался мгновенно
  const updated = {
    ...product,
    branches: { ...product.branches, [myBranch]: newQty },
    lastEntries,
  };
  const idx = state.products.findIndex(p => p.id === productId);
  if (idx > -1) state.products[idx] = updated;
  saveLocal(STORAGE_KEY, state.products);

  // Мгновенно обновляем отображение остатка на самой карточке (без полного ререндера)
  updateCardQtyDisplay(productId);

  // Откладываем запись в Firebase на 350мс — чтобы спам кликов слился в одну запись
  if (_qtySaveTimers.has(productId)) clearTimeout(_qtySaveTimers.get(productId));
  _qtySaveTimers.set(productId, setTimeout(async () => {
    _qtySaveTimers.delete(productId);
    const target = product.targets?.[myBranch] ?? 0;

    try {
      // Простое обновление количества — пишем лог qtyEdit.
      // Отчёты-доказательства с фото уходят отдельно через submitProofForProduct().
      await writeLog('qtyEdit',
        `"${product.name}": ${oldQty} → ${newQty} шт${target ? ` (норма ${target})` : ''}`,
        { productId, productName: product.name, oldQty, newQty, target });
      await fbSaveProduct(updated);
      showToast(`Сохранено: ${newQty} шт`, 'success');

      // Зелёная вспышка
      const inp = document.querySelector(`[data-qty-input="${productId}"]`);
      if (inp) {
        inp.classList.remove('saved');
        void inp.offsetWidth;
        inp.classList.add('saved');
        setTimeout(() => inp.classList.remove('saved'), 600);
      }
    } catch (err) {
      console.error('saveQtyInstant error', err);
      showToast('Ошибка сохранения, попробуйте ещё раз', 'error');
    }
  }, 350));
}

// Обновляет числа на самой карточке без полного ререндера, чтобы input не «прыгал»
function updateCardQtyDisplay(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  const card = document.querySelector(`.product-card[data-id="${productId}"]`);
  if (!card) return;
  const branch = state.activeBranch;
  const myBranch = isStaff() ? userBranch() : branch;
  const qty = product.branches?.[myBranch] ?? 0;
  const target = product.targets?.[myBranch] ?? 0;

  // Менеджерская строка "Остаток: X шт"
  const qtyCell = card.querySelector('.branch-row__qty');
  if (qtyCell) {
    const cls = qty === 0 ? 'branch-row__qty--out' : qty <= 3 ? 'branch-row__qty--low' : '';
    qtyCell.className = 'branch-row__qty ' + cls;
    qtyCell.textContent = `${qty} шт`;
  }

  // Скромная норма "(норма: X)" — только для менеджера
  if (isManager()) {
    const normCell = card.querySelector('.branch-row__norm');
    const wrap = card.querySelector('.branch-row__qty-wrap');
    if (target > 0) {
      if (normCell) {
        normCell.textContent = `(норма: ${target})`;
      } else if (wrap) {
        const span = document.createElement('span');
        span.className = 'branch-row__norm';
        span.textContent = `(норма: ${target})`;
        wrap.appendChild(span);
      }
    } else if (normCell) {
      normCell.remove();
    }
  }

  // Для сотрудника: обновляем input на «текущее за сегодня»
  if (isStaff()) {
    const inp = card.querySelector(`[data-qty-input="${productId}"]`);
    if (inp && document.activeElement !== inp) {
      inp.value = getCurrentInputQty(product, myBranch);
    }
  } else {
    // Менеджер — простая синхронизация input если есть
    const inp = card.querySelector(`[data-qty-input="${productId}"]`);
    if (inp && document.activeElement !== inp) inp.value = qty;
  }

  // ── Подпись «Вчера: X шт» — обновляем ДЛЯ ВСЕХ (и сотрудника, и менеджера) ──
  let yest = null;
  if (isStaff()) {
    yest = getYesterdayInfo(product, myBranch);
  } else if (branch === 'all') {
    // Берём самый свежий из всех филиалов
    let best = null;
    for (const k of BRANCH_KEYS) {
      const y = getYesterdayInfo(product, k);
      if (y && (!best || y.ts > best.ts)) best = { ...y, branch: k };
    }
    yest = best;
  } else {
    yest = getYesterdayInfo(product, branch);
  }

  const body = card.querySelector('.product-card__body');
  let yestEl = card.querySelector('.product-card__yesterday');
  if (yest) {
    const branchSuffix = (!isStaff() && branch === 'all' && yest.branch)
      ? ` <span class="product-card__yesterday-branch">· ${BRANCH_LABELS[yest.branch] || ''}</span>`
      : '';
    const html = `
      <span class="product-card__yesterday-label">${escHtml(yest.label)}:</span>
      <span class="product-card__yesterday-qty">${yest.qty} шт</span>${branchSuffix}`;
    if (yestEl) {
      yestEl.innerHTML = html;
    } else if (body) {
      const div = document.createElement('div');
      div.className = 'product-card__yesterday';
      div.innerHTML = html;
      const nameEl = body.querySelector('.product-card__name');
      if (nameEl && nameEl.nextSibling) {
        body.insertBefore(div, nameEl.nextSibling);
      } else if (nameEl) {
        nameEl.after(div);
      } else {
        body.appendChild(div);
      }
    }
  } else if (yestEl) {
    yestEl.remove();
  }

  // Обновляем класс has-photo-recent
  const branchForProof = isStaff() ? userBranch() : (branch === 'all' ? null : branch);
  card.classList.toggle('has-photo-recent', hasRecentProof(productId, branchForProof));
}

// Открываем выбор «Камера / Галерея» для товара
function openInlinePhotoChoice(productId) {
  state.pendingPhotoForProductId = productId;
  const sheet = $('photoChoiceSheet');
  if (sheet) sheet.classList.add('active');
}

// Инициализация bottom-sheet выбора «Камера / Галерея»
function initPhotoChoiceSheet() {
  const sheet = $('photoChoiceSheet');
  if (!sheet) return;

  // Закрытие. cancelled=true → откатываем цифру если была ожидающая смена.
  const close = (cancelled = true) => {
    sheet.classList.remove('active');
    // Очищаем подсказку
    const hint = sheet.querySelector('.photo-choice-sheet__hint');
    if (hint) hint.textContent = '';

    if (cancelled && state.pendingQtyChange) {
      // Откатываем цифру в инпуте к исходному значению
      const pc = state.pendingQtyChange;
      if (pc.inputEl) {
        pc.inputEl.value = pc.originalQty;
        pc.inputEl.dataset.originalValue = pc.originalQty;
      }
      showToast('Изменение отменено — фото обязательно', 'error');
      state.pendingQtyChange = null;
    }
    state.pendingPhotoForProductId = null;
  };

  $('photoChoiceCancel').addEventListener('click', () => close(true));
  sheet.addEventListener('click', e => {
    if (e.target === sheet) close(true);
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
    const pendingChange = state.pendingQtyChange;
    fileInput.value = '';

    if (!file || !pid) {
      // Файл не выбран — откатываем как при отмене
      close(true);
      return;
    }
    // Файл выбран — закрываем БЕЗ отката (cancelled=false)
    close(false);

    try {
      const dataUrl = await compressImage(file);
      if (pendingChange && pendingChange.productId === pid) {
        // Это смена количества — сначала применяем новое количество, потом отправляем proof
        applyStaffQtyChange(pid, pendingChange.newQty);
        await submitProofForProduct(pid, dataUrl, pendingChange.newQty);
        state.pendingQtyChange = null;
      } else {
        // Просто внеплановый фото-отчёт (без смены цифры)
        await submitProofForProduct(pid, dataUrl);
      }
    } catch (err) {
      console.error(err);
      showToast('Ошибка загрузки фото', 'error');
      // При ошибке тоже откатываем
      if (pendingChange?.inputEl) {
        pendingChange.inputEl.value = pendingChange.originalQty;
        pendingChange.inputEl.dataset.originalValue = pendingChange.originalQty;
      }
      state.pendingQtyChange = null;
    }
  });
}

/**
 * Применяет новое количество к товару локально (для сотрудника).
 * Используется когда сотрудник меняет цифру через blur — перед отправкой proof.
 */
function applyStaffQtyChange(productId, newQty) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  const myBranch = userBranch();
  const now = Date.now();
  const userName = state.currentUser?.name || state.currentUser?.username || '';

  const lastEntries = { ...(product.lastEntries || {}) };
  lastEntries[myBranch] = { qty: newQty, ts: now, userName };

  const updated = {
    ...product,
    branches: { ...product.branches, [myBranch]: newQty },
    lastEntries,
  };
  const idx = state.products.findIndex(p => p.id === productId);
  if (idx > -1) state.products[idx] = updated;
  saveLocal(STORAGE_KEY, state.products);
  updateCardQtyDisplay(productId);
}

/**
 * Создаёт отчёт-доказательство (proof) для товара.
 * Вызывается СРАЗУ после прикрепления фото — менеджер увидит отчёт в галерее и в отчётах.
 */
async function submitProofForProduct(productId, photoDataUrl, forceQty) {
  const product = state.products.find(p => p.id === productId);
  if (!product) {
    showToast('Товар не найден', 'error');
    return;
  }
  const myBranch = userBranch();
  if (!myBranch) {
    showToast('Не определён ваш филиал', 'error');
    return;
  }
  // Если передан forceQty — используем его (это пришло из ожидающей смены).
  // Иначе берём текущее значение за сегодня (внеплановое фото без смены цифры).
  const myInputQty = (typeof forceQty === 'number')
    ? forceQty
    : getCurrentInputQty(product, myBranch);
  const target = product.targets?.[myBranch] ?? 0;
  const userName = state.currentUser?.name || state.currentUser?.username || '';
  const now = Date.now();

  const proofEntry = {
    id:          uid(),
    productId:   productId,
    productName: product.name,
    category:    product.category || 'other',
    photo:       photoDataUrl,
    qty:         myInputQty,
    target,
    branch:      myBranch,
    userId:      state.currentUser.id,
    userName,
    comment:     '',
    ts:          now,
  };

  try {
    await fbAddProof(proofEntry);
    await writeLog('proofSubmit',
      `"${product.name}": ${myInputQty} шт${target ? ` / норма ${target}` : ''}`,
      { productId, productName: product.name, newQty: myInputQty, target });

    // Обновляем товар: branches + lastEntries (для подписи «Вчера: X»)
    const lastEntries = { ...(product.lastEntries || {}) };
    lastEntries[myBranch] = { qty: myInputQty, ts: now, userName };
    const updated = {
      ...product,
      branches: { ...product.branches, [myBranch]: myInputQty },
      lastEntries,
    };
    const idx = state.products.findIndex(p => p.id === productId);
    if (idx > -1) state.products[idx] = updated;
    saveLocal(STORAGE_KEY, state.products);
    await fbSaveProduct(updated);

    // Визуальная индикация: класс has-photo-recent поставится автоматически
    // при следующем renderAll() благодаря функции hasRecentProof().
    // Делаем мягкий ререндер карточки чтобы галочка появилась сразу.
    updateCardQtyDisplay(productId);
    const card = document.querySelector(`.product-card[data-id="${productId}"]`);
    if (card) card.classList.add('has-photo-recent');

    showToast(`Отчёт отправлен менеджеру: ${myInputQty} шт`, 'success');
  } catch (err) {
    console.error('submitProofForProduct error', err);
    showToast('Ошибка отправки отчёта', 'error');
  }
}

/* ===========================================================
   PROOF MODAL — резервная модалка (больше не используется, но
   функции оставлены на случай повторного включения)
=========================================================== */
function initProofPhotoUpload() {
  const input    = $('proofPhotoInput');
  if (!input) return;
  const camBtn   = $('proofBtnCamera');
  const galBtn   = $('proofBtnGallery');
  const area     = $('proofPhotoArea');
  const removeBtn= $('proofPhotoRemoveBtn');

  if (camBtn) camBtn.addEventListener('click', () => {
    input.setAttribute('capture', 'environment');
    input.click();
  });
  if (galBtn) galBtn.addEventListener('click', () => {
    input.removeAttribute('capture');
    input.click();
  });
  if (area) area.addEventListener('click', e => {
    if (removeBtn && (e.target === removeBtn || removeBtn.contains(e.target))) return;
    input.removeAttribute('capture');
    input.click();
  });

  input.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      state.proofPhotoDataUrl = dataUrl;
      const prev = $('proofPhotoPreview');
      const ph   = $('proofPhotoPlaceholder');
      const rm   = $('proofPhotoRemoveBtn');
      if (prev) { prev.src = dataUrl; prev.style.display = 'block'; }
      if (ph)   ph.style.display = 'none';
      if (rm)   rm.style.display = 'block';
    } catch (err) {
      console.error(err);
      showToast('Ошибка загрузки фото', 'error');
    }
  });

  if (removeBtn) removeBtn.addEventListener('click', e => {
    e.stopPropagation();
    state.proofPhotoDataUrl = null;
    input.value = '';
    const prev = $('proofPhotoPreview');
    const ph   = $('proofPhotoPlaceholder');
    if (prev) prev.style.display = 'none';
    if (ph)   ph.style.display = 'flex';
    removeBtn.style.display = 'none';
  });
}

function initProofEvents() {
  const m = $('proofModal');
  if (!m) return;
  const close = $('proofModalClose');
  const cancel = $('proofCancelBtn');
  const submit = $('proofSubmitBtn');
  if (close)  close.addEventListener('click', () => closeOverlay(m));
  if (cancel) cancel.addEventListener('click', () => closeOverlay(m));
  m.addEventListener('click', e => { if (e.target === m) closeOverlay(m); });
  if (submit) submit.addEventListener('click', submitProof);
}

function openProofModal() { /* не используется */ }
async function submitProof() { /* не используется */ }


/* ===========================================================
   GALLERY PAGE — фотографии товаров с филиалом и датой
=========================================================== */
function initGalleryEvents() {
  document.querySelectorAll('#galleryFilters .reports-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#galleryFilters .reports-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.galleryFilter = btn.dataset.gfilter;
      // При смене фильтра сбрасываем выбор
      state.gallerySelected.clear();
      renderGalleryPage();
    });
  });

  // ── Режим выбора (iPhone-style) ──
  const selectBtn = $('gallerySelectBtn');
  if (selectBtn) {
    selectBtn.addEventListener('click', toggleGallerySelectMode);
  }
  const cancelBtn = $('gallerySelectCancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', exitGallerySelectMode);
  }
  const selectAllBtn = $('gallerySelectAll');
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', selectAllVisibleGalleryItems);
  }
  const shareBtn = $('gallerySelectShare');
  if (shareBtn) {
    shareBtn.addEventListener('click', shareSelectedGalleryItems);
  }
  const delBtn = $('gallerySelectDelete');
  if (delBtn) {
    delBtn.addEventListener('click', deleteSelectedGalleryItems);
  }
}

function renderGalleryPage() {
  const grid    = $('galleryGrid');
  const empty   = $('galleryEmpty');
  const subText = $('galleryPageSub');
  if (!grid) return;

  // Подзаголовок
  if (subText) {
    if (isStaff()) {
      subText.textContent = `Фото товаров вашего филиала`;
    } else {
      subText.textContent = state.galleryFilter === 'all'
        ? 'Все фотографии со всех филиалов'
        : `Фото с филиала «${BRANCH_LABELS[state.galleryFilter]}»`;
    }
  }

  // Фильтрация
  let list = [...state.proofs];
  if (isStaff()) {
    list = list.filter(p => p.branch === userBranch());
  } else if (state.galleryFilter !== 'all') {
    list = list.filter(p => p.branch === state.galleryFilter);
  }

  if (!list.length) {
    grid.innerHTML = '';
    empty.style.display = 'flex';
    updateGalleryActionsBar();
    return;
  }
  empty.style.display = 'none';

  const selecting = state.gallerySelectMode;
  grid.innerHTML = list.map((entry, i) => {
    const delay = Math.min(i * 25, 300);
    const branchLabel = BRANCH_LABELS[entry.branch] || entry.branch;
    const isSelected = state.gallerySelected.has(entry.id);
    return `
      <div class="gallery-card ${selecting ? 'gallery-card--selecting' : ''} ${isSelected ? 'gallery-card--selected' : ''}"
           data-proof-id="${escHtml(entry.id)}" style="animation-delay:${delay}ms">
        <div class="gallery-card__image-wrap">
          <img class="gallery-card__image" src="${entry.photo}" alt="${escHtml(entry.productName)}" loading="lazy"/>
          <span class="gallery-card__branch-badge">${escHtml(branchLabel)}</span>
          <span class="gallery-card__check" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </span>
        </div>
        <div class="gallery-card__body">
          <div class="gallery-card__name">${escHtml(entry.productName)}</div>
          <div class="gallery-card__date">${new Date(entry.ts).toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}</div>
        </div>
      </div>`;
  }).join('');

  // ── Привязка обработчиков для каждой карточки
  grid.querySelectorAll('.gallery-card').forEach(card => {
    const id = card.dataset.proofId;

    // Длинный тап (long-press) на мобильном → включить режим выбора
    let pressTimer = null;
    let isLongPress = false;
    const startPress = () => {
      if (state.gallerySelectMode) return;
      isLongPress = false;
      pressTimer = setTimeout(() => {
        isLongPress = true;
        enterGallerySelectMode();
        toggleGallerySelection(id);
        if (navigator.vibrate) navigator.vibrate(40); // тактильный отклик
      }, 450);
    };
    const cancelPress = () => {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    };
    card.addEventListener('touchstart', startPress, { passive: true });
    card.addEventListener('touchend',   cancelPress);
    card.addEventListener('touchmove',  cancelPress);
    card.addEventListener('touchcancel',cancelPress);
    card.addEventListener('mousedown',  startPress);
    card.addEventListener('mouseup',    cancelPress);
    card.addEventListener('mouseleave', cancelPress);

    // Обычный тап
    card.addEventListener('click', e => {
      if (isLongPress) { isLongPress = false; return; }
      if (state.gallerySelectMode) {
        // В режиме выбора — тап переключает выбор
        toggleGallerySelection(id);
      } else {
        // Обычный режим — открываем lightbox
        const entry = state.proofs.find(p => p.id === id);
        if (entry) openLightbox(entry);
      }
    });
  });

  updateGalleryActionsBar();
}

/* ===========================================================
   ГАЛЕРЕЯ — РЕЖИМ ВЫБОРА (iPhone-style)
=========================================================== */
function enterGallerySelectMode() {
  if (state.gallerySelectMode) return;
  state.gallerySelectMode = true;
  state.gallerySelected.clear();
  document.body.classList.add('gallery-selecting');
  $('galleryActionsBar').classList.add('active');
  $('gallerySelectBtn').classList.add('active');
  $('gallerySelectBtn').querySelector('span').textContent = 'Готово';
  renderGalleryPage();
}

function exitGallerySelectMode() {
  if (!state.gallerySelectMode) return;
  state.gallerySelectMode = false;
  state.gallerySelected.clear();
  document.body.classList.remove('gallery-selecting');
  $('galleryActionsBar').classList.remove('active');
  $('gallerySelectBtn').classList.remove('active');
  $('gallerySelectBtn').querySelector('span').textContent = 'Выбрать';
  renderGalleryPage();
}

function toggleGallerySelectMode() {
  if (state.gallerySelectMode) exitGallerySelectMode();
  else enterGallerySelectMode();
}

function toggleGallerySelection(proofId) {
  if (state.gallerySelected.has(proofId)) {
    state.gallerySelected.delete(proofId);
  } else {
    state.gallerySelected.add(proofId);
  }
  // Обновляем только конкретную карточку и панель — без перерисовки всего
  const card = document.querySelector(`.gallery-card[data-proof-id="${proofId}"]`);
  if (card) card.classList.toggle('gallery-card--selected', state.gallerySelected.has(proofId));
  updateGalleryActionsBar();
}

function selectAllVisibleGalleryItems() {
  // Берём список фото с учётом текущих фильтров — то что реально видно на экране
  let list = [...state.proofs];
  if (isStaff()) {
    list = list.filter(p => p.branch === userBranch());
  } else if (state.galleryFilter !== 'all') {
    list = list.filter(p => p.branch === state.galleryFilter);
  }
  // Если уже все выбраны — снимаем выбор
  const allSelected = list.length > 0 && list.every(p => state.gallerySelected.has(p.id));
  if (allSelected) {
    state.gallerySelected.clear();
  } else {
    list.forEach(p => state.gallerySelected.add(p.id));
  }
  renderGalleryPage();
}

function updateGalleryActionsBar() {
  const count = state.gallerySelected.size;
  const countEl = $('gallerySelectCount');
  if (countEl) countEl.textContent = `Выбрано: ${count}`;
  const shareBtn = $('gallerySelectShare');
  const delBtn   = $('gallerySelectDelete');
  if (shareBtn) shareBtn.disabled = count === 0;
  if (delBtn)   delBtn.disabled   = count === 0;
}

/**
 * Поделиться выбранными фото.
 * Использует Web Share API (на мобильных откроется системное меню «Поделиться»,
 * в котором доступен Telegram, WhatsApp и т.д.).
 * Если Web Share API недоступен — открывается Telegram-ссылка с текстом.
 */
async function shareSelectedGalleryItems() {
  const ids = Array.from(state.gallerySelected);
  if (!ids.length) return;
  const items = ids.map(id => state.proofs.find(p => p.id === id)).filter(Boolean);
  if (!items.length) return;

  // Готовим файлы из base64 dataURL
  const files = [];
  for (const item of items) {
    if (!item.photo) continue;
    try {
      const blob = await dataUrlToBlob(item.photo);
      const safeName = (item.productName || 'photo')
        .replace(/[^\p{L}\p{N}_\- ]/gu, '')
        .replace(/\s+/g, '_')
        .slice(0, 40);
      const fileName = `${safeName}_${new Date(item.ts).toISOString().slice(0,10)}.jpg`;
      files.push(new File([blob], fileName, { type: 'image/jpeg' }));
    } catch (e) {
      console.warn('dataUrl→blob fail', e);
    }
  }

  // Текстовое описание для подписи
  const summary = items.map(it => {
    const dt = new Date(it.ts).toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
    const branch = BRANCH_LABELS[it.branch] || '';
    return `• ${it.productName} — ${it.qty} шт (${branch}, ${dt})`;
  }).join('\n');
  const title = `Отчёт по остаткам — ${items.length} фото`;
  const text = `Склад Mone\n\n${summary}`;

  // Пробуем Web Share API (на iOS/Android это открывает системное меню,
  // включая Telegram, WhatsApp и т.д.)
  if (navigator.canShare && files.length && navigator.canShare({ files })) {
    try {
      await navigator.share({ files, title, text });
      showToast(`Поделено: ${items.length} фото`, 'success');
      return;
    } catch (err) {
      // Пользователь отменил — это нормально
      if (err.name !== 'AbortError') {
        console.warn('share files failed', err);
      } else {
        return; // отмена — выходим без фолбэка
      }
    }
  }

  // Фолбэк: пытаемся поделиться без файлов (только текст)
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      showToast('Текст отправлен. Файлы вложите вручную.', 'success');
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  // Последний фолбэк: открываем Telegram-ссылку с текстом отчёта
  // Файлы пользователю придётся вложить отдельно
  const tgUrl = `https://t.me/share/url?url=${encodeURIComponent('Склад Mone')}&text=${encodeURIComponent(text)}`;
  window.open(tgUrl, '_blank');
  showToast('Открываю Telegram. Фото вложите вручную.', 'success');
}

/** Конвертирует data URL в Blob */
function dataUrlToBlob(dataUrl) {
  return new Promise((resolve, reject) => {
    try {
      const parts = dataUrl.split(',');
      const meta = parts[0];
      const b64  = parts[1];
      const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
      const bin  = atob(b64);
      const len  = bin.length;
      const u8   = new Uint8Array(len);
      for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
      resolve(new Blob([u8], { type: mime }));
    } catch (e) { reject(e); }
  });
}

/** Удалить выбранные фото-отчёты */
async function deleteSelectedGalleryItems() {
  const ids = Array.from(state.gallerySelected);
  if (!ids.length) return;
  const count = ids.length;
  if (!confirm(`Удалить ${count} ${count === 1 ? 'фото' : count < 5 ? 'фото' : 'фото'}? Это действие нельзя отменить.`)) return;

  showToast(`Удаление ${count} фото...`);
  let okCount = 0;
  for (const id of ids) {
    try {
      await fbDeleteProof(id);
      okCount++;
    } catch (e) {
      console.error('Delete proof failed:', id, e);
    }
  }
  // Локально подчищаем
  state.proofs = state.proofs.filter(p => !state.gallerySelected.has(p.id));
  saveLocal(PROOFS_CACHE, state.proofs);

  exitGallerySelectMode();
  showToast(`Удалено: ${okCount} ${okCount === 1 ? 'фото' : 'фото'}`, 'success');
}

/* Firebase: удаление proof */
async function fbDeleteProof(proofId) {
  try { await remove(ref(db, `proofs/${proofId}`)); }
  catch (e) { console.error('fbDeleteProof error:', e); throw e; }
}

/* ===========================================================
   BACKUP & CLEANUP — резервные копии и автоочистка фото
=========================================================== */

/** Возвращает количество proof'ов старше 60 дней */
function countOldProofs() {
  if (!state.proofs?.length) return 0;
  const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
  return state.proofs.filter(p => p.ts < cutoff).length;
}

/** Обновляет текст на кнопке очистки чтобы менеджер видел сколько фото будет удалено */
function updateCleanupBtnLabel() {
  const cnt = countOldProofs();
  const lbl = $('cleanupBtnLabel');
  if (!lbl) return;
  if (cnt === 0) {
    lbl.textContent = 'Нет фото старше 60 дней';
  } else {
    lbl.textContent = `Удалить ${cnt} ${cnt === 1 ? 'фото' : 'фото'} старше 60 дней`;
  }
}

/**
 * Удаляет все фото-отчёты старше 60 дней.
 * @param {boolean} interactive - если true, спрашивает подтверждение и показывает тосты
 */
async function cleanupOldProofs(interactive = false) {
  if (!isManager()) return 0;
  const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
  const oldOnes = state.proofs.filter(p => p.ts < cutoff);
  if (!oldOnes.length) {
    if (interactive) showToast('Нет фото старше 60 дней', 'success');
    return 0;
  }

  if (interactive) {
    const ok = confirm(`Удалить ${oldOnes.length} фото-отчётов старше 60 дней? Это действие нельзя отменить.`);
    if (!ok) return 0;
    showToast(`Удаление ${oldOnes.length} фото...`);
  }

  let okCount = 0;
  for (const p of oldOnes) {
    try {
      await fbDeleteProof(p.id);
      okCount++;
    } catch (e) {
      console.error('cleanupOldProofs:', e);
    }
  }
  // Локально подчищаем
  state.proofs = state.proofs.filter(p => p.ts >= cutoff);
  saveLocal(PROOFS_CACHE, state.proofs);

  if (interactive) {
    showToast(`Удалено: ${okCount} фото`, 'success');
    updateCleanupBtnLabel();
  } else {
    console.log(`[auto-cleanup] Удалено ${okCount} старых фото-отчётов`);
  }
  return okCount;
}

/** Скачивает все данные в JSON-файл */
async function downloadBackup() {
  if (!isManager()) {
    showToast('Только менеджер может делать бэкап', 'error');
    return;
  }

  showToast('Готовлю резервную копию...');

  // Берём свежие данные из Firebase, чтобы бэкап был актуальным даже если localState устарел
  let products = state.products, accounts = state.accounts, categories = state.categories, proofs = state.proofs;
  try {
    const [pSnap, aSnap, cSnap, prSnap] = await Promise.all([
      get(PRODUCTS_REF), get(ACCOUNTS_REF), get(CATEGORIES_REF), get(PROOFS_REF),
    ]);
    if (pSnap.exists())  products   = Object.values(pSnap.val());
    if (aSnap.exists())  accounts   = Object.values(aSnap.val());
    if (cSnap.exists())  categories = Object.values(cSnap.val());
    if (prSnap.exists()) proofs     = Object.values(prSnap.val());
  } catch (e) {
    console.warn('Backup: не удалось получить свежие данные, использую кеш', e);
  }

  const backup = {
    appName: 'Склад Mone',
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    exportedAtLocal: new Date().toLocaleString('ru-RU'),
    counts: {
      products: products.length,
      accounts: accounts.length,
      categories: categories.length,
      proofs: proofs.length,
    },
    products,
    accounts,
    categories,
    proofs,
  };

  // Сериализация может быть тяжёлой если много фото — делаем в Blob
  let blob;
  try {
    const json = JSON.stringify(backup, null, 2);
    blob = new Blob([json], { type: 'application/json' });
  } catch (e) {
    showToast('Слишком большой объём данных для бэкапа', 'error');
    return;
  }

  // Скачивание
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toLocaleDateString('ru-RU').replaceAll('.', '-');
  a.href = url;
  a.download = `Mone_backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  await writeLog('userEdit', `Скачана резервная копия: ${backup.counts.products} товаров, ${backup.counts.proofs} фото`);
  showToast(`Скачано: Mone_backup_${dateStr}.json`, 'success');
}

/** Восстанавливает данные из JSON-файла */
async function restoreBackup(event) {
  if (!isManager()) return;
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  let backup;
  try {
    const text = await file.text();
    backup = JSON.parse(text);
  } catch (e) {
    showToast('Не удалось прочитать файл — неверный JSON', 'error');
    return;
  }

  if (!backup || backup.appName !== 'Склад Mone') {
    showToast('Это не файл резервной копии Склад Mone', 'error');
    return;
  }

  const counts = backup.counts || {};
  const exported = backup.exportedAtLocal || backup.exportedAt || 'неизвестно';
  const ok = confirm(
    `Восстановить резервную копию от ${exported}?\n\n` +
    `Товаров: ${counts.products || 0}\n` +
    `Аккаунтов: ${counts.accounts || 0}\n` +
    `Категорий: ${counts.categories || 0}\n` +
    `Фото-отчётов: ${counts.proofs || 0}\n\n` +
    `ТЕКУЩИЕ ДАННЫЕ БУДУТ ЗАМЕНЕНЫ. Продолжить?`
  );
  if (!ok) return;

  showToast('Восстанавливаю данные...');

  try {
    // Восстанавливаем по очереди — products, categories, accounts, proofs
    const writes = [];

    if (Array.isArray(backup.products)) {
      const obj = {};
      backup.products.forEach(p => { if (p && p.id) obj[p.id] = p; });
      writes.push(set(PRODUCTS_REF, obj));
    }
    if (Array.isArray(backup.categories)) {
      const obj = {};
      backup.categories.forEach(c => { if (c && c.id) obj[c.id] = c; });
      writes.push(set(CATEGORIES_REF, obj));
    }
    if (Array.isArray(backup.accounts)) {
      const obj = {};
      backup.accounts.forEach(a => { if (a && a.id) obj[a.id] = a; });
      writes.push(set(ACCOUNTS_REF, obj));
    }
    if (Array.isArray(backup.proofs)) {
      const obj = {};
      backup.proofs.forEach(p => { if (p && p.id) obj[p.id] = p; });
      writes.push(set(PROOFS_REF, obj));
    }

    await Promise.all(writes);
    await writeLog('userEdit', `Восстановлена резервная копия от ${exported}`);
    showToast('Данные восстановлены', 'success');
  } catch (e) {
    console.error('restoreBackup error:', e);
    showToast('Ошибка восстановления — проверьте подключение', 'error');
  }
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
  $('reportsExcelBtn').addEventListener('click', openExcelDateModal);
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
      const catLabel = getCategoryLabel(cat);
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
          deficitHtml = `<span class="proof-card__deficit proof-card__deficit--ok">всё на месте</span>`;
        } else {
          deficitHtml = `<span class="proof-card__deficit proof-card__deficit--ok">+${diff} шт</span>`;
        }
      }

      const photoHtml = proof.photo
        ? `<img src="${proof.photo}" alt="${escHtml(proof.productName)}" loading="lazy"/>`
        : `<div class="proof-card__photo--empty">фото</div>`;

      return `
        <div class="proof-card ${cardCls}" data-proof-id="${escHtml(proof.id)}" style="animation-delay:${delay}ms">
          <div class="proof-card__photo">${photoHtml}</div>
          <div class="proof-card__body">
            <div class="proof-card__head">
              <div class="proof-card__product-name">${escHtml(proof.productName)}</div>
              <div class="proof-card__time">${formatTime(proof.ts)}</div>
            </div>
            <div class="proof-card__meta">
              <span class="proof-card__chip proof-card__chip--branch">${escHtml(branchLabel)}</span>
              <span class="proof-card__chip proof-card__chip--cat">${escHtml(catLabel)}</span>
              <span class="proof-card__chip proof-card__chip--user">${escHtml(proof.userName || '')}</span>
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
   EXCEL EXPORT — стиль печатного отчёта
   Это экспорт ОТЧЁТОВ от сотрудников (страница Отчёты).
   Стиль: красивая шапка, чёткие границы, без эмодзи и категорий.
=========================================================== */

/* ===========================================================
   EXCEL DATE PICKER — выбор даты/диапазона перед скачиванием
=========================================================== */
function initExcelDateModal() {
  const modal = $('excelDateModal');
  if (!modal) return;

  $('excelDateClose').addEventListener('click', () => closeOverlay(modal));
  $('excelDateCancel').addEventListener('click', () => closeOverlay(modal));
  modal.addEventListener('click', e => { if (e.target === modal) closeOverlay(modal); });

  // Пресеты по дате — только кнопки внутри .date-picker__presets
  modal.querySelectorAll('.date-picker__presets .date-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.date-picker__presets .date-preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.excelDateMode = btn.dataset.preset;
      applyExcelDatePreset();
      refreshExcelDateInfo();
    });
  });

  // Выбор филиала в модалке — кнопки внутри .date-picker__branches
  modal.querySelectorAll('.date-picker__branches .date-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.date-picker__branches .date-preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.excelBranch = btn.dataset.xbranch;
      refreshExcelDateInfo();
    });
  });

  // Ручной ввод дат — переключаем режим в "custom"
  ['excelDateFrom', 'excelDateTo'].forEach(id => {
    $(id).addEventListener('change', () => {
      state.excelDateMode = 'custom';
      modal.querySelectorAll('.date-picker__presets .date-preset').forEach(b => b.classList.remove('active'));
      state.excelDateFrom = $('excelDateFrom').value || null;
      state.excelDateTo   = $('excelDateTo').value   || null;
      refreshExcelDateInfo();
    });
  });

  $('excelDateDownload').addEventListener('click', () => {
    closeOverlay(modal);
    exportToExcel();
  });
}

function openExcelDateModal() {
  if (!isManager()) {
    showToast('Только менеджер может выгружать Excel', 'error');
    return;
  }
  const modal = $('excelDateModal');
  // По умолчанию — сегодня и все филиалы
  state.excelDateMode = 'today';
  state.excelBranch   = 'all';
  modal.querySelectorAll('.date-picker__presets .date-preset').forEach(b => {
    b.classList.toggle('active', b.dataset.preset === 'today');
  });
  modal.querySelectorAll('.date-picker__branches .date-preset').forEach(b => {
    b.classList.toggle('active', b.dataset.xbranch === 'all');
  });
  applyExcelDatePreset();
  refreshExcelDateInfo();
  openOverlay(modal);
}

/** Применяет выбранный пресет — заполняет поля «С» и «По» */
function applyExcelDatePreset() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const toStr = d => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  let from = null, to = null;
  switch (state.excelDateMode) {
    case 'today': {
      from = toStr(today);
      to   = toStr(today);
      break;
    }
    case 'yesterday': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      from = toStr(y);
      to   = toStr(y);
      break;
    }
    case 'week': {
      const w = new Date(today);
      w.setDate(w.getDate() - 6);
      from = toStr(w);
      to   = toStr(today);
      break;
    }
    case 'month': {
      const m = new Date(today);
      m.setDate(m.getDate() - 29);
      from = toStr(m);
      to   = toStr(today);
      break;
    }
    case 'all': {
      from = null;
      to   = null;
      break;
    }
  }

  state.excelDateFrom = from;
  state.excelDateTo   = to;
  $('excelDateFrom').value = from || '';
  $('excelDateTo').value   = to   || '';
}

/** Подсчёт сколько отчётов попадает в выбранный диапазон */
function getExcelFilteredProofs() {
  let list = [...state.proofs];

  // Фильтр по филиалу — берём из модалки Excel, а не из reportsBranchFilter.
  // Это позволяет менеджеру скачать отчёт по нужному филиалу,
  // не сбрасывая фильтры на странице отчётов.
  const branch = state.excelBranch || 'all';
  if (branch !== 'all') {
    list = list.filter(p => p.branch === branch);
  }

  // Категория и поиск НЕ применяются — для Excel нужны ВСЕ товары за дату,
  // а не отфильтрованные на странице. Это была частая причина «не вижу вилок»:
  // на странице отчётов был залипший поиск/категория.

  // Фильтр по дате
  if (state.excelDateFrom) {
    const fromDt = new Date(state.excelDateFrom + 'T00:00:00');
    fromDt.setHours(0, 0, 0, 0);
    const fromTs = fromDt.getTime();
    list = list.filter(p => p.ts >= fromTs);
  }
  if (state.excelDateTo) {
    const toDt = new Date(state.excelDateTo + 'T00:00:00');
    toDt.setHours(23, 59, 59, 999);
    const toTs = toDt.getTime();
    list = list.filter(p => p.ts <= toTs);
  }
  return list;
}

function refreshExcelDateInfo() {
  const list = getExcelFilteredProofs();
  $('excelDateCount').textContent = list.length;
  // Подзаголовок: текст текущего выбора
  const sub = $('excelDateSub');
  if (state.excelDateMode === 'all') {
    sub.textContent = 'За всё время';
  } else if (state.excelDateFrom && state.excelDateTo) {
    if (state.excelDateFrom === state.excelDateTo) {
      const d = new Date(state.excelDateFrom + 'T00:00:00');
      sub.textContent = `За ${d.toLocaleDateString('ru-RU', { day:'2-digit', month:'long', year:'numeric' })}`;
    } else {
      const df = new Date(state.excelDateFrom + 'T00:00:00').toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'2-digit' });
      const dt = new Date(state.excelDateTo + 'T00:00:00').toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'2-digit' });
      sub.textContent = `Период: ${df} — ${dt}`;
    }
  } else {
    sub.textContent = 'Выберите дату или диапазон';
  }
}

function exportToExcel() {
  if (!isManager()) {
    showToast('Только менеджер может выгружать Excel', 'error');
    return;
  }
  if (typeof XLSX === 'undefined') {
    showToast('Библиотека Excel не загружена', 'error');
    return;
  }

  const list = getExcelFilteredProofs();
  if (!list.length) {
    showToast('Нет данных для экспорта за выбранный период', 'error');
    return;
  }

  // ── Определяем филиал из модалки Excel (а не из reportsBranchFilter)
  const branchFilter = state.excelBranch || 'all';
  const branchTitle = branchFilter === 'all'
    ? 'Все филиалы'
    : BRANCH_LABELS[branchFilter] || branchFilter;

  // ── Текущая дата для шапки
  const now = new Date();
  const docDate = now.toLocaleDateString('ru-RU', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const docTime = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  // ── Считаем KPI
  let totalQty = 0;
  let totalTarget = 0;
  let missCount = 0;       // отчётов с недостачей
  let totalMiss = 0;       // суммарная недостача в шт
  list.forEach(p => {
    totalQty += (p.qty || 0);
    if (p.target > 0) {
      totalTarget += p.target;
      if (p.qty < p.target) {
        missCount++;
        totalMiss += (p.target - p.qty);
      }
    }
  });

  // ── Заголовки таблицы (всегда 10 колонок)
  const header = ['№', 'Дата', 'Время', 'Филиал', 'Товар', 'Норма', 'Факт', 'Расхождение', 'Сотрудник', 'Комментарий'];
  const lastCol = header.length - 1;

  // ── Строки данных
  const rows = list.map((p, i) => {
    const d = new Date(p.ts);
    const date = d.toLocaleDateString('ru-RU');
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const target = p.target || 0;
    const qty = p.qty || 0;
    const diff = target > 0 ? (qty - target) : '';
    return [
      i + 1,
      date,
      time,
      BRANCH_LABELS[p.branch] || p.branch,
      p.productName || '',
      target > 0 ? target : '',
      qty,
      diff === '' ? '' : (diff > 0 ? `+${diff}` : `${diff}`),
      p.userName || '',
      p.comment || '',
    ];
  });

  // ── Структура листа (профессиональная):
  //   Row 0:  СКЛАД MONE  (большой синий баннер)
  //   Row 1:  Отчёт по остаткам — <Филиал>
  //   Row 2:  (пусто)
  //   Row 3:  Сформировано: 12 мая 2026, 14:30
  //   Row 4:  Период: <первая-последняя даты>
  //   Row 5:  (пусто)
  //   Row 6:  KPI: Всего отчётов | Общее кол-во | Недостачи (3 ячейки)
  //   Row 7:  KPI значения
  //   Row 8:  (пусто)
  //   Row 9:  Заголовки таблицы
  //   Row 10+: Данные
  //   Row N+1 (пустая)
  //   Row N+2: ИТОГО

  // Период — берём из выбранного диапазона если он задан, иначе из реальных дат
  let periodStr;
  if (state.excelDateMode === 'all' || (!state.excelDateFrom && !state.excelDateTo)) {
    const dates = list.map(p => p.ts).sort((a, b) => a - b);
    const periodFrom = new Date(dates[0]).toLocaleDateString('ru-RU');
    const periodTo   = new Date(dates[dates.length - 1]).toLocaleDateString('ru-RU');
    periodStr = periodFrom === periodTo ? periodFrom : `${periodFrom} — ${periodTo}`;
  } else if (state.excelDateFrom === state.excelDateTo && state.excelDateFrom) {
    const d = new Date(state.excelDateFrom + 'T00:00:00');
    periodStr = d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
  } else {
    const df = new Date(state.excelDateFrom + 'T00:00:00').toLocaleDateString('ru-RU');
    const dt = new Date(state.excelDateTo + 'T00:00:00').toLocaleDateString('ru-RU');
    periodStr = `${df} — ${dt}`;
  }

  const wsData = [
    ['СКЛАД MONE'],                                                                       // 0
    [`Отчёт по остаткам — ${branchTitle}`],                                               // 1
    [],                                                                                   // 2
    [`Сформировано: ${docDate} в ${docTime}`],                                            // 3
    [`Период: ${periodStr}`],                                                             // 4
    [],                                                                                   // 5
    ['Всего отчётов', '', 'Общее количество', '', 'Недостачи', '', '', '', '', ''],       // 6 (KPI заголовки)
    [list.length, '', `${totalQty} шт`, '', missCount > 0 ? `${missCount} × ${totalMiss} шт` : '0', '', '', '', '', ''], // 7 (KPI значения)
    [],                                                                                   // 8
    header,                                                                               // 9
    ...rows,                                                                              // 10+
    [],
    ['', '', '', 'ИТОГО:', `${list.length} отчётов`, totalTarget || '', totalQty, totalMiss > 0 ? `-${totalMiss}` : '0', '', ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const titleRow   = 0;
  const subtitleRow= 1;
  const metaRow1   = 3;
  const metaRow2   = 4;
  const kpiLabelRow= 6;
  const kpiValueRow= 7;
  const headerRow  = 9;
  const dataStart  = headerRow + 1;
  const dataEnd    = dataStart + rows.length - 1;
  const totalRow   = dataEnd + 2;

  // ── Объединения ячеек
  ws['!merges'] = [
    { s: { r: titleRow,    c: 0 }, e: { r: titleRow,    c: lastCol } }, // СКЛАД MONE
    { s: { r: subtitleRow, c: 0 }, e: { r: subtitleRow, c: lastCol } }, // подзаголовок
    { s: { r: metaRow1,    c: 0 }, e: { r: metaRow1,    c: lastCol } }, // сформировано
    { s: { r: metaRow2,    c: 0 }, e: { r: metaRow2,    c: lastCol } }, // период
    // KPI: 3 блока по 3 ячейки (с пустой между)
    { s: { r: kpiLabelRow, c: 0 }, e: { r: kpiLabelRow, c: 1 } },
    { s: { r: kpiLabelRow, c: 2 }, e: { r: kpiLabelRow, c: 4 } },
    { s: { r: kpiLabelRow, c: 5 }, e: { r: kpiLabelRow, c: 9 } },
    { s: { r: kpiValueRow, c: 0 }, e: { r: kpiValueRow, c: 1 } },
    { s: { r: kpiValueRow, c: 2 }, e: { r: kpiValueRow, c: 4 } },
    { s: { r: kpiValueRow, c: 5 }, e: { r: kpiValueRow, c: 9 } },
  ];

  // ── Ширина колонок
  ws['!cols'] = [
    { wch: 5  }, // №
    { wch: 12 }, // Дата
    { wch: 8  }, // Время
    { wch: 14 }, // Филиал
    { wch: 36 }, // Товар
    { wch: 9  }, // Норма
    { wch: 9  }, // Факт
    { wch: 14 }, // Расхождение
    { wch: 22 }, // Сотрудник
    { wch: 38 }, // Комментарий
  ];

  // ── Высоты строк
  ws['!rows'] = [];
  ws['!rows'][titleRow]    = { hpt: 40 }; // большой баннер
  ws['!rows'][subtitleRow] = { hpt: 24 };
  ws['!rows'][2]           = { hpt: 6  };
  ws['!rows'][metaRow1]    = { hpt: 16 };
  ws['!rows'][metaRow2]    = { hpt: 16 };
  ws['!rows'][5]           = { hpt: 12 };
  ws['!rows'][kpiLabelRow] = { hpt: 20 };
  ws['!rows'][kpiValueRow] = { hpt: 32 };
  ws['!rows'][8]           = { hpt: 8  };
  ws['!rows'][headerRow]   = { hpt: 28 };

  // ── СТИЛИ

  // Цвета:
  const COLOR_BRAND_DARK   = '0B2545'; // тёмно-синий (заголовок)
  const COLOR_BRAND        = '1877F2'; // синий бренд
  const COLOR_HEADER       = '1E293B'; // тёмно-серый для заголовков таблицы
  const COLOR_WHITE        = 'FFFFFF';
  const COLOR_TEXT         = '111827';
  const COLOR_TEXT_LIGHT   = '6B7280';
  const COLOR_ZEBRA        = 'F8FAFC';
  const COLOR_MISS_BG      = 'FEE2E2';
  const COLOR_MISS_TEXT    = 'B91C1C';
  const COLOR_BORDER       = 'CBD5E1';
  const COLOR_BORDER_LIGHT = 'E2E8F0';
  const COLOR_KPI_BG       = 'EFF6FF';
  const COLOR_KPI_BORDER   = 'BFDBFE';
  const COLOR_TOTAL_BG     = 'F1F5F9';

  // Заполняем все ячейки в строках 0..totalRow чтобы стили применились
  // (даже пустые — без этого Excel не применит fill)
  for (let R = 0; R <= totalRow; R++) {
    for (let C = 0; C <= lastCol; C++) {
      const ref = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[ref]) ws[ref] = { t: 's', v: '' };
    }
  }

  // 1) СКЛАД MONE (большой синий баннер)
  for (let C = 0; C <= lastCol; C++) {
    const ref = XLSX.utils.encode_cell({ r: titleRow, c: C });
    ws[ref].s = {
      font: { bold: true, sz: 22, color: { rgb: COLOR_WHITE }, name: 'Arial' },
      fill: { patternType: 'solid', fgColor: { rgb: COLOR_BRAND } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };
  }

  // 2) Подзаголовок (тёмно-синий)
  for (let C = 0; C <= lastCol; C++) {
    const ref = XLSX.utils.encode_cell({ r: subtitleRow, c: C });
    ws[ref].s = {
      font: { bold: true, sz: 14, color: { rgb: COLOR_WHITE }, name: 'Arial' },
      fill: { patternType: 'solid', fgColor: { rgb: COLOR_BRAND_DARK } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };
  }

  // 3) Meta (сформировано / период)
  [metaRow1, metaRow2].forEach(R => {
    for (let C = 0; C <= lastCol; C++) {
      const ref = XLSX.utils.encode_cell({ r: R, c: C });
      ws[ref].s = {
        font: { sz: 10, color: { rgb: COLOR_TEXT_LIGHT }, italic: true },
        alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
      };
    }
  });

  // 4) KPI labels
  for (let C = 0; C <= lastCol; C++) {
    const ref = XLSX.utils.encode_cell({ r: kpiLabelRow, c: C });
    ws[ref].s = {
      font: { bold: true, sz: 10, color: { rgb: COLOR_TEXT_LIGHT }, name: 'Arial' },
      fill: { patternType: 'solid', fgColor: { rgb: COLOR_KPI_BG } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top:    { style: 'medium', color: { rgb: COLOR_KPI_BORDER } },
        left:   { style: 'medium', color: { rgb: COLOR_KPI_BORDER } },
        right:  { style: 'medium', color: { rgb: COLOR_KPI_BORDER } },
      },
    };
  }
  // 5) KPI values (большие цифры)
  for (let C = 0; C <= lastCol; C++) {
    const ref = XLSX.utils.encode_cell({ r: kpiValueRow, c: C });
    const isMissCol = C >= 5;
    ws[ref].s = {
      font: {
        bold: true, sz: 18,
        color: { rgb: isMissCol && missCount > 0 ? COLOR_MISS_TEXT : COLOR_BRAND_DARK },
        name: 'Arial',
      },
      fill: { patternType: 'solid', fgColor: { rgb: COLOR_KPI_BG } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        bottom: { style: 'medium', color: { rgb: COLOR_KPI_BORDER } },
        left:   { style: 'medium', color: { rgb: COLOR_KPI_BORDER } },
        right:  { style: 'medium', color: { rgb: COLOR_KPI_BORDER } },
      },
    };
  }

  // 6) Заголовки таблицы
  for (let C = 0; C <= lastCol; C++) {
    const ref = XLSX.utils.encode_cell({ r: headerRow, c: C });
    ws[ref].s = {
      font: { bold: true, sz: 11, color: { rgb: COLOR_WHITE }, name: 'Arial' },
      fill: { patternType: 'solid', fgColor: { rgb: COLOR_HEADER } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top:    { style: 'medium', color: { rgb: COLOR_HEADER } },
        bottom: { style: 'medium', color: { rgb: COLOR_HEADER } },
        left:   { style: 'thin',   color: { rgb: '475569' } },
        right:  { style: 'thin',   color: { rgb: '475569' } },
      },
    };
  }

  // 7) Строки данных
  const centerCols = [0, 1, 2, 5, 6, 7]; // №, Дата, Время, Норма, Факт, Расхождение
  const branchCol = 3;
  for (let i = 0; i < rows.length; i++) {
    const R = dataStart + i;
    const diffVal = rows[i][7];
    const isMiss = typeof diffVal === 'string' && diffVal.startsWith('-');
    const isZebra = i % 2 === 1;
    const baseFill = isMiss ? COLOR_MISS_BG : (isZebra ? COLOR_ZEBRA : COLOR_WHITE);

    for (let C = 0; C <= lastCol; C++) {
      const ref = XLSX.utils.encode_cell({ r: R, c: C });
      const isDiff = C === 7;
      const isBranch = C === branchCol;
      ws[ref].s = {
        font: {
          sz: 10,
          name: 'Arial',
          color: { rgb: isMiss && isDiff ? COLOR_MISS_TEXT : COLOR_TEXT },
          bold: (isMiss && isDiff) || isBranch,
        },
        fill: { patternType: 'solid', fgColor: { rgb: baseFill } },
        alignment: {
          vertical: 'center',
          wrapText: true,
          horizontal: centerCols.includes(C) ? 'center' : 'left',
          indent: centerCols.includes(C) ? 0 : 1,
        },
        border: {
          top:    { style: 'thin', color: { rgb: COLOR_BORDER_LIGHT } },
          bottom: { style: 'thin', color: { rgb: COLOR_BORDER_LIGHT } },
          left:   { style: 'thin', color: { rgb: COLOR_BORDER_LIGHT } },
          right:  { style: 'thin', color: { rgb: COLOR_BORDER_LIGHT } },
        },
      };
    }
  }

  // 8) Итоговая строка
  for (let C = 0; C <= lastCol; C++) {
    const ref = XLSX.utils.encode_cell({ r: totalRow, c: C });
    const isDiff = C === 7;
    const isLabel = C === 3;
    ws[ref].s = {
      font: {
        bold: true,
        sz: 11,
        name: 'Arial',
        color: { rgb: isDiff && totalMiss > 0 ? COLOR_MISS_TEXT : COLOR_BRAND_DARK },
      },
      fill: { patternType: 'solid', fgColor: { rgb: COLOR_TOTAL_BG } },
      alignment: {
        vertical: 'center',
        horizontal: isLabel ? 'right' : (centerCols.includes(C) ? 'center' : 'left'),
        indent: isLabel ? 0 : (centerCols.includes(C) ? 0 : 1),
      },
      border: {
        top:    { style: 'medium', color: { rgb: COLOR_HEADER } },
        bottom: { style: 'medium', color: { rgb: COLOR_HEADER } },
      },
    };
  }

  // ── Закрепить шапку при прокрутке (включая бренд-баннер и KPI)
  ws['!freeze'] = { xSplit: 0, ySplit: headerRow + 1 };
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: headerRow, c: 0 },
      e: { r: dataEnd,   c: lastCol },
    }),
  };

  // ── Создаём книгу
  const wb = XLSX.utils.book_new();
  // Имя листа отражает филиал
  const sheetName = branchFilter === 'all'
    ? 'Все филиалы'
    : (BRANCH_LABELS[branchFilter] || 'Отчёт').slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // ── Имя файла — отражает филиал и период
  let datePart;
  if (state.excelDateMode === 'all' || (!state.excelDateFrom && !state.excelDateTo)) {
    datePart = 'все_даты';
  } else if (state.excelDateFrom === state.excelDateTo) {
    datePart = state.excelDateFrom.replaceAll('-', '');
  } else {
    const f = (state.excelDateFrom || '').replaceAll('-', '');
    const t = (state.excelDateTo   || '').replaceAll('-', '');
    datePart = `${f}_${t}`;
  }
  const branchSlug = branchFilter === 'all' ? 'Все_филиалы' : (BRANCH_LABELS[branchFilter] || 'Отчёт').replace(/\s+/g, '_');
  const fileName = `Mone_Отчёт_${branchSlug}_${datePart}.xlsx`;

  XLSX.writeFile(wb, fileName);
  showToast(`Скачано: ${fileName}`, 'success');
}

/* ===========================================================
   INIT
=========================================================== */
function init() {
  // Сплеш-экран — показывается через CSS-анимацию (~2.2s + 0.5s fade).
  // Скрываем его из DOM по событию animationend, чтобы он не блокировал клики.
  const splash = $('splashScreen');
  if (splash) {
    // Анимация исчезновения = последняя на splash-screen, поэтому ловим её
    splash.addEventListener('animationend', e => {
      if (e.animationName === 'splashFadeOut') {
        splash.classList.add('hidden');
      }
    });
    // Защита: если по какой-то причине animationend не сработал — убираем через 3.5s
    setTimeout(() => splash.classList.add('hidden'), 3500);
  }

  // Запускаем основную инициализацию параллельно (Firebase, авторизация),
  // чтобы пока сплеш анимируется — данные уже подгрузились.
  initAuth();

  // PWA: регистрируем Service Worker и слушаем событие установки
  registerServiceWorker();
  initInstallPrompt();
}

/* ===========================================================
   PWA — установка на главный экран
=========================================================== */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { scope: './' })
      .then(reg => {
        // Каждый час проверяем обновления
        setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
      })
      .catch(err => console.warn('[PWA] SW registration failed:', err));
  });
}

let _deferredInstallPrompt = null;
function initInstallPrompt() {
  // Chrome/Android: сам вызывает событие когда установка возможна
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _deferredInstallPrompt = e;
    const btn = $('installAppBtn');
    if (btn) btn.style.display = '';
  });
  window.addEventListener('appinstalled', () => {
    _deferredInstallPrompt = null;
    const btn = $('installAppBtn');
    if (btn) btn.style.display = 'none';
    showToast('Приложение установлено', 'success');
  });
}

/** Запускает установку PWA. На iOS показывает инструкцию (там нет API). */
async function triggerInstallPrompt() {
  if (!_deferredInstallPrompt) {
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      alert('Чтобы установить приложение на iPhone:\n\n1. Нажмите кнопку «Поделиться» в Safari\n2. Прокрутите вниз\n3. Выберите «На экран Домой»\n\nИконка появится на главном экране.');
    } else {
      showToast('Откройте сайт в Chrome или Edge для установки', 'error');
    }
    return;
  }
  _deferredInstallPrompt.prompt();
  const choice = await _deferredInstallPrompt.userChoice;
  if (choice.outcome === 'accepted') {
    showToast('Устанавливается...', 'success');
  }
  _deferredInstallPrompt = null;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
