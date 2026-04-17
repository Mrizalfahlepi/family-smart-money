/* ═══════════════════════════════════════════════════════════════════════════
   FAMILY SMART MONEY — app.js
   SPA Frontend: Hash Routing, API, Animasi, Export
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const API = '/api';
const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

// ─── STATE ────────────────────────────────────────────────────────────────────
const state = {
  currentView:    'dashboard',
  editingTxId:    null,
  currentType:    'expense',
  selectedCatId:  null,
  categories:     [],
  members:        [],
  settings:       {},
  reportRange:    'month',
  reportData:     null,
  dashboardChartInstance: null,
  reportDonutInstance:    null,
  reportBarInstance:      null,
  deleteCallback: null,
  txFilters: { type: '', month: '', year: '', search: '' },
  monthlyData: [],
  currentUser:    null,  // { id, name, email }
};

// ─── SESSION (localStorage) ───────────────────────────────────────────────────
const SESSION_KEY = 'fsm_user';

function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  state.currentUser = user;
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  state.currentUser = null;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatRupiah(n) {
  if (n === null || n === undefined || isNaN(n)) return 'Rp 0';
  const sign  = n < 0 ? '-' : '';
  const abs   = Math.abs(Math.round(n));
  const parts = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}Rp ${parts}`;
}

function formatRupiahShort(n) {
  const abs = Math.abs(n);
  if (abs >= 1e9)  return `Rp ${(n/1e9).toFixed(1)} M`;
  if (abs >= 1e6)  return `Rp ${(n/1e6).toFixed(1)} Jt`;
  if (abs >= 1e3)  return `Rp ${(n/1e3).toFixed(0)} Rb`;
  return formatRupiah(n);
}

function parseRupiahInput(str) {
  return parseFloat(str.replace(/\./g, '')) || 0;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getInitial(name) {
  if (!name) return '?';
  return name.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function el(id)  { return document.getElementById(id); }
function qs(sel) { return document.querySelector(sel); }
function qsa(sel){ return document.querySelectorAll(sel); }

async function apiFetch(path, opts = {}) {
  try {
    const res = await fetch(API + path, {
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Server error');
    return data;
  } catch(e) {
    if (e.name === 'TypeError') showOfflineBanner(true);
    throw e;
  }
}

// ─── LOGIN / LOGOUT ───────────────────────────────────────────────────────────

function showLoginScreen() {
  lucide.createIcons();
  const ls = el('login-screen');
  const app = el('app');
  ls.classList.remove('hidden');
  app.classList.add('hidden');

  const nameInput  = el('login-name');
  const emailInput = el('login-email');
  const btn        = el('btn-login');
  const errBox     = el('login-error');
  const errMsg     = el('login-error-msg');

  // Jika ada session sebelumnya, isi otomatis
  const prev = loadSession();
  if (prev) {
    nameInput.value  = prev.name  || '';
    emailInput.value = prev.email || '';
  }

  function setError(msg) {
    errMsg.textContent = msg;
    errBox.classList.toggle('hidden', !msg);
    if (msg) lucide.createIcons({ nodes: [errBox] });
  }

  async function doLogin() {
    const name  = nameInput.value.trim();
    const email = emailInput.value.trim();
    if (!name)  { setError('Nama wajib diisi.'); nameInput.focus(); return; }
    if (!email) { setError('Email wajib diisi.'); emailInput.focus(); return; }
    setError('');

    btn.disabled = true;
    el('login-btn-text').textContent = 'Memproses...';

    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, email }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.message || 'Login gagal.');
        return;
      }

      saveSession(data.data);
      showToast(data.message, 'success');
      enterApp(data.data);
      await initApp();
    } catch(e) {
      setError('Tidak dapat terhubung ke server. Pastikan server berjalan.');
    } finally {
      btn.disabled = false;
      el('login-btn-text').textContent = 'Masuk / Daftar';
    }
  }

  btn.addEventListener('click', doLogin);
  emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  nameInput.addEventListener('keydown',  e => { if (e.key === 'Enter') emailInput.focus(); });
}

function enterApp(user) {
  const ls  = el('login-screen');
  const app = el('app');
  ls.classList.add('hidden');
  app.classList.remove('hidden');

  // Update avatar & header
  el('avatar-initial').textContent   = getInitial(user.name);
  el('header-subtitle').textContent  = user.name;

  // Update settings user info
  if (el('settings-user-avatar')) el('settings-user-avatar').textContent = getInitial(user.name);
  if (el('settings-user-name'))   el('settings-user-name').textContent   = user.name;
  if (el('settings-user-email'))  el('settings-user-email').textContent  = user.email;
}

window.doLogout = function() {
  showConfirm('Keluar dari Akun?', `Anda akan keluar sebagai ${state.currentUser?.name || 'pengguna'}. Login ulang diperlukan.`, () => {
    clearSession();
    closeAllSheets();
    // Reset state
    state.categories = [];
    state.members    = [];
    state.settings   = {};
    // Refresh page to show login screen cleanly
    location.reload();
  });
};

// ─── OFFLINE BANNER ───────────────────────────────────────────────────────────
let offlineTimer;
function showOfflineBanner(show) {
  const b = el('offline-banner');
  clearTimeout(offlineTimer);
  if (show) {
    b.classList.remove('hidden');
    offlineTimer = setTimeout(() => b.classList.add('hidden'), 4000);
  } else {
    b.classList.add('hidden');
  }
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const icons = { success: 'check-circle', error: 'x-circle', info: 'info' };
  const container = el('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<i data-lucide="${icons[type] || 'info'}"></i><span>${message}</span>`;
  container.appendChild(toast);
  lucide.createIcons({ nodes: [toast] });
  setTimeout(() => {
    toast.classList.add('bye');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 3200);
}

// ─── CONFIRM SHEET ────────────────────────────────────────────────────────────
function showConfirm(title, desc, onConfirm) {
  el('confirm-title').textContent = title;
  el('confirm-desc').textContent  = desc;
  state.deleteCallback = onConfirm;
  openSheet('sheet-confirm');
}

// ─── BOTTOM SHEET ─────────────────────────────────────────────────────────────
function openSheet(id) {
  el('sheet-overlay').classList.add('active');
  el(id).classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeAllSheets() {
  el('sheet-overlay').classList.remove('active');
  document.querySelectorAll('.bottom-sheet').forEach(s => s.classList.remove('active'));
  document.body.style.overflow = '';
}

// ─── ROUTING ─────────────────────────────────────────────────────────────────
const views = ['dashboard', 'transactions', 'reports', 'settings'];

function navigate(view) {
  if (!views.includes(view)) view = 'dashboard';
  const old = el(`view-${state.currentView}`);
  const next = el(`view-${view}`);
  if (old) old.classList.remove('active');
  if (next) next.classList.add('active');

  // Update nav items
  qsa('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });

  state.currentView = view;

  // Load data for view
  switch (view) {
    case 'dashboard':    loadDashboard(); break;
    case 'transactions': loadTransactions(); break;
    case 'reports':      loadReport(); break;
    case 'settings':     loadSettings(); break;
  }
}

function handleHash() {
  const hash = location.hash.replace('#', '') || 'dashboard';
  navigate(hash);
}

// ─── COUNTING ANIMATION ───────────────────────────────────────────────────────
function animateCount(el, target, duration = 800) {
  const start     = performance.now();
  const isNeg     = target < 0;
  const absTarget = Math.abs(target);

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(absTarget * ease);
    const formatted = current.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    el.textContent = (isNeg ? '-' : '') + formatted;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

async function loadDashboard() {
  const now    = new Date();
  const month  = now.getMonth() + 1;
  const year   = now.getFullYear();

  // Update header subtitle
  el('header-subtitle').textContent = MONTH_NAMES[month - 1] + ' ' + year;
  el('balance-period').textContent  = MONTH_NAMES[month - 1] + ' ' + year;

  try {
    const [summaryRes, monthlyRes, recentRes] = await Promise.all([
      apiFetch(`/transactions/summary?month=${month}&year=${year}`),
      apiFetch('/transactions/monthly?months=6'),
      apiFetch(`/transactions?month=${month}&year=${year}`),
    ]);

    const { income, expense, balance } = summaryRes.data;

    // Balance animate
    animateCount(el('balance-number'), balance);

    // Mini cards
    el('dashboard-income').textContent  = formatRupiahShort(income);
    el('dashboard-expense').textContent = formatRupiahShort(expense);

    // Balance card color
    const bc = qs('.balance-card');
    if (balance < 0) {
      bc.style.background = 'linear-gradient(135deg, #c73350 0%, #a81f3d 100%)';
    } else {
      bc.style.background = 'linear-gradient(135deg, #2B7FD4 0%, #1A5BBF 100%)';
    }

    // Monthly chart
    state.monthlyData = monthlyRes.data;
    renderDashboardChart(monthlyRes.data);

    // Recent transactions (last 5)
    const txs = recentRes.data.slice(0, 5);
    renderRecentTx(txs);

  } catch(e) {
    showToast('Gagal memuat data dashboard.', 'error');
  }
}

function renderDashboardChart(data) {
  el('dashboard-chart-skeleton').style.display = 'none';
  el('dashboard-chart-wrap').style.display = 'block';

  const labels  = data.map(d => d.label);
  const incomes  = data.map(d => d.income);
  const expenses = data.map(d => d.expense);

  const ctx = el('dashboard-chart').getContext('2d');
  if (state.dashboardChartInstance) state.dashboardChartInstance.destroy();

  state.dashboardChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Pemasukan',
          data: incomes,
          backgroundColor: 'rgba(39,174,122,0.7)',
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: 'Pengeluaran',
          data: expenses,
          backgroundColor: 'rgba(224,68,90,0.7)',
          borderRadius: 6,
          borderSkipped: false,
        },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, font: { family: 'Satoshi', size: 11 } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${formatRupiah(ctx.parsed.y)}`,
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Satoshi', size: 11 } } },
        y: {
          grid: { color: 'rgba(100,160,220,0.1)' },
          ticks: { callback: v => formatRupiahShort(v), font: { family: 'Satoshi', size: 10 } }
        }
      }
    }
  });
}

function renderRecentTx(txs) {
  const container = el('recent-tx-list');
  if (!txs.length) {
    container.innerHTML = `<div class="empty-state">
      ${emptyStateSVG()}
      <div class="empty-state-title">Belum ada transaksi</div>
      <div class="empty-state-desc">Yuk mulai catat keuangan keluarga!</div>
    </div>`;
    return;
  }
  container.innerHTML = txs.map(tx => txItemHTML(tx, false)).join('');
  lucide.createIcons({ nodes: [container] });
}

function txItemHTML(tx, isCard = true) {
  const icon   = tx.category_icon || 'circle';
  const sign   = tx.type === 'income' ? '+' : '-';
  const cls    = tx.type === 'income' ? 'income' : 'expense';

  if (!isCard) {
    return `<div class="tx-item">
      <div class="tx-icon tx-icon--${cls}"><i data-lucide="${icon}"></i></div>
      <div class="tx-info">
        <div class="tx-name">${tx.description || tx.category_name || 'Transaksi'}</div>
        <div class="tx-meta">${formatDate(tx.date)}${tx.recorded_by ? ' · ' + tx.recorded_by : ''}</div>
      </div>
      <div class="tx-amount tx-amount--${cls}">${sign}${formatRupiah(tx.amount)}</div>
    </div>`;
  }

  return `<div class="tx-card" data-id="${tx.id}">
    <div class="tx-card-inner">
      <div class="tx-icon tx-icon--${cls}"><i data-lucide="${icon}"></i></div>
      <div class="tx-info">
        <div class="tx-name">${tx.description || tx.category_name || 'Transaksi'}</div>
        <div class="tx-meta">${formatDate(tx.date)}${tx.recorded_by ? ' · ' + tx.recorded_by : ''}</div>
      </div>
      <div class="tx-amount tx-amount--${cls}">${sign}${formatRupiah(tx.amount)}</div>
    </div>
    <div class="tx-card-actions">
      <button class="tx-action-btn tx-action-btn--edit" onclick="openEditTx(${tx.id})" aria-label="Edit">
        <i data-lucide="pencil"></i>Edit
      </button>
      <button class="tx-action-btn tx-action-btn--delete" onclick="confirmDeleteTx(${tx.id})" aria-label="Hapus">
        <i data-lucide="trash-2"></i>Hapus
      </button>
    </div>
  </div>`;
}

function emptyStateSVG() {
  return `<svg class="empty-state-icon" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="20" width="60" height="45" rx="10" fill="#D6EAFF" stroke="#2B7FD4" stroke-width="2"/>
    <rect x="20" y="32" width="40" height="6" rx="3" fill="#2B7FD4" opacity="0.3"/>
    <rect x="20" y="43" width="28" height="6" rx="3" fill="#2B7FD4" opacity="0.2"/>
    <circle cx="60" cy="18" r="10" fill="#27AE7A" opacity="0.7"/>
    <path d="M55 18 L59 22 L65 14" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TRANSACTIONS VIEW
// ═══════════════════════════════════════════════════════════════════════════════

async function loadTransactions() {
  populateDateFilters();
  renderTransactionsList();
}

function populateDateFilters() {
  const monthSel = el('tx-month');
  const yearSel  = el('tx-year');

  // Only populate once
  if (monthSel.options.length > 1) return;

  MONTH_NAMES.forEach((m, i) => {
    const o = new Option(m, i + 1);
    monthSel.appendChild(o);
  });

  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 3; y--) {
    yearSel.appendChild(new Option(y, y));
  }

  // Set current month/year
  monthSel.value = new Date().getMonth() + 1;
  yearSel.value  = currentYear;
  state.txFilters.month = monthSel.value;
  state.txFilters.year  = String(currentYear);
}

async function renderTransactionsList() {
  const container = el('tx-list-container');
  container.innerHTML = `<div class="skeleton-list">
    <div class="skeleton skeleton-tx"></div>
    <div class="skeleton skeleton-tx"></div>
    <div class="skeleton skeleton-tx"></div>
  </div>`;

  try {
    const { type, month, year, search } = state.txFilters;
    let url = '/transactions?';
    if (type)   url += `type=${type}&`;
    if (month)  url += `month=${month}&`;
    if (year)   url += `year=${year}&`;
    if (search) url += `search=${encodeURIComponent(search)}&`;

    const res = await apiFetch(url);
    const txs = res.data;

    if (!txs.length) {
      container.innerHTML = `<div class="empty-state">
        ${emptyStateSVG()}
        <div class="empty-state-title">Belum ada transaksi</div>
        <div class="empty-state-desc">Yuk mulai catat keuangan keluarga!</div>
      </div>`;
      return;
    }

    container.innerHTML = txs.map(tx => txItemHTML(tx, true)).join('');
    lucide.createIcons({ nodes: [container] });
    initSwipeGestures();
  } catch(e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-desc">Gagal memuat transaksi.</div></div>`;
  }
}

// Swipe Gestures
function initSwipeGestures() {
  qsa('.tx-card').forEach(card => {
    let startX = 0;
    let startY = 0;
    let isSwiping = false;

    card.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isSwiping = false;
    }, { passive: true });

    card.addEventListener('touchmove', e => {
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (!isSwiping && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
        isSwiping = true;
      }
    }, { passive: true });

    card.addEventListener('touchend', e => {
      if (!isSwiping) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (dx < -50) {
        closeAllSwipedCards(card);
        card.classList.add('swiped');
      } else if (dx > 20) {
        card.classList.remove('swiped');
      }
    });

    // Click outside to close
    card.querySelector('.tx-card-inner')?.addEventListener('click', () => {
      if (card.classList.contains('swiped')) {
        card.classList.remove('swiped');
      }
    });
  });
}

function closeAllSwipedCards(except) {
  qsa('.tx-card.swiped').forEach(c => { if (c !== except) c.classList.remove('swiped'); });
}

window.openEditTx = async function(id) {
  openSheet('sheet-add-tx');
  state.editingTxId = id;
  el('sheet-title').textContent  = 'Edit Transaksi';
  el('btn-delete-tx').classList.remove('hidden');

  try {
    const res = await apiFetch(`/transactions?`);
    const tx  = res.data.find(t => t.id === id);
    if (!tx) { showToast('Transaksi tidak ditemukan.', 'error'); return; }

    setTxType(tx.type);
    el('tx-amount').value       = formatAmountDisplay(tx.amount);
    el('tx-date').value         = tx.date;
    el('tx-desc').value         = tx.description || '';
    el('tx-recorded-by').value  = tx.recorded_by || '';

    await loadCategoryGrid();
    if (tx.category_id) {
      state.selectedCatId = tx.category_id;
      highlightSelectedCategory();
    }
  } catch(e) {
    showToast('Gagal memuat data transaksi.', 'error');
  }
};

window.confirmDeleteTx = function(id) {
  showConfirm('Hapus Transaksi?', 'Transaksi ini akan dihapus permanen.', async () => {
    try {
      await apiFetch(`/transactions/${id}`, { method: 'DELETE' });
      showToast('Transaksi berhasil dihapus.', 'success');
      closeAllSheets();
      if (state.currentView === 'transactions') renderTransactionsList();
      else loadDashboard();
    } catch(e) {
      showToast(e.message || 'Gagal menghapus.', 'error');
    }
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ADD / EDIT TRANSACTION SHEET
// ═══════════════════════════════════════════════════════════════════════════════

function openAddTxSheet() {
  state.editingTxId = null;
  el('sheet-title').textContent = 'Tambah Transaksi';
  el('btn-delete-tx').classList.add('hidden');
  el('tx-amount').value = '';
  el('tx-date').value   = todayStr();
  el('tx-desc').value   = '';
  el('tx-recorded-by').value = '';
  state.selectedCatId = null;
  setTxType('expense');
  loadCategoryGrid();
  openSheet('sheet-add-tx');
}

function setTxType(type) {
  state.currentType = type;
  el('btn-type-expense').classList.toggle('active', type === 'expense');
  el('btn-type-income').classList.toggle('active', type === 'income');
  state.selectedCatId = null;
  loadCategoryGrid();
}

async function loadCategoryGrid() {
  const grid = el('category-grid');
  grid.innerHTML = '<div class="skeleton" style="height:80px;grid-column:1/-1"></div>';

  try {
    if (!state.categories.length) {
      const res = await apiFetch('/categories');
      state.categories = res.data;
    }
    const filtered = state.categories.filter(c => c.type === state.currentType || c.type === 'both');
    grid.innerHTML = filtered.map(cat => `
      <button class="cat-pill${state.selectedCatId === cat.id ? ' active' : ''}"
              data-cat-id="${cat.id}" onclick="selectCategory(${cat.id})">
        <i data-lucide="${cat.icon}"></i>
        <span class="cat-pill-label">${cat.name}</span>
      </button>
    `).join('');
    lucide.createIcons({ nodes: [grid] });
  } catch(e) {
    grid.innerHTML = '';
  }
}

function highlightSelectedCategory() {
  qsa('.cat-pill').forEach(p => {
    p.classList.toggle('active', parseInt(p.dataset.catId) === state.selectedCatId);
  });
}

window.selectCategory = function(id) {
  state.selectedCatId = id;
  highlightSelectedCategory();
};

async function saveTx() {
  const amount = parseRupiahInput(el('tx-amount').value);
  const date   = el('tx-date').value;

  if (!amount || amount <= 0) { showToast('Nominal harus diisi.', 'error'); return; }
  if (!date)                  { showToast('Tanggal harus diisi.', 'error'); return; }
  if (!state.selectedCatId)  { showToast('Pilih kategori terlebih dahulu.', 'error'); return; }

  const payload = {
    type:        state.currentType,
    amount,
    category_id: state.selectedCatId,
    description: el('tx-desc').value.trim(),
    recorded_by: el('tx-recorded-by').value.trim(),
    date,
  };

  try {
    const btn = el('btn-save-tx');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" style="animation:spin 1s linear infinite"></i> Menyimpan...';
    lucide.createIcons({ nodes: [btn] });

    if (state.editingTxId) {
      await apiFetch(`/transactions/${state.editingTxId}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Transaksi berhasil diperbarui.', 'success');
    } else {
      await apiFetch('/transactions', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Transaksi berhasil disimpan.', 'success');
    }

    closeAllSheets();
    state.categories = []; // Refresh cache
    if (state.currentView === 'transactions') renderTransactionsList();
    else loadDashboard();

  } catch(e) {
    showToast(e.message || 'Gagal menyimpan transaksi.', 'error');
  } finally {
    const btn = el('btn-save-tx');
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="check"></i> Simpan Transaksi';
    lucide.createIcons({ nodes: [btn] });
  }
}

// Amount input auto-format
function formatAmountDisplay(val) {
  const num = parseFloat(String(val).replace(/\./g, '')) || 0;
  return num === 0 ? '' : num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  REPORTS VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function getReportDates() {
  const now   = new Date();
  const range = state.reportRange;

  if (range === 'month') {
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    return {
      start: `${y}-${String(m).padStart(2,'0')}-01`,
      end:   `${y}-${String(m).padStart(2,'0')}-31`,
    };
  }
  if (range === '3months') {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return { start: start.toISOString().slice(0,10), end: now.toISOString().slice(0,10) };
  }
  if (range === '6months') {
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    return { start: start.toISOString().slice(0,10), end: now.toISOString().slice(0,10) };
  }
  if (range === 'year') {
    return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` };
  }
  if (range === 'custom') {
    return { start: el('report-start').value, end: el('report-end').value };
  }
  return { start: now.toISOString().slice(0,10), end: now.toISOString().slice(0,10) };
}

async function loadReport() {
  const { start, end } = getReportDates();
  if (!start || !end) return;

  try {
    const res = await apiFetch(`/transactions/report?start_date=${start}&end_date=${end}`);
    state.reportData = res.data;
    renderReportUI(res.data);
  } catch(e) {
    showToast('Gagal memuat laporan.', 'error');
  }
}

const CHART_COLORS = [
  '#2B7FD4','#27AE7A','#E0445A','#F5A623','#9B59B6',
  '#1ABC9C','#E67E22','#3498DB','#E74C3C','#2ECC71',
];

function renderReportUI(data) {
  const { summary, transactions, category_breakdown } = data;

  // Summary cards
  el('report-income').textContent  = formatRupiah(summary.income);
  el('report-expense').textContent = formatRupiah(summary.expense);
  el('report-balance').textContent = formatRupiah(summary.balance);

  // Donut chart — expense categories
  const expCats = category_breakdown.filter(c => c.type === 'expense');
  renderDonutChart(expCats);

  // Bar chart — monthly trend (use all transactions)
  renderReportBarChart(transactions);

  // Category table
  renderCategoryTable(category_breakdown);
}

function renderDonutChart(cats) {
  const ctx = el('report-donut-chart').getContext('2d');
  if (state.reportDonutInstance) state.reportDonutInstance.destroy();
  if (!cats.length) return;

  state.reportDonutInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: cats.map(c => c.name),
      datasets: [{
        data: cats.map(c => c.total),
        backgroundColor: CHART_COLORS.slice(0, cats.length),
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, font: { family: 'Satoshi', size: 12 }, padding: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${formatRupiah(ctx.parsed)}` } }
      }
    }
  });
}

function renderReportBarChart(transactions) {
  if (!transactions.length) return;
  const ctx = el('report-bar-chart').getContext('2d');
  if (state.reportBarInstance) state.reportBarInstance.destroy();

  // Group by month-year
  const monthMap = {};
  transactions.forEach(tx => {
    const key = tx.date.slice(0,7);
    if (!monthMap[key]) monthMap[key] = { income: 0, expense: 0 };
    monthMap[key][tx.type] += tx.amount;
  });

  const sortedKeys = Object.keys(monthMap).sort();
  const labels     = sortedKeys.map(k => {
    const [y, m] = k.split('-');
    return MONTH_NAMES[parseInt(m)-1].slice(0,3) + ' ' + y.slice(2);
  });

  state.reportBarInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Pemasukan', data: sortedKeys.map(k => monthMap[k].income),  backgroundColor: 'rgba(39,174,122,0.7)', borderRadius: 6, borderSkipped: false },
        { label: 'Pengeluaran', data: sortedKeys.map(k => monthMap[k].expense), backgroundColor: 'rgba(224,68,90,0.7)',  borderRadius: 6, borderSkipped: false },
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, font: { family: 'Satoshi', size: 11 } } },
        tooltip: { callbacks: { label: ctx => ` ${formatRupiah(ctx.parsed.y)}` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Satoshi', size: 11 } } },
        y: { grid: { color: 'rgba(100,160,220,0.1)' }, ticks: { callback: v => formatRupiahShort(v), font: { family:'Satoshi', size:10 } } }
      }
    }
  });
}

function renderCategoryTable(cats) {
  const container = el('report-category-table');
  if (!cats.length) { container.innerHTML = '<div class="empty-state-desc" style="padding:16px">Belum ada data.</div>'; return; }

  const totalExpense = cats.filter(c=>c.type==='expense').reduce((s,c)=>s+c.total,0);

  container.innerHTML = cats.map((c, i) => {
    const pct = totalExpense > 0 && c.type === 'expense' ? ((c.total / totalExpense) * 100).toFixed(1) : '—';
    return `<div class="cat-table-row">
      <div class="cat-table-icon" style="background:${CHART_COLORS[i % CHART_COLORS.length]}22;color:${CHART_COLORS[i % CHART_COLORS.length]}">
        <i data-lucide="${c.icon || 'tag'}"></i>
      </div>
      <div class="cat-table-info">
        <div class="cat-table-name">${c.name}</div>
        <div class="cat-table-count">${c.count} transaksi</div>
      </div>
      <div>
        <div class="cat-table-amount">${formatRupiah(c.total)}</div>
        <div class="cat-table-pct">${pct}${pct !== '—' ? '%' : ''}</div>
      </div>
    </div>`;
  }).join('');
  lucide.createIcons({ nodes: [container] });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

function exportExcel() {
  if (!state.reportData) { showToast('Load laporan terlebih dahulu.', 'error'); return; }
  const { transactions, summary, category_breakdown } = state.reportData;

  const wb = XLSX.utils.book_new();

  // Sheet 1: Semua Transaksi
  const txRows = transactions.map(t => ({
    'Tanggal':      t.date,
    'Tipe':         t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
    'Kategori':     t.category_name || '',
    'Keterangan':   t.description || '',
    'Pencatat':     t.recorded_by || '',
    'Nominal (Rp)': t.amount,
  }));
  const ws1 = XLSX.utils.json_to_sheet(txRows);
  ws1['!cols'] = [{ wch:12},{wch:12},{wch:16},{wch:30},{wch:14},{wch:16}];
  XLSX.utils.book_append_sheet(wb, ws1, 'Transaksi');

  // Sheet 2: Ringkasan
  const summaryRows = [
    { 'Item': 'Total Pemasukan', 'Nominal (Rp)': summary.income },
    { 'Item': 'Total Pengeluaran', 'Nominal (Rp)': summary.expense },
    { 'Item': 'Net Cashflow', 'Nominal (Rp)': summary.balance },
    { 'Item': '', 'Nominal (Rp)': '' },
    ...category_breakdown.map(c=>({ 'Item': c.name, 'Nominal (Rp)': c.total }))
  ];
  const ws2 = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, ws2, 'Ringkasan');

  const { start, end } = getReportDates();
  XLSX.writeFile(wb, `FSM-Laporan-${start}-sd-${end}.xlsx`);
  showToast('File Excel berhasil diunduh.', 'success');
}

function exportPDF() {
  if (!state.reportData) { showToast('Load laporan terlebih dahulu.', 'error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const { transactions, summary } = state.reportData;
  const { start, end } = getReportDates();
  const familyName = state.settings.family_name || 'Keluarga Kita';

  // Header
  doc.setFillColor(43, 127, 212);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Family Smart Money', 14, 12);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Laporan Keuangan — ${familyName}`, 14, 19);
  doc.text(`Periode: ${formatDate(start)} – ${formatDate(end)}`, 14, 25);

  // Summary
  doc.setTextColor(26, 43, 60);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Ringkasan', 14, 38);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Total Pemasukan : ${formatRupiah(summary.income)}`, 14, 46);
  doc.text(`Total Pengeluaran: ${formatRupiah(summary.expense)}`, 14, 53);
  doc.text(`Net Cashflow     : ${formatRupiah(summary.balance)}`, 14, 60);

  // Table
  const rows = transactions.map(t => [
    t.date,
    t.type === 'income' ? 'Masuk' : 'Keluar',
    t.category_name || '-',
    t.description || '-',
    formatRupiah(t.amount),
  ]);

  doc.autoTable({
    startY: 68,
    head: [['Tanggal','Tipe','Kategori','Keterangan','Nominal']],
    body: rows,
    styles: { fontSize: 9, cellPadding: 3, font: 'helvetica' },
    headStyles: { fillColor: [43, 127, 212], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240, 247, 255] },
    columnStyles: {
      0: { cellWidth: 24 }, 1: { cellWidth: 18 }, 2: { cellWidth: 28 },
      3: { cellWidth: 'auto' }, 4: { cellWidth: 36, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(107, 139, 164);
    doc.text(`Family Smart Money — Halaman ${i} dari ${pageCount}`, 14, 290);
    doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID')}`, 196, 290, { align: 'right' });
  }

  doc.save(`FSM-Laporan-${start}-sd-${end}.pdf`);
  showToast('File PDF berhasil diunduh.', 'success');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SETTINGS VIEW
// ═══════════════════════════════════════════════════════════════════════════════

async function loadSettings() {
  try {
    const [settingsRes, membersRes, catsRes] = await Promise.all([
      apiFetch('/settings'),
      apiFetch('/members'),
      apiFetch('/categories'),
    ]);

    state.settings = settingsRes.data;
    state.members  = membersRes.data;
    state.categories = catsRes.data;

    // Family name
    const fn = state.settings.family_name || 'Keluarga Kita';
    el('family-name-display').textContent = fn;
    el('family-name-input').value = fn;

    // Avatar: pakai nama user jika sudah login, otherwise nama keluarga
    const user = state.currentUser;
    if (user) {
      el('avatar-initial').textContent  = getInitial(user.name);
      el('header-subtitle').textContent = user.name;
      // Settings user info
      if (el('settings-user-avatar')) el('settings-user-avatar').textContent = getInitial(user.name);
      if (el('settings-user-name'))   el('settings-user-name').textContent   = user.name;
      if (el('settings-user-email'))  el('settings-user-email').textContent  = user.email;
    } else {
      el('avatar-initial').textContent  = getInitial(fn);
      el('header-subtitle').textContent = fn;
    }

    renderMembersList();
    renderCustomCategories();
  } catch(e) {
    showToast('Gagal memuat pengaturan.', 'error');
  }
}

function renderMembersList() {
  const list = el('members-list');
  list.innerHTML = state.members.map(m => `
    <div class="member-item">
      <div class="member-avatar">${getInitial(m.name)}</div>
      <div class="member-name">${m.name}</div>
      <button class="btn-icon-sm" onclick="deleteMember(${m.id})" aria-label="Hapus ${m.name}">
        <i data-lucide="x"></i>
      </button>
    </div>
  `).join('') || '<div class="empty-state-desc" style="padding:8px 0">Belum ada anggota.</div>';
  lucide.createIcons({ nodes: [list] });
}

function renderCustomCategories() {
  const list    = el('custom-categories-list');
  const customs = state.categories.filter(c => !c.is_default);
  list.innerHTML = customs.map(c => `
    <div class="cat-settings-item">
      <div class="cat-settings-icon"><i data-lucide="${c.icon}"></i></div>
      <div class="cat-settings-info">
        <div class="cat-settings-name">${c.name}</div>
        <div class="cat-settings-type">${c.type === 'income' ? 'Pemasukan' : c.type === 'expense' ? 'Pengeluaran' : 'Keduanya'}</div>
      </div>
      <button class="btn-icon-sm" onclick="deleteCategory(${c.id})" aria-label="Hapus ${c.name}">
        <i data-lucide="trash-2"></i>
      </button>
    </div>
  `).join('') || '<div class="empty-state-desc" style="padding:8px 0">Belum ada kategori kustom.</div>';
  lucide.createIcons({ nodes: [list] });
}

window.deleteMember = function(id) {
  showConfirm('Hapus Anggota?', 'Anggota ini akan dihapus dari daftar.', async () => {
    try {
      await apiFetch(`/members/${id}`, { method: 'DELETE' });
      showToast('Anggota dihapus.', 'success');
      closeAllSheets();
      state.members = state.members.filter(m => m.id !== id);
      renderMembersList();
      renderMemberSuggest();
    } catch(e) { showToast(e.message, 'error'); }
  });
};

window.deleteCategory = function(id) {
  showConfirm('Hapus Kategori?', 'Kategori ini akan dihapus.', async () => {
    try {
      await apiFetch(`/categories/${id}`, { method: 'DELETE' });
      showToast('Kategori dihapus.', 'success');
      closeAllSheets();
      state.categories = state.categories.filter(c => c.id !== id);
      renderCustomCategories();
    } catch(e) { showToast(e.message, 'error'); }
  });
};

function renderMemberSuggest() {
  const suggest = el('members-suggest');
  suggest.innerHTML = state.members.map(m =>
    `<button class="member-chip" onclick="el('tx-recorded-by').value='${m.name}'">${m.name}</button>`
  ).join('');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════════════════

function initEventListeners() {

  // ── ROUTING ───────────────────────────────────────────────────────────────
  window.addEventListener('hashchange', handleHash);

  // Bottom nav
  qsa('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      location.hash = btn.dataset.view;
    });
  });

  // ── FAB ───────────────────────────────────────────────────────────────────
  el('fab-add').addEventListener('click', () => {
    openAddTxSheet();
    el('fab-add').classList.add('open');
  });

  // ── SHEET CLOSE ───────────────────────────────────────────────────────────
  el('sheet-overlay').addEventListener('click', () => {
    closeAllSheets();
    el('fab-add').classList.remove('open');
  });
  el('btn-close-sheet').addEventListener('click', () => {
    closeAllSheets();
    el('fab-add').classList.remove('open');
  });

  // ── TYPE TOGGLE ───────────────────────────────────────────────────────────
  el('btn-type-expense').addEventListener('click', () => setTxType('expense'));
  el('btn-type-income').addEventListener('click',  () => setTxType('income'));

  // ── AMOUNT FORMAT ─────────────────────────────────────────────────────────
  el('tx-amount').addEventListener('input', function() {
    const raw = this.value.replace(/\./g, '').replace(/\D/g, '');
    const num = parseInt(raw) || 0;
    const cur = this.selectionStart;
    this.value = num === 0 ? '' : num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    try { this.setSelectionRange(cur, cur); } catch(e){}
  });

  // ── SAVE TRANSACTION ──────────────────────────────────────────────────────
  el('btn-save-tx').addEventListener('click', saveTx);

  // ── AI SCANNER LAB ────────────────────────────────────────────────────────
  window.syncAiToForm = function() {
    let total = 0;
    let descLines = [];
    const store = el('ai-store-name').value.trim();
    if (store) descLines.push(store);
    
    document.querySelectorAll('.ai-item-row').forEach(row => {
      const n = row.querySelector('.ai-item-name').value.trim();
      let pStr = row.querySelector('.ai-item-price').value.replace(/\D/g, '');
      const p = parseInt(pStr) || 0;
      total += p;
      if (n) descLines.push(`- ${n}: Rp ${p.toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.')}`);
    });
    
    // Update labels
    el('ai-calc-total').textContent = `Rp ${total.toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.')}`;
    
    // Sync to actual hidden DB form
    el('tx-amount').value = total === 0 ? '' : total.toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');
    el('tx-desc').value = descLines.join('\\n');
  };

  window.addAiReviewRow = function(name = '', price = 0) {
    const list = el('ai-review-list');
    const row = document.createElement('div');
    row.className = 'ai-item-row';
    row.innerHTML = `
      <input type="text" class="ai-item-name" value="${name}" placeholder="Nama barang" />
      <input type="text" class="ai-item-price" value="${price}" placeholder="0" inputmode="numeric" />
      <button class="btn-remove-item"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
    `;
    
    // Auto format price
    row.querySelector('.ai-item-price').addEventListener('input', function() {
      const raw = this.value.replace(/\\D/g, '');
      const num = parseInt(raw) || 0;
      this.value = num === 0 ? '' : num.toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');
      window.syncAiToForm();
    });
    row.querySelector('.ai-item-name').addEventListener('input', window.syncAiToForm);
    row.querySelector('.btn-remove-item').addEventListener('click', () => {
      row.remove();
      window.syncAiToForm();
    });
    
    // format initial
    const priceInput = row.querySelector('.ai-item-price');
    if (price > 0) priceInput.value = price.toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');
    
    list.appendChild(row);
  };
  
  el('ai-store-name').addEventListener('input', window.syncAiToForm);
  el('btn-add-review-item').addEventListener('click', () => {
    window.addAiReviewRow('', 0);
  });

  const aiInput = el('ai-file-input');
  if (aiInput) {
    aiInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Show loading
      el('ai-scan-banner').classList.add('hidden');
      el('ai-loading-overlay').classList.remove('hidden');
      el('ai-review-wrapper').classList.add('hidden');

      try {
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = error => reject(error);
        });
        reader.readAsDataURL(file);
        const imageBase64 = await base64Promise;

        const res = await fetch('/api/ai/scan-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64, mimeType: file.type })
        });
        
        const json = await res.json();
        
        if (json.success && json.data) {
          showToast('Silakan cek keranjang belanja!', 'success');
          setTxType('expense');
          
          el('ai-store-name').value = json.data.storeName || 'Merchant Terpisah';
          el('ai-review-list').innerHTML = '';
          
          const items = Array.isArray(json.data.items) ? json.data.items : [];
          if (items.length === 0) items.push({ name: 'Pembelanjaan', price: 0 }); // fallback
          
          items.forEach(i => window.addAiReviewRow(i.name, i.price));
          
          el('ai-review-wrapper').classList.remove('hidden');
          window.syncAiToForm();
          
        } else {
          showToast(json.message || 'Gagal mengenali struk.', 'error');
        }
      } catch (err) {
        showToast('Terjadi kesalahan jaringan.', 'error');
        console.error(err);
      } finally {
        el('ai-loading-overlay').classList.add('hidden');
        // biarkan banner hidden jika mau, atau muncul lagi
        // el('ai-scan-banner').classList.remove('hidden'); 
        aiInput.value = '';
      }
    });
  }

  // ── DELETE TRANSACTION (in edit mode) ─────────────────────────────────────
  el('btn-delete-tx').addEventListener('click', () => {
    if (state.editingTxId) window.confirmDeleteTx(state.editingTxId);
  });

  // ── CONFIRM SHEET ─────────────────────────────────────────────────────────
  el('btn-confirm-cancel').addEventListener('click', closeAllSheets);
  el('btn-confirm-ok').addEventListener('click', () => {
    if (state.deleteCallback) { state.deleteCallback(); state.deleteCallback = null; }
  });

  // ── SEE ALL TRANSACTIONS ─────────────────────────────────────────────────
  el('btn-see-all-tx').addEventListener('click', () => { location.hash = 'transactions'; });

  // Header avatar → settings
  el('header-avatar').addEventListener('click', () => { location.hash = 'settings'; });

  // ── TRANSACTION FILTERS ───────────────────────────────────────────────────
  qsa('#tx-filter-pills .pill').forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('#tx-filter-pills .pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      state.txFilters.type = btn.dataset.type;
      renderTransactionsList();
    });
  });

  el('tx-month').addEventListener('change', e => { state.txFilters.month = e.target.value; renderTransactionsList(); });
  el('tx-year').addEventListener('change',  e => { state.txFilters.year  = e.target.value; renderTransactionsList(); });

  // Search
  let searchTimer;
  el('tx-search').addEventListener('input', e => {
    const val = e.target.value;
    el('tx-search-clear').classList.toggle('hidden', !val);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.txFilters.search = val;
      renderTransactionsList();
    }, 350);
  });
  el('tx-search-clear').addEventListener('click', () => {
    el('tx-search').value = '';
    el('tx-search-clear').classList.add('hidden');
    state.txFilters.search = '';
    renderTransactionsList();
  });

  // ── REPORT RANGE PILLS ───────────────────────────────────────────────────
  qsa('#report-range-pills .pill').forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('#report-range-pills .pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      state.reportRange = btn.dataset.range;
      const isCustom = state.reportRange === 'custom';
      el('report-custom-range').classList.toggle('hidden', !isCustom);
      if (!isCustom) loadReport();
    });
  });

  el('btn-report-apply').addEventListener('click', loadReport);

  // ── EXPORT ────────────────────────────────────────────────────────────────
  el('btn-export-excel').addEventListener('click', exportExcel);
  el('btn-export-pdf').addEventListener('click',   exportPDF);

  // ── SETTINGS: FAMILY NAME ─────────────────────────────────────────────────
  el('btn-edit-family-name').addEventListener('click', () => {
    el('family-name-edit-row').classList.remove('hidden');
    el('family-name-input').focus();
  });
  el('btn-cancel-family-name').addEventListener('click', () => {
    el('family-name-edit-row').classList.add('hidden');
  });
  el('btn-save-family-name').addEventListener('click', async () => {
    const val = el('family-name-input').value.trim();
    if (!val) return;
    try {
      await apiFetch('/settings', { method: 'PUT', body: JSON.stringify({ key: 'family_name', value: val }) });
      el('family-name-display').textContent = val;
      el('header-subtitle').textContent     = val;
      el('avatar-initial').textContent      = getInitial(val);
      state.settings.family_name            = val;
      el('family-name-edit-row').classList.add('hidden');
      showToast('Nama keluarga disimpan.', 'success');
    } catch(e) { showToast(e.message, 'error'); }
  });

  // ── SETTINGS: ADD MEMBER ──────────────────────────────────────────────────
  el('btn-add-member').addEventListener('click', async () => {
    const name = el('new-member-name').value.trim();
    if (!name) return;
    try {
      const res = await apiFetch('/members', { method: 'POST', body: JSON.stringify({ name }) });
      state.members.push(res.data);
      el('new-member-name').value = '';
      renderMembersList();
      renderMemberSuggest();
      showToast(`${name} berhasil ditambahkan.`, 'success');
    } catch(e) { showToast(e.message, 'error'); }
  });
  el('new-member-name').addEventListener('keydown', e => { if (e.key === 'Enter') el('btn-add-member').click(); });

  // ── SETTINGS: ADD CATEGORY ────────────────────────────────────────────────
  el('btn-add-category').addEventListener('click', async () => {
    const name = el('new-cat-name').value.trim();
    const icon = el('new-cat-icon').value.trim() || 'tag';
    const type = el('new-cat-type').value;
    if (!name) { showToast('Nama kategori wajib diisi.', 'error'); return; }
    try {
      const res = await apiFetch('/categories', { method: 'POST', body: JSON.stringify({ name, icon, type }) });
      state.categories.push(res.data);
      el('new-cat-name').value = '';
      el('new-cat-icon').value = '';
      renderCustomCategories();
      showToast('Kategori ditambahkan.', 'success');
    } catch(e) { showToast(e.message, 'error'); }
  });

  // ── BACKUP ────────────────────────────────────────────────────────────────
  el('btn-backup').addEventListener('click', () => {
    window.location.href = `${API}/backup`;
    showToast('Mengunduh backup...', 'info');
  });

  // ── RESTORE ───────────────────────────────────────────────────────────────
  el('restore-file-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const json = JSON.parse(ev.target.result);
        await apiFetch('/restore', { method: 'POST', body: JSON.stringify(json) });
        showToast('Data berhasil direstore!', 'success');
        state.categories = [];
        loadSettings();
        loadDashboard();
      } catch(e2) { showToast('File backup tidak valid.', 'error'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // ── RESET ─────────────────────────────────────────────────────────────────
  el('btn-reset-data').addEventListener('click', () => {
    showConfirm(
      'Reset Semua Data?',
      'Semua transaksi akan dihapus permanen. Pengaturan dan anggota keluarga tidak terpengaruh.',
      async () => {
        try {
          await apiFetch('/reset', { method: 'DELETE' });
          showToast('Semua data berhasil direset.', 'success');
          closeAllSheets();
          loadDashboard();
        } catch(e) { showToast(e.message, 'error'); }
      }
    );
  });

  // ── KEYBOARD ──────────────────────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeAllSheets(); el('fab-add').classList.remove('open'); }
  });

  // ── LOGOUT ───────────────────────────────────────────────────────────────
  const btnLogout = el('btn-logout');
  if (btnLogout) btnLogout.addEventListener('click', window.doLogout);
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

async function init() {
  // Init Lucide icons
  lucide.createIcons();

  // ── CEK SESSION LOGIN ──────────────────────────────────────────────────────
  const savedUser = loadSession();

  if (savedUser) {
    // Ada session — verifikasi ke server
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'x-user-email': savedUser.email }
      });
      const data = await res.json();
      if (data.success) {
        saveSession(data.data);
        enterApp(data.data);
        await initApp();
        return;
      }
    } catch(e) { /* server offline */ }

    // Fallback: pakai data lokal
    enterApp(savedUser);
    await initApp();
    return;
  }

  // Tidak ada session — tampilkan login screen
  showLoginScreen();
}

async function initApp() {
  await loadGlobalData();
  initEventListeners();
  handleHash();
}

async function loadGlobalData() {
  try {
    const [settingsRes, membersRes] = await Promise.all([
      apiFetch('/settings'),
      apiFetch('/members'),
    ]);
    state.settings = settingsRes.data;
    state.members  = membersRes.data;

    const fn = state.settings.family_name || 'Keluarga Kita';
    // Hanya update subtitle jika belum diisi nama user
    if (!state.currentUser) {
      el('avatar-initial').textContent = getInitial(fn);
    }

    renderMemberSuggest();
  } catch(e) {
    // Server not reachable yet, will show on demand
  }
}

// Wait for DOM + all scripts to load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// CSS spin animation for loader
const styleEl = document.createElement('style');
styleEl.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
document.head.appendChild(styleEl);
