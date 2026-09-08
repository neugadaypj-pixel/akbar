// ---------- State ----------
let transactions = [];
let currentFilter = 'all';

// ---------- DOM Elements ----------
const form = document.getElementById('transaction-form');
const typeSelect = document.getElementById('type');
const amountInput = document.getElementById('amount');
const dateInput = document.getElementById('date');
const descriptionInput = document.getElementById('description');
const categoryInput = document.getElementById('category');

const totalIncomeEl = document.getElementById('total-income');
const totalExpensesEl = document.getElementById('total-expenses');
const balanceEl = document.getElementById('balance');
const transactionsListEl = document.getElementById('transactions-list');
const filterButtons = document.querySelectorAll('.filter-btn');

// ---------- Helpers ----------
function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ---------- API Calls ----------
async function fetchTransactions() {
  const res = await fetch('/api/transactions');
  if (!res.ok) throw new Error('Failed to fetch transactions');
  transactions = await res.json();
}

async function fetchSummary() {
  const res = await fetch('/api/summary');
  if (!res.ok) throw new Error('Failed to fetch summary');
  return res.json();
}

async function addTransaction(payload) {
  const res = await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to add transaction');
  }
  return res.json();
}

async function deleteTransaction(id) {
  const res = await fetch(`/api/transactions/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete transaction');
}

// ---------- Render ----------
function renderSummary(summary) {
  totalIncomeEl.textContent = formatCurrency(summary.income);
  totalExpensesEl.textContent = formatCurrency(summary.expenses);
  balanceEl.textContent = formatCurrency(summary.balance);

  // Tint the balance card based on sign
  balanceEl.style.color =
    summary.balance >= 0 ? 'var(--accent)' : 'var(--expense)';
}

function renderTransactions() {
  const filtered = transactions.filter((t) => {
    if (currentFilter === 'all') return true;
    return t.type === currentFilter;
  });

  if (filtered.length === 0) {
    transactionsListEl.innerHTML =
      '<p class="empty-state">No transactions found.</p>';
    return;
  }

  transactionsListEl.innerHTML = filtered
    .map(
      (t) => `
      <div class="transaction">
        <div class="info">
          <span class="description">${escapeHtml(t.description)}</span>
          <span class="meta">${escapeHtml(t.category)} · ${formatDate(t.date)}</span>
        </div>
        <div class="amount ${t.type}">
          ${t.type === 'income' ? '+' : '−'}${formatCurrency(t.amount)}
        </div>
        <div class="actions">
          <button class="delete-btn" data-id="${t._id}" title="Delete">🗑️</button>
        </div>
      </div>
    `
    )
    .join('');

  // Attach delete handlers
  transactionsListEl.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => onDelete(btn.dataset.id));
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Actions ----------
async function refresh() {
  try {
    const [summary] = await Promise.all([fetchSummary(), fetchTransactions()]);
    renderSummary(summary);
    renderTransactions();
  } catch (err) {
    transactionsListEl.innerHTML = `<div class="error-banner">${escapeHtml(
      err.message
    )}</div>`;
  }
}

async function onSubmit(e) {
  e.preventDefault();

  const payload = {
    type: typeSelect.value,
    description: descriptionInput.value,
    category: categoryInput.value,
    amount: parseFloat(amountInput.value),
    date: dateInput.value,
  };

  try {
    await addTransaction(payload);
    form.reset();
    // Reset date to today after clearing
    dateInput.value = new Date().toISOString().slice(0, 10);
    typeSelect.value = 'income';
    await refresh();
  } catch (err) {
    alert(err.message);
  }
}

async function onDelete(id) {
  if (!confirm('Delete this transaction?')) return;
  try {
    await deleteTransaction(id);
    await refresh();
  } catch (err) {
    alert(err.message);
  }
}

// ---------- Event Listeners ----------
form.addEventListener('submit', onSubmit);

filterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    filterButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderTransactions();
  });
});

// ---------- Init ----------
dateInput.value = new Date().toISOString().slice(0, 10);
refresh();
