/**
 * ========================================
 * СКЛАДПРО — СИСТЕМА УПРАВЛЕНИЯ ОСТАТКАМИ
 * app.js — с интеграцией Firebase Realtime Database
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

/* ================================================
   CONSTANTS & CONFIG
================================================ */
const ADMIN_PASSWORD = 'admin123';
const STORAGE_KEY    = 'skladpro_products_v1';

const CATEGORY_LABELS = {
  drinks:     'Напитки',
  disposable: 'Одноразовая посуда',
  food:       'Продукты',
  cleaning:   'Чистящие средства',
  other:      'Прочее',
};

const BRANCH_LABELS = {
  branch1: 'Сибирский',
  branch2: 'Фреско',
  branch3: 'Гелион',
};

const BRANCH_KEYS = ['branch1', 'branch2', 'branch3'];

/* ================================================
   STATE
================================================ */
const state = {
  products:         [],
  activeBranch:     'all',
  searchQuery:      '',
  categoryFilter:   'all',
  sortMode:         'name',
  pendingAction:    null,
  editingProductId: null,
  currentViewId:    null,
  photoDataUrl:     null,
  firebaseLoaded:   false,
};

/* ================================================
   UTILITY FUNCTIONS
================================================ */
const uid = () => `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

function getQty(product, branch = 'all') {
  if (branch === 'all') {
    return BRANCH_KEYS.reduce((sum, k) => sum + (product.branches[k] ?? 0), 0);
  }
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
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ================================================
   LOCAL STORAGE (кэш / оффлайн-резерв)
================================================ */
function saveLocalCache() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.products));
  } catch (e) {
    console.warn('localStorage недоступен:', e);
  }
}

function loadLocalCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/* ================================================
   FIREBASE — ЗАПИСЬ / УДАЛЕНИЕ
================================================ */
async function fbSaveProduct(product) {
  try {
    await set(ref(db, `products/${product.id}`), product);
  } catch (e) {
    console.error('Firebase save error:', e);
    showToast('⚠ Ошибка синхронизации с сервером', 'error');
  }
}

async function fbDeleteProduct(productId) {
  try {
    await remove(ref(db, `products/${productId}`));
  } catch (e) {
    console.error('Firebase delete error:', e);
    showToast('⚠ Ошибка удаления из сервера', 'error');
  }
}

/* ================================================
   FIREBASE — СЛУШАТЕЛЬ РЕАЛЬНОГО ВРЕМЕНИ
================================================ */
function initFirebaseListener() {
  showSyncIndicator('connecting');

  onValue(PRODUCTS_REF, (snapshot) => {
    const data = snapshot.val();

    if (data) {
      // Firebase вернул данные
      state.products = Object.values(data);
    } else if (!state.firebaseLoaded) {
      // Firebase пустой — первый запуск, заливаем демо-данные
      const cached = loadLocalCache();
      state.products = (cached && cached.length > 0) ? cached : getDefaultProducts();
      state.products.forEach(p => fbSaveProduct(p));
    } else {
      // Всё удалено пользователем
      state.products = [];
    }

    state.firebaseLoaded = true;
    saveLocalCache();
    renderAll();
    showSyncIndicator('ok');

  }, (error) => {
    console.error('Firebase listener error:', error);
    showSyncIndicator('error');

    // Оффлайн — грузим из кэша
    if (!state.firebaseLoaded) {
      const cached = loadLocalCache();
      state.products       = cached || getDefaultProducts();
      state.firebaseLoaded = true;
      renderAll();
    }

    showToast('⚠ Нет связи с сервером — работаем офлайн', 'error');
  });
}

/* ================================================
   SYNC INDICATOR
================================================ */
function showSyncIndicator(status) {
  const el = document.getElementById('syncIndicator');
  if (!el) return;
  const map = {
    connecting: { text: '⏳ Подключение...',  cls: 'sync--connecting' },
    ok:         { text: '☁ Синхронизировано', cls: 'sync--ok'         },
    error:      { text: '⚠ Офлайн',           cls: 'sync--error'      },
  };
  const s = map[status] || map.ok;
  el.textContent = s.text;
  el.className   = `sync-indicator ${s.cls}`;
}

/* ================================================
   DEMO DATA
================================================ */
function getDefaultProducts() {
  return [
    {
      id: uid(), name: 'Pepsi 0.5л', category: 'drinks', unit: 'шт',
      description: 'Газированный напиток Pepsi, бутылка 0.5 литра',
      photo: null, branches: { branch1: 24, branch2: 8, branch3: 3 },
    },
    {
      id: uid(), name: 'Coca-Cola 1л', category: 'drinks', unit: 'шт',
      description: 'Классическая Кока-Кола, бутылка 1 литр',
      photo: null, branches: { branch1: 12, branch2: 20, branch3: 15 },
    },
    {
      id: uid(), name: 'Пластиковые стаканы 250мл', category: 'disposable', unit: 'уп',
      description: 'Одноразовые стаканы, упаковка 100 штук',
      photo: null, branches: { branch1: 5, branch2: 2, branch3: 0 },
    },
    {
      id: uid(), name: 'Трубочки для коктейлей', category: 'disposable', unit: 'уп',
      description: 'Пластиковые трубочки, упаковка 500 штук',
      photo: null, branches: { branch1: 3, branch2: 0, branch3: 1 },
    },
    {
      id: uid(), name: 'Сахар 1кг', category: 'food', unit: 'кг',
      description: 'Сахар-песок, пакет 1кг',
      photo: null, branches: { branch1: 10, branch2: 6, branch3: 4 },
    },
    {
      id: uid(), name: 'Fairy 500мл', category: 'cleaning', unit: 'шт',
      description: 'Средство для мытья посуды Fairy, 500мл',
      photo: null, branches: { branch1: 4, branch2: 4, branch3: 2 },
    },
  ];
}

/* ================================================
   DOM REFS
================================================ */
const $ = id => document.getElementById(id);

const els = {
  grid:            $('productsGrid'),
  emptyState:      $('emptyState'),
  statsText:       $('statsText'),
  searchInput:     $('searchInput'),
  categoryFilter:  $('categoryFilter'),
  sortFilter:      $('sortFilter'),
  branches:        $('branches'),

  viewModal:       $('viewModal'),
  viewImg:         $('viewImg'),
  viewBadge:       $('viewBadge'),
  viewCategory:    $('viewCategory'),
  viewTitle:       $('viewTitle'),
  viewDesc:        $('viewDesc'),
  viewBranches:    $('viewBranches'),
  viewTotal:       $('viewTotal'),
  viewEditBtn:     $('viewEditBtn'),
  viewDeleteBtn:   $('viewDeleteBtn'),
  viewModalClose:  $('viewModalClose'),

  editModal:       $('editModal'),
  editModalTitle:  $('editModalTitle'),
  editModalClose:  $('editModalClose'),
  editCancelBtn:   $('editCancelBtn'),
  editSaveBtn:     $('editSaveBtn'),
  editName:        $('editName'),
  editCategory:    $('editCategory'),
  editUnit:        $('editUnit'),
  editDesc:        $('editDesc'),
  qty1:            $('qty1'),
  qty2:            $('qty2'),
  qty3:            $('qty3'),
  photoInput:      $('photoInput'),
  photoUploadArea: $('photoUploadArea'),
  photoPlaceholder:$('photoPlaceholder'),
  photoPreview:    $('photoPreview'),
  photoRemoveBtn:  $('photoRemoveBtn'),

  passwordModal:   $('passwordModal'),
  passwordInput:   $('passwordInput'),
  passwordSubmit:  $('passwordSubmitBtn'),
  passwordClose:   $('passwordModalClose'),
  passwordError:   $('passwordError'),
  passwordToggle:  $('passwordToggle'),

  confirmModal:    $('confirmModal'),
  confirmText:     $('confirmText'),
  confirmCancel:   $('confirmCancelBtn'),
  confirmDelete:   $('confirmDeleteBtn'),

  toast:           $('toast'),
  addProductBtn:   $('addProductBtn'),
  printBtn:        $('printBtn'),

  printArea:       $('printArea'),
  printBranchLabel:$('printBranchLabel'),
  printTitle:      $('printTitle'),
  printDate:       $('printDate'),
  printTableBody:  $('printTableBody'),
  printFooterDate: $('printFooterDate'),
};

/* ================================================
   TOAST
================================================ */
let toastTimer = null;

function showToast(message, type = 'default') {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.className   = `toast ${type} show`;
  toastTimer = setTimeout(() => {
    els.toast.classList.remove('show');
  }, 3200);
}

/* ================================================
   FILTERING & SORTING
================================================ */
function getFilteredProducts() {
  let list = [...state.products];

  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (CATEGORY_LABELS[p.category] || '').toLowerCase().includes(q)
    );
  }

  if (state.categoryFilter !== 'all') {
    list = list.filter(p => p.category === state.categoryFilter);
  }

  switch (state.sortMode) {
    case 'name':
      list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      break;
    case 'qty-asc':
      list.sort((a, b) => getQty(a, state.activeBranch) - getQty(b, state.activeBranch));
      break;
    case 'qty-desc':
      list.sort((a, b) => getQty(b, state.activeBranch) - getQty(a, state.activeBranch));
      break;
  }

  return list;
}

/* ================================================
   RENDER
================================================ */
function renderAll() {
  const list = getFilteredProducts();
  els.statsText.textContent = `Товаров: ${list.length}`;

  if (list.length === 0) {
    els.grid.innerHTML = '';
    els.emptyState.style.display = 'flex';
    return;
  }

  els.emptyState.style.display = 'none';
  els.grid.innerHTML = list.map((p, i) => buildCard(p, i)).join('');

  els.grid.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => openViewModal(card.dataset.id));
  });
}

function buildCard(product, index) {
  const qty    = getQty(product, state.activeBranch);
  const status = getStockStatus(qty);
  const badge  = STOCK_BADGE[status];
  const delay  = Math.min(index * 40, 400);

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
    const bqty   = product.branches[k] ?? 0;
    const bstyle = bqty === 0 ? 'branch-row__qty--out' : bqty <= 3 ? 'branch-row__qty--low' : '';
    if (state.activeBranch !== 'all' && state.activeBranch !== k) return '';
    return `
      <div class="branch-row">
        <span class="branch-row__label">${BRANCH_LABELS[k]}</span>
        <span class="branch-row__qty ${bstyle}">${bqty} ${escHtml(product.unit)}</span>
      </div>`;
  }).join('');

  return `
    <div class="product-card" data-id="${product.id}" style="animation-delay:${delay}ms">
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
  const status   = getStockStatus(
    state.activeBranch === 'all' ? totalQty : getQty(product, state.activeBranch)
  );
  const badge = STOCK_BADGE[status];

  if (product.photo) {
    els.viewImg.src           = product.photo;
    els.viewImg.style.display = 'block';
  } else {
    els.viewImg.src           = '';
    els.viewImg.style.display = 'none';
  }

  els.viewBadge.textContent    = badge.label;
  els.viewBadge.className      = `modal__badge ${badge.cls}`;
  els.viewCategory.textContent = CATEGORY_LABELS[product.category] || product.category;
  els.viewTitle.textContent    = product.name;
  els.viewDesc.textContent     = product.description || 'Описание не указано';
  els.viewTotal.textContent    = `${totalQty} ${product.unit}`;

  els.viewBranches.innerHTML = BRANCH_KEYS.map(k => {
    const q      = product.branches[k] ?? 0;
    const qstyle = q === 0 ? 'color:var(--danger)' : q <= 3 ? 'color:var(--warning)' : '';
    return `
      <div class="modal-branch-row">
        <span class="modal-branch-row__name">${BRANCH_LABELS[k]}</span>
        <span class="modal-branch-row__qty" style="${qstyle}">${q} ${escHtml(product.unit)}</span>
      </div>`;
  }).join('');

  openOverlay(els.viewModal);
}

function closeViewModal() {
  closeOverlay(els.viewModal);
  state.currentViewId = null;
}

/* ================================================
   PASSWORD MODAL
================================================ */
function requestPassword(action) {
  state.pendingAction = action;
  els.passwordInput.value = '';
  els.passwordError.style.display = 'none';
  closeOverlay(els.viewModal);
  openOverlay(els.passwordModal);
  setTimeout(() => els.passwordInput.focus(), 300);
}

function verifyPassword() {
  const val = els.passwordInput.value;
  if (val === ADMIN_PASSWORD) {
    closeOverlay(els.passwordModal);
    els.passwordInput.value = '';
    executePendingAction();
  } else {
    els.passwordError.style.display   = 'block';
    els.passwordError.style.animation = 'none';
    requestAnimationFrame(() => {
      els.passwordError.style.animation = 'shake 0.3s ease';
    });
    els.passwordInput.value = '';
    els.passwordInput.focus();
  }
}

function executePendingAction() {
  if (!state.pendingAction) return;
  const { type, data } = state.pendingAction;
  state.pendingAction = null;

  if (type === 'add')    openEditModal(null);
  else if (type === 'edit')   openEditModal(data.id);
  else if (type === 'delete') openConfirmModal(data.id);
}

/* ================================================
   EDIT MODAL
================================================ */
function openEditModal(productId) {
  state.editingProductId = productId || null;
  els.editModalTitle.textContent = productId ? 'Редактировать товар' : 'Добавить товар';

  state.photoDataUrl                 = null;
  els.photoPreview.style.display     = 'none';
  els.photoPlaceholder.style.display = 'flex';
  els.photoRemoveBtn.style.display   = 'none';
  els.photoInput.value = '';

  if (productId) {
    const p = state.products.find(pr => pr.id === productId);
    if (!p) return;
    els.editName.value     = p.name;
    els.editCategory.value = p.category;
    els.editUnit.value     = p.unit;
    els.editDesc.value     = p.description || '';
    els.qty1.value         = p.branches.branch1 ?? 0;
    els.qty2.value         = p.branches.branch2 ?? 0;
    els.qty3.value         = p.branches.branch3 ?? 0;

    if (p.photo) {
      state.photoDataUrl                 = p.photo;
      els.photoPreview.src               = p.photo;
      els.photoPreview.style.display     = 'block';
      els.photoPlaceholder.style.display = 'none';
      els.photoRemoveBtn.style.display   = 'block';
    }
  } else {
    els.editName.value     = '';
    els.editCategory.value = 'drinks';
    els.editUnit.value     = 'шт';
    els.editDesc.value     = '';
    els.qty1.value = els.qty2.value = els.qty3.value = '0';
  }

  openOverlay(els.editModal);
  setTimeout(() => els.editName.focus(), 300);
}

async function saveProduct() {
  const name = els.editName.value.trim();
  if (!name) {
    els.editName.style.borderColor = 'var(--danger)';
    els.editName.focus();
    showToast('Введите название товара', 'error');
    return;
  }
  els.editName.style.borderColor = '';

  const product = {
    id:          state.editingProductId || uid(),
    name,
    category:    els.editCategory.value,
    unit:        els.editUnit.value,
    description: els.editDesc.value.trim(),
    photo:       state.photoDataUrl,
    branches: {
      branch1: Math.max(0, parseInt(els.qty1.value) || 0),
      branch2: Math.max(0, parseInt(els.qty2.value) || 0),
      branch3: Math.max(0, parseInt(els.qty3.value) || 0),
    },
  };

  // Оптимистичное обновление UI до ответа Firebase
  if (state.editingProductId) {
    const idx = state.products.findIndex(p => p.id === state.editingProductId);
    if (idx > -1) state.products[idx] = product;
    showToast('✓ Товар обновлён', 'success');
  } else {
    state.products.unshift(product);
    showToast('✓ Товар добавлен', 'success');
  }

  saveLocalCache();
  renderAll();
  closeOverlay(els.editModal);

  // Сохраняем в Firebase
  await fbSaveProduct(product);
}

/* ================================================
   DELETE / CONFIRM
================================================ */
function openConfirmModal(productId) {
  const p = state.products.find(pr => pr.id === productId);
  if (!p) return;
  els.confirmText.textContent = `Удалить "${p.name}"? Это действие нельзя отменить.`;
  state.pendingAction = { type: 'delete_confirmed', data: { id: productId } };
  openOverlay(els.confirmModal);
}

async function deleteProduct(productId) {
  const idx = state.products.findIndex(p => p.id === productId);
  if (idx > -1) {
    const name = state.products[idx].name;

    // Оптимистичное удаление
    state.products.splice(idx, 1);
    saveLocalCache();
    renderAll();
    showToast(`✓ "${name}" удалён`, 'success');

    // Удаляем из Firebase
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
  els.photoUploadArea.addEventListener('click', e => {
    if (e.target === els.photoRemoveBtn) return;
    els.photoInput.click();
  });

  els.photoInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      state.photoDataUrl                 = ev.target.result;
      els.photoPreview.src               = ev.target.result;
      els.photoPreview.style.display     = 'block';
      els.photoPlaceholder.style.display = 'none';
      els.photoRemoveBtn.style.display   = 'block';
    };
    reader.readAsDataURL(file);
  });

  els.photoRemoveBtn.addEventListener('click', e => {
    e.stopPropagation();
    state.photoDataUrl                 = null;
    els.photoPreview.src               = '';
    els.photoPreview.style.display     = 'none';
    els.photoPlaceholder.style.display = 'flex';
    els.photoRemoveBtn.style.display   = 'none';
    els.photoInput.value = '';
  });
}

/* ================================================
   QTY STEPPERS
================================================ */
function initSteppers() {
  document.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input    = $(targetId);
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
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const isAllBranches = state.activeBranch === 'all';
  const branchLabel   = isAllBranches
    ? 'Все филиалы'
    : BRANCH_LABELS[state.activeBranch];

  els.printBranchLabel.textContent = branchLabel;
  els.printTitle.textContent       = `Отчёт по остаткам — ${branchLabel}`;
  els.printDate.textContent        = dateStr;
  els.printFooterDate.textContent  = dateStr;

  const thead = document.getElementById('printTableHead');
  if (isAllBranches) {
    thead.innerHTML = `
      <th style="width:60px">Фото</th>
      <th>Товар</th>
      <th>Категория</th>
      ${BRANCH_KEYS.map(k => `<th style="text-align:center">${BRANCH_LABELS[k]}</th>`).join('')}
      <th>Итого</th>`;
  } else {
    thead.innerHTML = `
      <th style="width:60px">Фото</th>
      <th>Товар</th>
      <th>Категория</th>
      <th style="text-align:center">Количество</th>`;
  }

  els.printTableBody.innerHTML = list.map(p => {
    const imgHtml = p.photo
      ? `<img src="${p.photo}" alt="${escHtml(p.name)}" />`
      : `<div class="print-img-placeholder">—</div>`;

    let dataCells = '';
    if (isAllBranches) {
      const branchCells = BRANCH_KEYS.map(k => {
        const q = p.branches[k] ?? 0;
        return `<td style="text-align:center;${q === 0 ? 'color:#ccc;' : ''}">${q}</td>`;
      }).join('');
      const total = getQty(p);
      dataCells = `${branchCells}<td class="print-td-total">${total} ${escHtml(p.unit)}</td>`;
    } else {
      const q = p.branches[state.activeBranch] ?? 0;
      dataCells = `<td class="print-td-total" style="text-align:center;${q === 0 ? 'color:#ccc;' : ''}">${q} ${escHtml(p.unit)}</td>`;
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

  els.printArea.style.display = 'block';
  setTimeout(() => {
    window.print();
    els.printArea.style.display = 'none';
  }, 200);
}

/* ================================================
   BRANCH NAV
================================================ */
function initBranchNav() {
  els.branches.querySelectorAll('.branch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      els.branches.querySelectorAll('.branch-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeBranch = btn.dataset.branch;
      renderAll();
    });
  });
}

/* ================================================
   SEARCH & FILTER
================================================ */
function initFilters() {
  let searchTimer;
  els.searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.searchQuery = els.searchInput.value;
      renderAll();
    }, 250);
  });

  els.categoryFilter.addEventListener('change', () => {
    state.categoryFilter = els.categoryFilter.value;
    renderAll();
  });

  els.sortFilter.addEventListener('change', () => {
    state.sortMode = els.sortFilter.value;
    renderAll();
  });
}

/* ================================================
   EVENT LISTENERS
================================================ */
function initEventListeners() {
  els.addProductBtn.addEventListener('click', () => requestPassword({ type: 'add' }));
  els.printBtn.addEventListener('click', preparePrint);

  // VIEW MODAL
  els.viewModalClose.addEventListener('click', closeViewModal);
  els.viewModal.addEventListener('click', e => {
    if (e.target === els.viewModal) closeViewModal();
  });
  els.viewEditBtn.addEventListener('click', () => {
    const id = state.currentViewId;
    closeViewModal();
    requestPassword({ type: 'edit', data: { id } });
  });
  els.viewDeleteBtn.addEventListener('click', () => {
    const id = state.currentViewId;
    closeViewModal();
    requestPassword({ type: 'delete', data: { id } });
  });

  // EDIT MODAL
  els.editModalClose.addEventListener('click', () => closeOverlay(els.editModal));
  els.editCancelBtn.addEventListener('click',  () => closeOverlay(els.editModal));
  els.editModal.addEventListener('click', e => {
    if (e.target === els.editModal) closeOverlay(els.editModal);
  });
  els.editSaveBtn.addEventListener('click', saveProduct);

  // PASSWORD MODAL
  els.passwordClose.addEventListener('click', () => {
    closeOverlay(els.passwordModal);
    state.pendingAction = null;
  });
  els.passwordModal.addEventListener('click', e => {
    if (e.target === els.passwordModal) {
      closeOverlay(els.passwordModal);
      state.pendingAction = null;
    }
  });
  els.passwordSubmit.addEventListener('click', verifyPassword);
  els.passwordInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') verifyPassword();
  });
  els.passwordToggle.addEventListener('click', () => {
    const input = els.passwordInput;
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // CONFIRM MODAL
  els.confirmCancel.addEventListener('click', () => {
    closeOverlay(els.confirmModal);
    state.pendingAction = null;
  });
  els.confirmModal.addEventListener('click', e => {
    if (e.target === els.confirmModal) {
      closeOverlay(els.confirmModal);
      state.pendingAction = null;
    }
  });
  els.confirmDelete.addEventListener('click', () => {
    closeOverlay(els.confirmModal);
    if (state.pendingAction && state.pendingAction.data) {
      deleteProduct(state.pendingAction.data.id);
    }
    state.pendingAction = null;
  });

  // ESC
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const openModals = document.querySelectorAll('.modal-overlay.active');
    if (openModals.length) {
      const last = openModals[openModals.length - 1];
      last.classList.remove('active');
      const anyOpen = !!document.querySelector('.modal-overlay.active');
      if (!anyOpen) document.body.style.overflow = '';
    }
  });
}

/* ================================================
   INIT
================================================ */
function init() {
  initBranchNav();
  initFilters();
  initPhotoUpload();
  initSteppers();
  initEventListeners();
  initFirebaseListener(); // Firebase сам вызовет renderAll() при получении данных
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
