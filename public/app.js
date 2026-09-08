// ============================================================
// Market Manager — single-page app (i18n: en/uz/ru)
// ============================================================

// ---------- State ----------
let settings = { currency: 'USD', businessName: 'Market Manager' };

// ---------- API helper ----------
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data.error) msg = data.error;
    } catch (_) {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ---------- Formatting helpers ----------
function localeTag() {
  const lang = window.getLanguage ? getLanguage() : 'en';
  return { en: 'en-US', uz: 'uz-UZ', ru: 'ru-RU' }[lang] || 'en-US';
}

function money(value) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat(localeTag(), {
    style: 'currency',
    currency: settings.currency || 'USD',
  }).format(num);
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString(localeTag(), { year: 'numeric', month: 'short', day: 'numeric' });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// ---------- Toast ----------
function toast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ---------- KPI card helper ----------
function kpiCard(icon, label, value, valueClass = '', accent = '') {
  const accentStyle = accent ? `style="--kpi-accent:${accent}"` : '';
  return `
    <div class="kpi" ${accentStyle}>
      <div class="kpi-top">
        <span class="kpi-ico">${icon}</span>
        <span class="label">${label}</span>
      </div>
      <span class="value ${valueClass}">${value}</span>
    </div>
  `;
}

// ---------- Modal ----------
function openModal(title, bodyHtml, actionsHtml = '') {
  const container = document.getElementById('modal-container');
  container.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <h2>${escapeHtml(title)}</h2>
        <div class="modal-body">${bodyHtml}</div>
        ${actionsHtml ? `<div class="modal-actions">${actionsHtml}</div>` : ''}
      </div>
    </div>
  `;
  container.querySelector('.modal-backdrop').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
}

function closeModal() {
  document.getElementById('modal-container').innerHTML = '';
}

// ---------- Router ----------
const views = {
  dashboard: renderDashboard,
  pos: renderPOS,
  products: renderProducts,
  customers: renderCustomers,
  suppliers: renderSuppliers,
  purchases: renderPurchases,
  expenses: renderExpenses,
  locations: renderLocations,
  reports: renderReports,
  settings: renderSettings,
};

let currentView = 'dashboard';
window.currentView = 'dashboard';

async function navigate(view) {
  currentView = view;
  window.currentView = view;
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  const container = document.getElementById('view-container');
  container.innerHTML = `<p class="empty-state">${t('loading')}</p>`;
  try {
    await views[view](container);
  } catch (err) {
    container.innerHTML = `<div class="card"><p class="empty-state">${escapeHtml(err.message)}</p></div>`;
  }
}

// ============================================================
// DASHBOARD
// ============================================================
async function renderDashboard(el) {
  const [summary, chart, topProducts, lowStock] = await Promise.all([
    api('/api/dashboard/summary'),
    api('/api/dashboard/chart'),
    api('/api/dashboard/top-products'),
    api('/api/products/low-stock'),
  ]);

  const netClass = summary.netIncome >= 0 ? 'positive' : 'negative';

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1>📊 ${t('dash.title')}</h1>
        <p class="subtitle">${t('dash.subtitle')} ${escapeHtml(settings.businessName)}</p>
      </div>
      <button class="btn btn-primary" onclick="navigate('pos')">${t('dash.newSale')}</button>
    </div>

    <div class="grid grid-4">
      ${kpiCard('💰', t('kpi.revenue'), money(summary.revenue), 'positive', 'linear-gradient(90deg,#16a34a,#22c55e)')}
      ${kpiCard('💸', t('kpi.expenses'), money(summary.expenses), 'negative', 'linear-gradient(90deg,#ef4444,#f87171)')}
      ${kpiCard('📈', t('kpi.netIncome'), money(summary.netIncome), netClass, 'linear-gradient(90deg,#4f46e5,#7c3aed)')}
      ${kpiCard('🏆', t('kpi.grossProfit'), money(summary.profit), 'accent', 'linear-gradient(90deg,#f59e0b,#fbbf24)')}
    </div>

    <div class="grid grid-4 mt">
      ${kpiCard('📦', t('kpi.purchases'), money(summary.purchases), '', 'linear-gradient(90deg,#0ea5e9,#38bdf8)')}
      ${kpiCard('💳', t('kpi.payments'), money(summary.payments), '', 'linear-gradient(90deg,#14b8a6,#2dd4bf)')}
      ${kpiCard('👕', t('kpi.products'), summary.productCount, '', 'linear-gradient(90deg,#8b5cf6,#a78bfa)')}
      ${kpiCard('⚠️', t('kpi.lowStock'), summary.lowStockCount, '', 'linear-gradient(90deg,#f59e0b,#f97316)')}
    </div>

    <div class="grid grid-2 mt">
      <div class="card">
        <h2>${t('dash.revVsExp')}</h2>
        ${renderBarChart(chart)}
      </div>
      <div class="card">
        <h2>${t('dash.topProducts')}</h2>
        ${
          topProducts.length
            ? `<table>
                <thead><tr><th>${t('table.product')}</th><th class="text-right">${t('table.qty')}</th><th class="text-right">${t('table.revenue')}</th><th class="text-right">${t('table.profit')}</th></tr></thead>
                <tbody>
                  ${topProducts
                    .map(
                      (p) => `<tr>
                        <td>${escapeHtml(p.name)}</td>
                        <td class="text-right">${p.quantity}</td>
                        <td class="text-right amount-pos">${money(p.revenue)}</td>
                        <td class="text-right" style="color:var(--income);font-weight:700">${money(p.profit || 0)}</td>
                      </tr>`
                    )
                    .join('')}
                </tbody>
              </table>`
            : `<p class="empty-state">${t('empty.noSales')}</p>`
        }
      </div>
    </div>

    <div class="card mt">
      <h2>${t('dash.lowStockAlerts')}</h2>
      ${
        lowStock.length
          ? `<div class="table-wrap"><table>
              <thead><tr><th>${t('table.product')}</th><th>${t('table.category')}</th><th class="text-right">${t('table.stock')}</th><th class="text-right">${t('table.reorder')}</th></tr></thead>
              <tbody>
                ${lowStock
                  .map(
                    (p) => `<tr>
                      <td>${escapeHtml(p.name)}</td>
                      <td>${escapeHtml(p.category)}</td>
                      <td class="text-right"><span class="badge low">${p.stock}</span></td>
                      <td class="text-right">${p.reorderLevel}</td>
                    </tr>`
                  )
                  .join('')}
              </tbody>
            </table></div>`
          : `<p class="empty-state">${t('dash.lowStockOk')}</p>`
      }
    </div>
  `;
}

function renderBarChart(chart) {
  if (!chart.length) return `<p class="empty-state">${t('empty.noData')}</p>`;
  const max = Math.max(...chart.map((c) => Math.max(c.revenue, c.expenses)), 1);

  const bars = chart
    .slice(-14)
    .map(
      (c) => `
      <div class="bar-group">
        <div class="bar revenue" style="height:${Math.max(2, (c.revenue / max) * 100)}%" title="Rev ${money(c.revenue)}"></div>
        <div class="bar expense" style="height:${Math.max(2, (c.expenses / max) * 100)}%" title="Exp ${money(c.expenses)}"></div>
        <div class="bar-label">${c.date.slice(5)}</div>
      </div>`
    )
    .join('');

  return `
    <div class="bar-legend">
      <span><span class="dot" style="background:var(--income)"></span>${t('kpi.revenue')}</span>
      <span><span class="dot" style="background:var(--expense)"></span>${t('kpi.expenses')}</span>
    </div>
    <div class="bar-chart">${bars}</div>
  `;
}

// ============================================================
// POS (New Sale)
// ============================================================
let cart = [];

async function renderPOS(el) {
  const [products, customers, locations] = await Promise.all([
    api('/api/products'),
    api('/api/customers'),
    api('/api/locations'),
  ]);
  cart = [];

  el.innerHTML = `
    <div class="page-header">
      <div><h1>🧾 ${t('pos.title')}</h1><p class="subtitle">${t('pos.subtitle')}</p></div>
    </div>

    <div class="pos-layout">
      <div class="card">
        <h2>${t('pos.products')}</h2>
        <div class="toolbar">
          <input type="text" id="pos-search" placeholder="${t('pos.search')}" oninput="posFilterProducts()" />
        </div>
        <div class="product-grid" id="pos-product-grid">
          ${products
            .map(
              (p) => `
            <div class="product-tile ${p.stock <= 0 ? 'out' : ''}" data-id="${p._id}" onclick="posAddToCart('${p._id}')">
              <div class="pname">${escapeHtml(p.name)}</div>
              <div class="pprice">${money(p.sellPrice)}</div>
              <div class="pstock">${t('pos.stock')} ${p.stock}</div>
            </div>`
            )
            .join('')}
        </div>
      </div>

      <div class="card">
        <h2>${t('pos.currentSale')}</h2>

        <div class="field mb">
          <label>${t('pos.customer')}</label>
          <select id="pos-customer">
            <option value="">${t('pos.walkIn')}</option>
            ${customers.map((c) => `<option value="${c._id}">${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>

        <div class="field mb">
          <label>${t('pos.location')}</label>
          <select id="pos-location">
            <option value="">${t('pos.selectLocation')}</option>
            ${locations.map((l) => `<option value="${l._id}">${escapeHtml(l.name)}</option>`).join('')}
          </select>
        </div>

        <div class="cart-items" id="pos-cart"></div>
        <div class="cart-totals" id="pos-totals"></div>

        <div class="field mb">
          <label>${t('pos.discount')}</label>
          <input type="number" id="pos-discount" value="0" min="0" step="0.01" oninput="posRenderCart()" />
        </div>

        <div class="field mb">
          <label>${t('pos.paymentType')}</label>
          <select id="pos-payment-type" onchange="posRenderCart()">
            <option value="cash">${t('pos.cash')}</option>
            <option value="card">${t('pos.card')}</option>
            <option value="credit">${t('pos.credit')}</option>
            <option value="mixed">${t('pos.mixed')}</option>
          </select>
        </div>

        <div class="field mb" id="pos-paid-field">
          <label>${t('pos.amountPaid')}</label>
          <input type="number" id="pos-amount-paid" min="0" step="0.01" oninput="posRenderCart()" />
        </div>

        <div class="field mb">
          <label>${t('pos.notes')}</label>
          <input type="text" id="pos-notes" placeholder="${t('pos.notePlaceholder')}" />
        </div>

        <button class="btn btn-success" style="width:100%" onclick="posSubmitSale()">${t('pos.complete')}</button>
      </div>
    </div>
  `;
  posRenderCart();
}

function posFilterProducts() {
  const q = document.getElementById('pos-search').value.toLowerCase();
  document.querySelectorAll('#pos-product-grid .product-tile').forEach((tile) => {
    tile.style.display = tile.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

function posAddToCart(productId) {
  const existing = cart.find((c) => c.productId === productId);
  if (existing) {
    existing.quantity++;
  } else {
    cart.push({ productId, quantity: 1 });
  }
  posRenderCart();
}

function posRenderCart() {
  const cartEl = document.getElementById('pos-cart');
  if (!cartEl) return;

  const listEl = document.getElementById('pos-product-grid');

  let subtotal = 0;
  const itemsHtml = cart
    .map((item, idx) => {
      const tile = listEl?.querySelector(`[data-id="${item.productId}"]`);
      const name = tile?.querySelector('.pname')?.textContent || item.productId;
      const priceText = tile?.querySelector('.pprice')?.textContent || '$0';
      const price = parseFloat(priceText.replace(/[^0-9.-]/g, '')) || 0;
      const lineTotal = price * item.quantity;
      subtotal += lineTotal;

      return `
        <div class="cart-item">
          <span style="flex:1">${escapeHtml(name)}</span>
          <input type="number" class="qty" min="1" value="${item.quantity}" onchange="posSetQty(${idx}, this.value)" />
          <span style="width:80px;text-align:right">${money(lineTotal)}</span>
          <button class="btn btn-danger btn-sm" onclick="posRemoveItem(${idx})">✕</button>
        </div>`;
    })
    .join('');

  const discount = parseFloat(document.getElementById('pos-discount')?.value) || 0;
  const total = Math.max(0, subtotal - discount);

  const paymentType = document.getElementById('pos-payment-type')?.value;
  const paidField = document.getElementById('pos-paid-field');
  if (paidField) paidField.style.display = paymentType === 'credit' ? 'none' : '';
  const amountPaid =
    paymentType === 'credit'
      ? 0
      : Math.min(total, parseFloat(document.getElementById('pos-amount-paid')?.value) || total);

  const balanceDue = total - amountPaid;

  cartEl.innerHTML = itemsHtml || `<p class="empty-state" style="padding:10px 0">${t('pos.emptyCart')}</p>`;

  document.getElementById('pos-totals').innerHTML = `
    <div class="row"><span>${t('pos.subtotal')}</span><span>${money(subtotal)}</span></div>
    <div class="row"><span>${t('pos.discount')}</span><span>−${money(discount)}</span></div>
    <div class="row grand"><span>${t('pos.total')}</span><span>${money(total)}</span></div>
    <div class="row"><span>${t('pos.paid')}</span><span>${money(amountPaid)}</span></div>
    ${
      balanceDue > 0
        ? `<div class="row"><span>${t('pos.balanceDue')}</span><span style="color:var(--expense)">${money(balanceDue)}</span></div>`
        : `<div class="row"><span>${t('pos.change')}</span><span style="color:var(--income)">${money(-balanceDue)}</span></div>`
    }
  `;
}

function posSetQty(idx, value) {
  const qty = parseInt(value, 10);
  if (qty > 0) cart[idx].quantity = qty;
  posRenderCart();
}

function posRemoveItem(idx) {
  cart.splice(idx, 1);
  posRenderCart();
}

async function posSubmitSale() {
  if (cart.length === 0) {
    toast(t('pos.cartEmpty'), 'error');
    return;
  }

  const discount = parseFloat(document.getElementById('pos-discount').value) || 0;
  const paymentType = document.getElementById('pos-payment-type').value;
  const amountPaid = parseFloat(document.getElementById('pos-amount-paid').value) || 0;
  const customerId = document.getElementById('pos-customer').value;
  const locationId = document.getElementById('pos-location').value;
  const notes = document.getElementById('pos-notes').value;

  const items = cart.map((item) => {
    const tile = document.querySelector(`#pos-product-grid [data-id="${item.productId}"]`);
    const priceText = tile?.querySelector('.pprice')?.textContent || '0';
    const sellPrice = parseFloat(priceText.replace(/[^0-9.-]/g, '')) || 0;
    return { productId: item.productId, quantity: item.quantity, sellPrice };
  });

  const payload = {
    items,
    discount,
    paymentType,
    amountPaid,
    customerId: customerId || null,
    locationId: locationId || null,
    notes,
    date: today(),
  };

  try {
    await api('/api/sales', { method: 'POST', body: JSON.stringify(payload) });
    toast(t('pos.saleComplete'));
    navigate('dashboard');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ============================================================
// PRODUCTS
// ============================================================
async function renderProducts(el) {
  const products = await api('/api/products');
  const suppliers = await api('/api/suppliers');

  const supplierMap = {};
  suppliers.forEach((s) => (supplierMap[s._id] = s.name));

  el.innerHTML = `
    <div class="page-header">
      <div><h1>👕 ${t('products.title')}</h1><p class="subtitle">${t('products.subtitle')}</p></div>
      <button class="btn btn-primary" onclick="productModal(null)">${t('products.add')}</button>
    </div>

    <div class="card">
      <div class="toolbar">
        <input type="text" id="prod-search" placeholder="${t('products.search')}" oninput="filterProducts()" />
        <div class="spacer"></div>
        <span class="text-muted">${products.length} ${t('products.count')}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>${t('product.name')}</th><th>${t('product.sku')}</th><th>${t('table.category')}</th><th class="text-right">${t('product.cost')}</th>
            <th class="text-right">${t('product.price')}</th><th class="text-right">${t('product.profitItem')}</th><th class="text-right">${t('table.stock')}</th><th class="text-right">${t('table.reorder')}</th><th>${t('product.supplier')}</th><th></th></tr>
          </thead>
          <tbody id="prod-tbody">
            ${products
              .map(
                (p) => `
              <tr data-search="${escapeHtml((p.name + ' ' + p.sku + ' ' + p.category).toLowerCase())}">
                <td>${escapeHtml(p.name)}</td>
                <td>${escapeHtml(p.sku || '—')}</td>
                <td>${escapeHtml(p.category)}</td>
                <td class="text-right">${money(p.costPrice)}</td>
                <td class="text-right">${money(p.sellPrice)}</td>
                <td class="text-right" style="color:var(--income);font-weight:700">${money((p.sellPrice || 0) - (p.costPrice || 0))}</td>
                <td class="text-right">${p.stock <= p.reorderLevel ? `<span class="badge low">${p.stock}</span>` : p.stock}</td>
                <td class="text-right">${p.reorderLevel}</td>
                <td>${escapeHtml(supplierMap[p.supplierId] || '—')}</td>
                <td class="text-right">
                  <button class="btn btn-outline btn-sm" onclick='productModal(${JSON.stringify(p)})'>${t('common.edit')}</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p._id}')">${t('common.delete')}</button>
                </td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function filterProducts() {
  const q = document.getElementById('prod-search').value.toLowerCase();
  document.querySelectorAll('#prod-tbody tr').forEach((tr) => {
    tr.style.display = tr.dataset.search.includes(q) ? '' : 'none';
  });
}

function updateProfitPreview() {
  const cost = parseFloat(document.getElementById('f-cost')?.value) || 0;
  const sell = parseFloat(document.getElementById('f-sell')?.value) || 0;
  const profit = sell - cost;
  const margin = sell > 0 ? (profit / sell) * 100 : 0;
  const el = document.getElementById('profit-preview');
  if (!el) return;

  if (sell > 0 && profit >= 0) {
    el.innerHTML = `<span>${t('product.profitPreview')} <strong style="color:var(--income)">${money(profit)}</strong> · ${t('product.margin')} <strong>${margin.toFixed(1)}%</strong></span>`;
    el.className = 'profit-preview positive';
  } else if (sell > 0 && profit < 0) {
    el.innerHTML = `<span>${t('product.lossPreview')} <strong style="color:var(--expense)">${money(profit)}</strong></span>`;
    el.className = 'profit-preview negative';
  } else {
    el.innerHTML = '';
    el.className = 'profit-preview';
  }
}

function productModal(product) {
  const isEdit = !!product;

  openModal(
    isEdit ? t('product.editTitle') : t('product.addTitle'),
    `
    <div class="form-row">
      <div class="field"><label>${t('product.name')} *</label><input type="text" id="f-name" value="${escapeHtml(product?.name || '')}" /></div>
      <div class="field"><label>${t('product.sku')}</label><input type="text" id="f-sku" value="${escapeHtml(product?.sku || '')}" /></div>
    </div>
    <div class="form-row">
      <div class="field"><label>${t('table.category')}</label><input type="text" id="f-category" value="${escapeHtml(product?.category || 'General')}" /></div>
      <div class="field"><label>${t('product.supplier')}</label><input type="text" id="f-supplier" placeholder="${t('supplierIdPlaceholder')}" value="${escapeHtml(product?.supplierId || '')}" /></div>
    </div>
    <div class="form-row">
      <div class="field"><label>${t('product.buyingPrice')}</label><input type="number" id="f-cost" step="0.01" min="0" value="${product?.costPrice || 0}" oninput="updateProfitPreview()" /></div>
      <div class="field"><label>${t('product.sellingPrice')}</label><input type="number" id="f-sell" step="0.01" min="0" value="${product?.sellPrice || 0}" oninput="updateProfitPreview()" /></div>
    </div>
    <div class="profit-preview" id="profit-preview"></div>
    <div class="form-row">
      <div class="field"><label>${t('product.stock')}</label><input type="number" id="f-stock" value="${product?.stock || 0}" /></div>
      <div class="field"><label>${t('product.reorder')}</label><input type="number" id="f-reorder" value="${product?.reorderLevel || 5}" /></div>
    </div>
    `,
    `<button class="btn btn-outline" onclick="closeModal()">${t('common.cancel')}</button>
     <button class="btn btn-primary" onclick="saveProduct('${isEdit ? product._id : ''}')">${t('common.save')}</button>`
  );
  updateProfitPreview();
}

async function saveProduct(id) {
  const payload = {
    name: document.getElementById('f-name').value,
    sku: document.getElementById('f-sku').value,
    category: document.getElementById('f-category').value,
    costPrice: parseFloat(document.getElementById('f-cost').value) || 0,
    sellPrice: parseFloat(document.getElementById('f-sell').value) || 0,
    stock: parseInt(document.getElementById('f-stock').value) || 0,
    reorderLevel: parseInt(document.getElementById('f-reorder').value) || 0,
    supplierId: document.getElementById('f-supplier').value || null,
  };

  try {
    if (id) {
      await api(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/products', { method: 'POST', body: JSON.stringify(payload) });
    }
    closeModal();
    toast(t('product.saved'));
    navigate('products');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteProduct(id) {
  if (!confirm(t('product.confirmDelete'))) return;
  try {
    await api(`/api/products/${id}`, { method: 'DELETE' });
    toast(t('product.deleted'));
    navigate('products');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ============================================================
// CUSTOMERS
// ============================================================
async function renderCustomers(el) {
  const customers = await api('/api/customers');
  const totalDebt = customers.reduce((s, c) => s + (c.debt || 0), 0);

  el.innerHTML = `
    <div class="page-header">
      <div><h1>👥 ${t('customers.title')}</h1><p class="subtitle">${customers.length} ${t('customers.subtitle')} ${money(totalDebt)}</p></div>
      <button class="btn btn-primary" onclick="customerModal(null)">${t('customers.add')}</button>
    </div>

    <div class="card">
      <div class="toolbar">
        <input type="text" id="cust-search" placeholder="${t('customers.search')}" oninput="filterCustomers()" />
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>${t('customer.name')}</th><th>${t('customer.phone')}</th><th>${t('customer.email')}</th><th class="text-right">${t('customer.debt')}</th><th></th></tr></thead>
          <tbody>
            ${customers
              .map(
                (c) => `
              <tr data-search="${escapeHtml((c.name + ' ' + c.phone).toLowerCase())}">
                <td>${escapeHtml(c.name)}</td>
                <td>${escapeHtml(c.phone || '—')}</td>
                <td>${escapeHtml(c.email || '—')}</td>
                <td class="text-right">${c.debt > 0 ? `<span class="amount-neg">${money(c.debt)}</span>` : money(c.debt)}</td>
                <td class="text-right">
                  <button class="btn btn-success btn-sm" onclick="paymentModal('${c._id}', '${escapeHtml(c.name)}')">${t('customer.receive')}</button>
                  <button class="btn btn-outline btn-sm" onclick="customerHistory('${c._id}')">${t('customer.history')}</button>
                  <button class="btn btn-outline btn-sm" onclick='customerModal(${JSON.stringify(c)})'>${t('common.edit')}</button>
                </td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function filterCustomers() {
  const q = document.getElementById('cust-search').value.toLowerCase();
  document.querySelectorAll('#view-container tbody tr').forEach((tr) => {
    tr.style.display = tr.dataset.search.includes(q) ? '' : 'none';
  });
}

function customerModal(customer) {
  const isEdit = !!customer;
  openModal(
    isEdit ? t('customer.editTitle') : t('customer.addTitle'),
    `
    <div class="form-row">
      <div class="field"><label>${t('customer.name')} *</label><input type="text" id="f-name" value="${escapeHtml(customer?.name || '')}" /></div>
      <div class="field"><label>${t('customer.phone')}</label><input type="text" id="f-phone" value="${escapeHtml(customer?.phone || '')}" /></div>
    </div>
    <div class="form-row">
      <div class="field"><label>${t('customer.email')}</label><input type="text" id="f-email" value="${escapeHtml(customer?.email || '')}" /></div>
      <div class="field"><label>${t('customer.address')}</label><input type="text" id="f-address" value="${escapeHtml(customer?.address || '')}" /></div>
    </div>
    <div class="field"><label>${t('customer.notes')}</label><textarea id="f-notes">${escapeHtml(customer?.notes || '')}</textarea></div>
    `,
    `<button class="btn btn-outline" onclick="closeModal()">${t('common.cancel')}</button>
     <button class="btn btn-primary" onclick="saveCustomer('${isEdit ? customer._id : ''}')">${t('common.save')}</button>`
  );
}

async function saveCustomer(id) {
  const payload = {
    name: document.getElementById('f-name').value,
    phone: document.getElementById('f-phone').value,
    email: document.getElementById('f-email').value,
    address: document.getElementById('f-address').value,
    notes: document.getElementById('f-notes').value,
  };
  try {
    if (id) {
      await api(`/api/customers/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/customers', { method: 'POST', body: JSON.stringify(payload) });
    }
    closeModal();
    toast(t('customer.saved'));
    navigate('customers');
  } catch (err) {
    toast(err.message, 'error');
  }
}

function paymentModal(customerId, customerName) {
  openModal(
    `${t('payment.title')} — ${customerName}`,
    `
    <div class="field mb"><label>${t('payment.amount')}</label><input type="number" id="f-amount" min="0.01" step="0.01" /></div>
    <div class="field mb"><label>${t('payment.method')}</label>
      <select id="f-method"><option value="cash">${t('pos.cash')}</option><option value="card">${t('pos.card')}</option><option value="bank">${t('payment.bank')}</option></select>
    </div>
    <div class="field mb"><label>${t('payment.date')}</label><input type="date" id="f-date" value="${today()}" /></div>
    <div class="field"><label>${t('customer.notes')}</label><input type="text" id="f-notes" /></div>
    `,
    `<button class="btn btn-outline" onclick="closeModal()">${t('common.cancel')}</button>
     <button class="btn btn-success" onclick="savePayment('${customerId}')">${t('payment.record')}</button>`
  );
}

async function savePayment(customerId) {
  const payload = {
    customerId,
    amount: parseFloat(document.getElementById('f-amount').value),
    method: document.getElementById('f-method').value,
    date: document.getElementById('f-date').value,
    notes: document.getElementById('f-notes').value,
  };
  try {
    await api('/api/payments', { method: 'POST', body: JSON.stringify(payload) });
    closeModal();
    toast(t('payment.recorded'));
    navigate('customers');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function customerHistory(customerId) {
  const [sales, payments] = await Promise.all([
    api(`/api/sales?customerId=${customerId}`),
    api(`/api/payments?customerId=${customerId}`),
  ]);

  const rows = [
    ...sales.map((s) => ({ date: s.date, label: `${t('history.sale')} #${s.number}`, type: 'sale', amount: s.total })),
    ...payments.map((p) => ({ date: p.date, label: `${t('history.payment')} (${p.method})`, type: 'payment', amount: p.amount })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  openModal(
    t('history.title'),
    `<div class="table-wrap"><table>
      <thead><tr><th>${t('history.date')}</th><th>${t('history.description')}</th><th class="text-right">${t('expense.amount')}</th></tr></thead>
      <tbody>
        ${
          rows.length
            ? rows
                .map(
                  (r) => `<tr>
                    <td>${fmtDate(r.date)}</td>
                    <td>${escapeHtml(r.label)}</td>
                    <td class="text-right ${r.type === 'sale' ? 'amount-neg' : 'amount-pos'}">${r.type === 'sale' ? '−' : '+'}${money(r.amount)}</td>
                  </tr>`
                )
                .join('')
            : `<tr><td colspan="3" class="empty-state">${t('history.empty')}</td></tr>`
        }
      </tbody>
    </table></div>`,
    `<button class="btn btn-outline" onclick="closeModal()">${t('common.close')}</button>`
  );
}

// ============================================================
// SUPPLIERS
// ============================================================
async function renderSuppliers(el) {
  const suppliers = await api('/api/suppliers');
  el.innerHTML = `
    <div class="page-header">
      <div><h1>🚚 ${t('suppliers.title')}</h1><p class="subtitle">${t('suppliers.subtitle')}</p></div>
      <button class="btn btn-primary" onclick="supplierModal(null)">${t('suppliers.add')}</button>
    </div>
    <div class="card">
      <div class="table-wrap"><table>
        <thead><tr><th>${t('supplier.name')}</th><th>${t('supplier.contact')}</th><th>${t('customer.phone')}</th><th>${t('customer.email')}</th><th></th></tr></thead>
        <tbody>
          ${suppliers
            .map(
              (s) => `<tr>
                <td>${escapeHtml(s.name)}</td>
                <td>${escapeHtml(s.contactName || '—')}</td>
                <td>${escapeHtml(s.phone || '—')}</td>
                <td>${escapeHtml(s.email || '—')}</td>
                <td class="text-right">
                  <button class="btn btn-outline btn-sm" onclick='supplierModal(${JSON.stringify(s)})'>${t('common.edit')}</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteSupplier('${s._id}')">${t('common.delete')}</button>
                </td>
              </tr>`
            )
            .join('') || `<tr><td colspan="5" class="empty-state">${t('supplier.empty')}</td></tr>`}
        </tbody>
      </table></div>
    </div>
  `;
}

function supplierModal(supplier) {
  const isEdit = !!supplier;
  openModal(
    isEdit ? t('supplier.editTitle') : t('supplier.addTitle'),
    `
    <div class="form-row">
      <div class="field"><label>${t('supplier.name')} *</label><input type="text" id="f-name" value="${escapeHtml(supplier?.name || '')}" /></div>
      <div class="field"><label>${t('supplier.contact')}</label><input type="text" id="f-contact" value="${escapeHtml(supplier?.contactName || '')}" /></div>
    </div>
    <div class="form-row">
      <div class="field"><label>${t('customer.phone')}</label><input type="text" id="f-phone" value="${escapeHtml(supplier?.phone || '')}" /></div>
      <div class="field"><label>${t('customer.email')}</label><input type="text" id="f-email" value="${escapeHtml(supplier?.email || '')}" /></div>
    </div>
    <div class="field"><label>${t('location.address')}</label><input type="text" id="f-address" value="${escapeHtml(supplier?.address || '')}" /></div>
    `,
    `<button class="btn btn-outline" onclick="closeModal()">${t('common.cancel')}</button>
     <button class="btn btn-primary" onclick="saveSupplier('${isEdit ? supplier._id : ''}')">${t('common.save')}</button>`
  );
}

async function saveSupplier(id) {
  const payload = {
    name: document.getElementById('f-name').value,
    contactName: document.getElementById('f-contact').value,
    phone: document.getElementById('f-phone').value,
    email: document.getElementById('f-email').value,
    address: document.getElementById('f-address').value,
  };
  try {
    if (id) {
      await api(`/api/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/suppliers', { method: 'POST', body: JSON.stringify(payload) });
    }
    closeModal();
    toast(t('supplier.saved'));
    navigate('suppliers');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteSupplier(id) {
  if (!confirm(t('supplier.confirmDelete'))) return;
  try {
    await api(`/api/suppliers/${id}`, { method: 'DELETE' });
    toast(t('supplier.deleted'));
    navigate('suppliers');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ============================================================
// PURCHASES
// ============================================================
async function renderPurchases(el) {
  const purchases = await api('/api/purchases');
  el.innerHTML = `
    <div class="page-header">
      <div><h1>📦 ${t('purchases.title')}</h1><p class="subtitle">${t('purchases.subtitle')}</p></div>
      <button class="btn btn-primary" onclick="purchaseModal()">${t('purchases.add')}</button>
    </div>
    <div class="card">
      <div class="table-wrap"><table>
        <thead><tr><th>${t('purchase.number')}</th><th>${t('purchase.date')}</th><th>${t('purchase.items')}</th><th class="text-right">${t('purchase.totalCost')}</th></tr></thead>
        <tbody>
          ${purchases
            .map(
              (p) => `<tr>
                <td>#${p.number}</td>
                <td>${fmtDate(p.date)}</td>
                <td>${p.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}</td>
                <td class="text-right amount-neg">${money(p.totalCost)}</td>
              </tr>`
            )
            .join('') || `<tr><td colspan="4" class="empty-state">${t('purchase.empty')}</td></tr>`}
        </tbody>
      </table></div>
    </div>
  `;
}

function purchaseModal() {
  openModal(
    t('purchase.newTitle'),
    `
    <div class="field mb"><label>${t('purchase.product')}</label>
      <select id="f-product"><option value="">${t('purchase.selectProduct')}</option></select>
    </div>
    <div class="form-row">
      <div class="field"><label>${t('purchase.quantity')}</label><input type="number" id="f-qty" min="1" value="1" /></div>
      <div class="field"><label>${t('purchase.cost')}</label><input type="number" id="f-cost" step="0.01" /></div>
    </div>
    <div class="field mb"><label>${t('purchase.date')}</label><input type="date" id="f-date" value="${today()}" /></div>
    <div class="field"><label>${t('customer.notes')}</label><input type="text" id="f-notes" /></div>
    `,
    `<button class="btn btn-outline" onclick="closeModal()">${t('common.cancel')}</button>
     <button class="btn btn-primary" onclick="savePurchase()">${t('common.save')}</button>`
  );

  api('/api/products').then((products) => {
    const sel = document.getElementById('f-product');
    products.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p._id;
      opt.textContent = `${p.name} (${t('table.stock')}: ${p.stock})`;
      sel.appendChild(opt);
    });
  });
}

async function savePurchase() {
  const productId = document.getElementById('f-product').value;
  const quantity = parseInt(document.getElementById('f-qty').value) || 0;
  const costPrice = parseFloat(document.getElementById('f-cost').value) || 0;

  if (!productId || quantity <= 0) {
    toast(t('purchase.selectError'), 'error');
    return;
  }

  const payload = {
    items: [{ productId, quantity, costPrice }],
    date: document.getElementById('f-date').value,
    notes: document.getElementById('f-notes').value,
  };
  try {
    await api('/api/purchases', { method: 'POST', body: JSON.stringify(payload) });
    closeModal();
    toast(t('purchase.recorded'));
    navigate('purchases');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ============================================================
// EXPENSES
// ============================================================
async function renderExpenses(el) {
  const expenses = await api('/api/expenses');
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  el.innerHTML = `
    <div class="page-header">
      <div><h1>💸 ${t('expenses.title')}</h1><p class="subtitle">${t('expenses.subtitle')} ${money(total)}</p></div>
      <button class="btn btn-primary" onclick="expenseModal()">${t('expenses.add')}</button>
    </div>
    <div class="card">
      <div class="table-wrap"><table>
        <thead><tr><th>${t('expense.date')}</th><th>${t('expense.description')}</th><th>${t('expense.category')}</th><th class="text-right">${t('expense.amount')}</th><th></th></tr></thead>
        <tbody>
          ${expenses
            .map(
              (e) => `<tr>
                <td>${fmtDate(e.date)}</td>
                <td>${escapeHtml(e.description)}</td>
                <td><span class="badge expense">${escapeHtml(e.category)}</span></td>
                <td class="text-right amount-neg">${money(e.amount)}</td>
                <td class="text-right"><button class="btn btn-danger btn-sm" onclick="deleteExpense('${e._id}')">${t('common.delete')}</button></td>
              </tr>`
            )
            .join('') || `<tr><td colspan="5" class="empty-state">${t('expense.empty')}</td></tr>`}
        </tbody>
      </table></div>
    </div>
  `;
}

function expenseModal() {
  openModal(
    t('expense.addTitle'),
    `
    <div class="form-row">
      <div class="field"><label>${t('expense.descLabel')}</label><input type="text" id="f-desc" /></div>
      <div class="field"><label>${t('expense.catLabel')}</label><input type="text" id="f-category" placeholder="${t('expense.catPlaceholder')}" /></div>
    </div>
    <div class="form-row">
      <div class="field"><label>${t('expense.amountLabel')}</label><input type="number" id="f-amount" min="0.01" step="0.01" /></div>
      <div class="field"><label>${t('expense.date')}</label><input type="date" id="f-date" value="${today()}" /></div>
    </div>
    <div class="field"><label>${t('customer.notes')}</label><input type="text" id="f-notes" /></div>
    `,
    `<button class="btn btn-outline" onclick="closeModal()">${t('common.cancel')}</button>
     <button class="btn btn-primary" onclick="saveExpense()">${t('common.save')}</button>`
  );
}

async function saveExpense() {
  const payload = {
    description: document.getElementById('f-desc').value,
    category: document.getElementById('f-category').value,
    amount: parseFloat(document.getElementById('f-amount').value),
    date: document.getElementById('f-date').value,
    notes: document.getElementById('f-notes').value,
  };
  try {
    await api('/api/expenses', { method: 'POST', body: JSON.stringify(payload) });
    closeModal();
    toast(t('expense.recorded'));
    navigate('expenses');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteExpense(id) {
  if (!confirm(t('expense.confirmDelete'))) return;
  try {
    await api(`/api/expenses/${id}`, { method: 'DELETE' });
    toast(t('expense.deleted'));
    navigate('expenses');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ============================================================
// LOCATIONS
// ============================================================
async function renderLocations(el) {
  const [locations, byLocation] = await Promise.all([
    api('/api/locations'),
    api('/api/dashboard/by-location'),
  ]);

  el.innerHTML = `
    <div class="page-header">
      <div><h1>📍 ${t('locations.title')}</h1><p class="subtitle">${t('locations.subtitle')}</p></div>
      <button class="btn btn-primary" onclick="locationModal(null)">${t('locations.add')}</button>
    </div>
    <div class="card">
      <div class="table-wrap"><table>
        <thead><tr><th>${t('location.name')}</th><th>${t('location.type')}</th><th>${t('location.address')}</th><th class="text-right">${t('table.revenue')}</th><th></th></tr></thead>
        <tbody>
          ${locations
            .map((l) => {
              const rev = byLocation.find((b) => b.location === l.name)?.revenue || 0;
              return `<tr>
                <td>${escapeHtml(l.name)}</td>
                <td>${escapeHtml(l.type)}</td>
                <td>${escapeHtml(l.address || '—')}</td>
                <td class="text-right amount-pos">${money(rev)}</td>
                <td class="text-right">
                  <button class="btn btn-outline btn-sm" onclick='locationModal(${JSON.stringify(l)})'>${t('common.edit')}</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteLocation('${l._id}')">${t('common.delete')}</button>
                </td>
              </tr>`;
            })
            .join('') || `<tr><td colspan="5" class="empty-state">${t('location.empty')}</td></tr>`}
        </tbody>
      </table></div>
    </div>
  `;
}

function locationModal(location) {
  const isEdit = !!location;
  openModal(
    isEdit ? t('location.editTitle') : t('location.addTitle'),
    `
    <div class="form-row">
      <div class="field"><label>${t('location.name')} *</label><input type="text" id="f-name" value="${escapeHtml(location?.name || '')}" /></div>
      <div class="field"><label>${t('location.type')}</label>
        <select id="f-type">
          <option value="store" ${location?.type === 'store' ? 'selected' : ''}>${t('location.store')}</option>
          <option value="warehouse" ${location?.type === 'warehouse' ? 'selected' : ''}>${t('location.warehouse')}</option>
          <option value="market-stall" ${location?.type === 'market-stall' ? 'selected' : ''}>${t('location.stall')}</option>
        </select>
      </div>
    </div>
    <div class="field"><label>${t('location.address')}</label><input type="text" id="f-address" value="${escapeHtml(location?.address || '')}" /></div>
    `,
    `<button class="btn btn-outline" onclick="closeModal()">${t('common.cancel')}</button>
     <button class="btn btn-primary" onclick="saveLocation('${isEdit ? location._id : ''}')">${t('common.save')}</button>`
  );
}

async function saveLocation(id) {
  const payload = {
    name: document.getElementById('f-name').value,
    type: document.getElementById('f-type').value,
    address: document.getElementById('f-address').value,
  };
  try {
    if (id) {
      await api(`/api/locations/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/locations', { method: 'POST', body: JSON.stringify(payload) });
    }
    closeModal();
    toast(t('location.saved'));
    navigate('locations');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteLocation(id) {
  if (!confirm(t('location.confirmDelete'))) return;
  try {
    await api(`/api/locations/${id}`, { method: 'DELETE' });
    toast(t('location.deleted'));
    navigate('locations');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ============================================================
// REPORTS
// ============================================================
async function renderReports(el) {
  const [summary, chart, byLocation, topProducts] = await Promise.all([
    api('/api/dashboard/summary'),
    api('/api/dashboard/chart'),
    api('/api/dashboard/by-location'),
    api('/api/dashboard/top-products'),
  ]);

  el.innerHTML = `
    <div class="page-header">
      <div><h1>📈 ${t('reports.title')}</h1><p class="subtitle">${t('reports.subtitle')}</p></div>
    </div>

    <div class="grid grid-3">
      ${kpiCard('💰', t('kpi.revenue'), money(summary.revenue), 'positive', 'linear-gradient(90deg,#16a34a,#22c55e)')}
      ${kpiCard('💸', t('kpi.expenses'), money(summary.expenses), 'negative', 'linear-gradient(90deg,#ef4444,#f87171)')}
      ${kpiCard('📈', t('kpi.netIncome'), money(summary.netIncome), summary.netIncome >= 0 ? 'positive' : 'negative', 'linear-gradient(90deg,#4f46e5,#7c3aed)')}
      ${kpiCard('🏆', t('kpi.grossProfit'), money(summary.profit), 'accent', 'linear-gradient(90deg,#f59e0b,#fbbf24)')}
      ${kpiCard('📦', t('kpi.purchases'), money(summary.purchases), '', 'linear-gradient(90deg,#0ea5e9,#38bdf8)')}
      ${kpiCard('💳', t('kpi.payments'), money(summary.payments), '', 'linear-gradient(90deg,#14b8a6,#2dd4bf)')}
    </div>

    <div class="card mt">
      <h2>${t('reports.daily')}</h2>
      ${renderBarChart(chart)}
    </div>

    <div class="grid grid-2 mt">
      <div class="card">
        <h2>${t('reports.byLocation')}</h2>
        ${
          byLocation.length
            ? `<table>
                <thead><tr><th>${t('location.name')}</th><th class="text-right">${t('table.revenue')}</th><th class="text-right">${t('table.profit')}</th></tr></thead>
                <tbody>${byLocation
                  .map(
                    (b) => `<tr>
                      <td>${escapeHtml(b.location)}</td>
                      <td class="text-right amount-pos">${money(b.revenue)}</td>
                      <td class="text-right" style="color:var(--income);font-weight:700">${money(b.profit || 0)}</td>
                    </tr>`
                  )
                  .join('')}</tbody>
              </table>`
            : `<p class="empty-state">${t('reports.noLocationData')}</p>`
        }
      </div>
      <div class="card">
        <h2>${t('reports.topProducts')}</h2>
        ${
          topProducts.length
            ? `<table>
                <thead><tr><th>${t('table.product')}</th><th class="text-right">${t('table.qty')}</th><th class="text-right">${t('table.revenue')}</th><th class="text-right">${t('table.profit')}</th></tr></thead>
                <tbody>${topProducts
                  .map(
                    (p) => `<tr>
                      <td>${escapeHtml(p.name)}</td>
                      <td class="text-right">${p.quantity}</td>
                      <td class="text-right amount-pos">${money(p.revenue)}</td>
                      <td class="text-right" style="color:var(--income);font-weight:700">${money(p.profit || 0)}</td>
                    </tr>`
                  )
                  .join('')}</tbody>
              </table>`
            : `<p class="empty-state">${t('reports.noSalesData')}</p>`
        }
      </div>
    </div>
  `;
}

// ============================================================
// SETTINGS
// ============================================================
async function renderSettings(el) {
  const s = await api('/api/settings');

  el.innerHTML = `
    <div class="page-header">
      <div><h1>⚙️ ${t('settings.title')}</h1><p class="subtitle">${t('settings.subtitle')}</p></div>
    </div>
    <div class="card" style="max-width:520px">
      <div class="field mb"><label>${t('settings.businessName')}</label><input type="text" id="f-bizname" value="${escapeHtml(s.businessName || '')}" /></div>
      <div class="field mb"><label>${t('settings.currency')}</label>
        <select id="f-currency">
          <option value="USD" ${s.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
          <option value="UZS" ${s.currency === 'UZS' ? 'selected' : ''}>UZS (so'm)</option>
          <option value="EUR" ${s.currency === 'EUR' ? 'selected' : ''}>EUR (€)</option>
          <option value="RUB" ${s.currency === 'RUB' ? 'selected' : ''}>RUB (₽)</option>
        </select>
      </div>
      <div class="field mb"><label>${t('settings.language')}</label>
        <select id="f-language" onchange="setLanguage(this.value)">
          <option value="en" ${getLanguage() === 'en' ? 'selected' : ''}>English</option>
          <option value="uz" ${getLanguage() === 'uz' ? 'selected' : ''}>O'zbekcha</option>
          <option value="ru" ${getLanguage() === 'ru' ? 'selected' : ''}>Русский</option>
        </select>
      </div>
      <button class="btn btn-primary" onclick="saveSettings()">${t('settings.save')}</button>
    </div>
  `;
}

async function saveSettings() {
  const payload = {
    businessName: document.getElementById('f-bizname').value,
    currency: document.getElementById('f-currency').value,
  };
  try {
    await api('/api/settings', { method: 'PUT', body: JSON.stringify(payload) });
    settings.businessName = payload.businessName;
    settings.currency = payload.currency;
    document.getElementById('brand-name').textContent = payload.businessName || 'Market Manager';
    toast(t('settings.saved'));
    navigate('settings');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ============================================================
// INIT
// ============================================================
window.navigate = navigate;
window.posAddToCart = posAddToCart;
window.posRenderCart = posRenderCart;
window.posSetQty = posSetQty;
window.posRemoveItem = posRemoveItem;
window.posSubmitSale = posSubmitSale;
window.posFilterProducts = posFilterProducts;
window.productModal = productModal;
window.saveProduct = saveProduct;
window.deleteProduct = deleteProduct;
window.filterProducts = filterProducts;
window.updateProfitPreview = updateProfitPreview;
window.customerModal = customerModal;
window.saveCustomer = saveCustomer;
window.filterCustomers = filterCustomers;
window.paymentModal = paymentModal;
window.savePayment = savePayment;
window.customerHistory = customerHistory;
window.supplierModal = supplierModal;
window.saveSupplier = saveSupplier;
window.deleteSupplier = deleteSupplier;
window.purchaseModal = purchaseModal;
window.savePurchase = savePurchase;
window.expenseModal = expenseModal;
window.saveExpense = saveExpense;
window.deleteExpense = deleteExpense;
window.locationModal = locationModal;
window.saveLocation = saveLocation;
window.deleteLocation = deleteLocation;
window.saveSettings = saveSettings;
window.closeModal = closeModal;

async function init() {
  try {
    const s = await api('/api/settings');
    settings.businessName = s.businessName || 'Market Manager';
    settings.currency = s.currency || 'USD';
    document.getElementById('brand-name').textContent = settings.businessName;
  } catch (_) {}

  // Apply static translations (nav, sidebar)
  if (typeof applyStaticTranslations === 'function') applyStaticTranslations();

  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.dataset.view));
  });

  navigate('dashboard');
}

init();
