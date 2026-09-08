// ============================================================
// Market Manager — single-page app
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
function money(value) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: settings.currency || 'USD',
  }).format(num);
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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
        ${
          actionsHtml
            ? `<div class="modal-actions">${actionsHtml}</div>`
            : ''
        }
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

async function navigate(view) {
  currentView = view;
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  const container = document.getElementById('view-container');
  container.innerHTML = '<p class="empty-state">Loading…</p>';
  try {
    await views[view](container);
  } catch (err) {
    container.innerHTML = `<div class="card"><p class="empty-state">${escapeHtml(
      err.message
    )}</p></div>`;
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
        <h1>📊 Dashboard</h1>
        <p class="subtitle">Overview of ${escapeHtml(settings.businessName)}</p>
      </div>
      <button class="btn btn-primary" onclick="navigate('pos')">+ New Sale</button>
    </div>

    <div class="grid grid-4">
      ${kpiCard('💰', 'Revenue', money(summary.revenue), 'positive', 'linear-gradient(90deg,#16a34a,#22c55e)')}
      ${kpiCard('💸', 'Expenses', money(summary.expenses), 'negative', 'linear-gradient(90deg,#ef4444,#f87171)')}
      ${kpiCard('📈', 'Net Income', money(summary.netIncome), netClass, 'linear-gradient(90deg,#4f46e5,#7c3aed)')}
      ${kpiCard('🏆', 'Gross Profit', money(summary.profit), 'accent', 'linear-gradient(90deg,#f59e0b,#fbbf24)')}
    </div>

    <div class="grid grid-4 mt">
      ${kpiCard('📦', 'Purchases', money(summary.purchases), '', 'linear-gradient(90deg,#0ea5e9,#38bdf8)')}
      ${kpiCard('💳', 'Payments Received', money(summary.payments), '', 'linear-gradient(90deg,#14b8a6,#2dd4bf)')}
      ${kpiCard('👕', 'Products', summary.productCount, '', 'linear-gradient(90deg,#8b5cf6,#a78bfa)')}
      ${kpiCard('⚠️', 'Low Stock', summary.lowStockCount, '', 'linear-gradient(90deg,#f59e0b,#f97316)')}
    </div>

    <div class="grid grid-2 mt">
      <div class="card">
        <h2>Revenue vs Expenses</h2>
        ${renderBarChart(chart)}
      </div>
      <div class="card">
        <h2>Top Selling Products</h2>
        ${
          topProducts.length
            ? `<table>
                <thead><tr><th>Product</th><th class="text-right">Qty</th><th class="text-right">Revenue</th><th class="text-right">Profit</th></tr></thead>
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
            : '<p class="empty-state">No sales yet</p>'
        }
      </div>
    </div>

    <div class="card mt">
      <h2>⚠️ Low Stock Alerts</h2>
      ${
        lowStock.length
          ? `<div class="table-wrap"><table>
              <thead><tr><th>Product</th><th>Category</th><th class="text-right">Stock</th><th class="text-right">Reorder Level</th></tr></thead>
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
          : '<p class="empty-state">All products are sufficiently stocked 🎉</p>'
      }
    </div>
  `;
}

function renderBarChart(chart) {
  if (!chart.length) return '<p class="empty-state">No data for this period</p>';
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
      <span><span class="dot" style="background:var(--income)"></span>Revenue</span>
      <span><span class="dot" style="background:var(--expense)"></span>Expenses</span>
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
      <div><h1>🧾 New Sale</h1><p class="subtitle">Point of sale</p></div>
    </div>

    <div class="pos-layout">
      <div class="card">
        <h2>Products</h2>
        <div class="toolbar">
          <input type="text" id="pos-search" placeholder="Search products…" oninput="posFilterProducts()" />
        </div>
        <div class="product-grid" id="pos-product-grid">
          ${products
            .map(
              (p) => `
            <div class="product-tile ${p.stock <= 0 ? 'out' : ''}" data-id="${p._id}" onclick="posAddToCart('${p._id}')">
              <div class="pname">${escapeHtml(p.name)}</div>
              <div class="pprice">${money(p.sellPrice)}</div>
              <div class="pstock">Stock: ${p.stock}</div>
            </div>`
            )
            .join('')}
        </div>
      </div>

      <div class="card">
        <h2>Current Sale</h2>

        <div class="field mb">
          <label>Customer (optional)</label>
          <select id="pos-customer">
            <option value="">— Walk-in customer —</option>
            ${customers
              .map((c) => `<option value="${c._id}">${escapeHtml(c.name)}</option>`)
              .join('')}
          </select>
        </div>

        <div class="field mb">
          <label>Location</label>
          <select id="pos-location">
            <option value="">— Select location —</option>
            ${locations
              .map((l) => `<option value="${l._id}">${escapeHtml(l.name)}</option>`)
              .join('')}
          </select>
        </div>

        <div class="cart-items" id="pos-cart"></div>
        <div class="cart-totals" id="pos-totals"></div>

        <div class="field mb">
          <label>Discount</label>
          <input type="number" id="pos-discount" value="0" min="0" step="0.01" oninput="posRenderCart()" />
        </div>

        <div class="field mb">
          <label>Payment Type</label>
          <select id="pos-payment-type" onchange="posRenderCart()">
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="credit">Credit (on account)</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>

        <div class="field mb" id="pos-paid-field">
          <label>Amount Paid</label>
          <input type="number" id="pos-amount-paid" min="0" step="0.01" oninput="posRenderCart()" />
        </div>

        <div class="field mb">
          <label>Notes</label>
          <input type="text" id="pos-notes" placeholder="Optional note" />
        </div>

        <button class="btn btn-success" style="width:100%" onclick="posSubmitSale()">💵 Complete Sale</button>
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
          <input type="number" class="qty" min="1" value="${item.quantity}"
            onchange="posSetQty(${idx}, this.value)" />
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

  cartEl.innerHTML =
    itemsHtml ||
    '<p class="empty-state" style="padding:10px 0">Cart is empty — click a product to add it.</p>';

  document.getElementById('pos-totals').innerHTML = `
    <div class="row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
    <div class="row"><span>Discount</span><span>−${money(discount)}</span></div>
    <div class="row grand"><span>Total</span><span>${money(total)}</span></div>
    <div class="row"><span>Paid</span><span>${money(amountPaid)}</span></div>
    ${
      balanceDue > 0
        ? `<div class="row"><span>Balance due</span><span style="color:var(--expense)">${money(balanceDue)}</span></div>`
        : `<div class="row"><span>Change</span><span style="color:var(--income)">${money(-balanceDue)}</span></div>`
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
    toast('Cart is empty', 'error');
    return;
  }

  const discount = parseFloat(document.getElementById('pos-discount').value) || 0;
  const paymentType = document.getElementById('pos-payment-type').value;
  const amountPaid = parseFloat(document.getElementById('pos-amount-paid').value) || 0;
  const customerId = document.getElementById('pos-customer').value;
  const locationId = document.getElementById('pos-location').value;
  const notes = document.getElementById('pos-notes').value;

  // Gather prices from the grid
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
    toast('Sale completed successfully');
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
      <div><h1>👕 Products</h1><p class="subtitle">Inventory management</p></div>
      <button class="btn btn-primary" onclick="productModal(null)">+ Add Product</button>
    </div>

    <div class="card">
      <div class="toolbar">
        <input type="text" id="prod-search" placeholder="Search products…" oninput="filterProducts()" />
        <div class="spacer"></div>
        <span class="text-muted">${products.length} products</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>SKU</th><th>Category</th><th class="text-right">Cost</th>
            <th class="text-right">Price</th><th class="text-right">Profit/Item</th><th class="text-right">Stock</th><th class="text-right">Reorder</th><th>Supplier</th><th></th></tr>
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
                  <button class="btn btn-outline btn-sm" onclick='productModal(${JSON.stringify(p)})'>Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p._id}')">Delete</button>
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
  const margin = sell > 0 ? ((profit / sell) * 100) : 0;
  const el = document.getElementById('profit-preview');
  if (!el) return;

  if (sell > 0 && profit >= 0) {
    el.innerHTML = `<span>Profit per item: <strong style="color:var(--income)">${money(profit)}</strong> · Margin: <strong>${margin.toFixed(1)}%</strong></span>`;
    el.className = 'profit-preview positive';
  } else if (sell > 0 && profit < 0) {
    el.innerHTML = `<span>⚠️ Loss per item: <strong style="color:var(--expense)">${money(profit)}</strong></span>`;
    el.className = 'profit-preview negative';
  } else {
    el.innerHTML = '';
    el.className = 'profit-preview';
  }
}

function productModal(product) {
  const suppliers = [];
  const supplierSelect = suppliers.map((s) => '').join('');
  const isEdit = !!product;

  openModal(
    isEdit ? 'Edit Product' : 'Add Product',
    `
    <div class="form-row">
      <div class="field"><label>Name *</label><input type="text" id="f-name" value="${escapeHtml(product?.name || '')}" /></div>
      <div class="field"><label>SKU</label><input type="text" id="f-sku" value="${escapeHtml(product?.sku || '')}" /></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Category</label><input type="text" id="f-category" value="${escapeHtml(product?.category || 'General')}" /></div>
      <div class="field"><label>Supplier</label><input type="text" id="f-supplier" placeholder="Supplier ID (optional)" value="${escapeHtml(product?.supplierId || '')}" /></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Buying Price (Cost) *</label><input type="number" id="f-cost" step="0.01" min="0" value="${product?.costPrice || 0}" oninput="updateProfitPreview()" /></div>
      <div class="field"><label>Selling Price *</label><input type="number" id="f-sell" step="0.01" min="0" value="${product?.sellPrice || 0}" oninput="updateProfitPreview()" /></div>
    </div>
    <div class="profit-preview" id="profit-preview"></div>
    <div class="form-row">
      <div class="field"><label>Stock</label><input type="number" id="f-stock" value="${product?.stock || 0}" /></div>
      <div class="field"><label>Reorder Level</label><input type="number" id="f-reorder" value="${product?.reorderLevel || 5}" /></div>
    </div>
    `,
    `<button class="btn btn-outline" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveProduct('${isEdit ? product._id : ''}')">Save</button>`
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
    toast('Product saved');
    navigate('products');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  try {
    await api(`/api/products/${id}`, { method: 'DELETE' });
    toast('Product deleted');
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
      <div><h1>👥 Customers</h1><p class="subtitle">${customers.length} customers · total outstanding ${money(totalDebt)}</p></div>
      <button class="btn btn-primary" onclick="customerModal(null)">+ Add Customer</button>
    </div>

    <div class="card">
      <div class="toolbar">
        <input type="text" id="cust-search" placeholder="Search by name or phone…" oninput="filterCustomers()" />
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th class="text-right">Debt</th><th></th></tr></thead>
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
                  <button class="btn btn-success btn-sm" onclick="paymentModal('${c._id}', '${escapeHtml(c.name)}')">Receive Payment</button>
                  <button class="btn btn-outline btn-sm" onclick="customerHistory('${c._id}')">History</button>
                  <button class="btn btn-outline btn-sm" onclick='customerModal(${JSON.stringify(c)})'>Edit</button>
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
    isEdit ? 'Edit Customer' : 'Add Customer',
    `
    <div class="form-row">
      <div class="field"><label>Name *</label><input type="text" id="f-name" value="${escapeHtml(customer?.name || '')}" /></div>
      <div class="field"><label>Phone</label><input type="text" id="f-phone" value="${escapeHtml(customer?.phone || '')}" /></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Email</label><input type="text" id="f-email" value="${escapeHtml(customer?.email || '')}" /></div>
      <div class="field"><label>Address</label><input type="text" id="f-address" value="${escapeHtml(customer?.address || '')}" /></div>
    </div>
    <div class="field"><label>Notes</label><textarea id="f-notes">${escapeHtml(customer?.notes || '')}</textarea></div>
    `,
    `<button class="btn btn-outline" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveCustomer('${isEdit ? customer._id : ''}')">Save</button>`
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
    toast('Customer saved');
    navigate('customers');
  } catch (err) {
    toast(err.message, 'error');
  }
}

function paymentModal(customerId, customerName) {
  openModal(
    `Receive Payment — ${customerName}`,
    `
    <div class="field mb"><label>Amount *</label><input type="number" id="f-amount" min="0.01" step="0.01" /></div>
    <div class="field mb"><label>Method</label>
      <select id="f-method"><option value="cash">Cash</option><option value="card">Card</option><option value="bank">Bank transfer</option></select>
    </div>
    <div class="field mb"><label>Date</label><input type="date" id="f-date" value="${today()}" /></div>
    <div class="field"><label>Notes</label><input type="text" id="f-notes" /></div>
    `,
    `<button class="btn btn-outline" onclick="closeModal()">Cancel</button>
     <button class="btn btn-success" onclick="savePayment('${customerId}')">Record Payment</button>`
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
    toast('Payment recorded');
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
    ...sales.map((s) => ({
      date: s.date,
      label: `Sale #${s.number}`,
      type: 'sale',
      amount: s.total,
    })),
    ...payments.map((p) => ({
      date: p.date,
      label: `Payment (${p.method})`,
      type: 'payment',
      amount: p.amount,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  openModal(
    'Customer History',
    `<div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Description</th><th class="text-right">Amount</th></tr></thead>
      <tbody>
        ${
          rows.length
            ? rows
                .map(
                  (r) => `<tr>
                    <td>${fmtDate(r.date)}</td>
                    <td>${escapeHtml(r.label)}</td>
                    <td class="text-right ${r.type === 'sale' ? 'amount-neg' : 'amount-pos'}">${
                      r.type === 'sale' ? '−' : '+'
                    }${money(r.amount)}</td>
                  </tr>`
                )
                .join('')
            : '<tr><td colspan="3" class="empty-state">No history</td></tr>'
        }
      </tbody>
    </table></div>`,
    `<button class="btn btn-outline" onclick="closeModal()">Close</button>`
  );
}

// ============================================================
// SUPPLIERS
// ============================================================
async function renderSuppliers(el) {
  const suppliers = await api('/api/suppliers');
  el.innerHTML = `
    <div class="page-header">
      <div><h1>🚚 Suppliers</h1><p class="subtitle">Your vendors</p></div>
      <button class="btn btn-primary" onclick="supplierModal(null)">+ Add Supplier</button>
    </div>
    <div class="card">
      <div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Contact</th><th>Phone</th><th>Email</th><th></th></tr></thead>
        <tbody>
          ${suppliers
            .map(
              (s) => `<tr>
                <td>${escapeHtml(s.name)}</td>
                <td>${escapeHtml(s.contactName || '—')}</td>
                <td>${escapeHtml(s.phone || '—')}</td>
                <td>${escapeHtml(s.email || '—')}</td>
                <td class="text-right">
                  <button class="btn btn-outline btn-sm" onclick='supplierModal(${JSON.stringify(s)})'>Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteSupplier('${s._id}')">Delete</button>
                </td>
              </tr>`
            )
            .join('') || '<tr><td colspan="5" class="empty-state">No suppliers yet</td></tr>'}
        </tbody>
      </table></div>
    </div>
  `;
}

function supplierModal(supplier) {
  const isEdit = !!supplier;
  openModal(
    isEdit ? 'Edit Supplier' : 'Add Supplier',
    `
    <div class="form-row">
      <div class="field"><label>Name *</label><input type="text" id="f-name" value="${escapeHtml(supplier?.name || '')}" /></div>
      <div class="field"><label>Contact Name</label><input type="text" id="f-contact" value="${escapeHtml(supplier?.contactName || '')}" /></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Phone</label><input type="text" id="f-phone" value="${escapeHtml(supplier?.phone || '')}" /></div>
      <div class="field"><label>Email</label><input type="text" id="f-email" value="${escapeHtml(supplier?.email || '')}" /></div>
    </div>
    <div class="field"><label>Address</label><input type="text" id="f-address" value="${escapeHtml(supplier?.address || '')}" /></div>
    `,
    `<button class="btn btn-outline" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveSupplier('${isEdit ? supplier._id : ''}')">Save</button>`
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
    toast('Supplier saved');
    navigate('suppliers');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteSupplier(id) {
  if (!confirm('Delete this supplier?')) return;
  try {
    await api(`/api/suppliers/${id}`, { method: 'DELETE' });
    toast('Supplier deleted');
    navigate('suppliers');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ============================================================
// PURCHASES
// ============================================================
async function renderPurchases(el) {
  const [purchases, products, suppliers] = await Promise.all([
    api('/api/purchases'),
    api('/api/products'),
    api('/api/suppliers'),
  ]);

  el.innerHTML = `
    <div class="page-header">
      <div><h1>📦 Purchases</h1><p class="subtitle">Restock orders</p></div>
      <button class="btn btn-primary" onclick="purchaseModal()">+ New Purchase</button>
    </div>
    <div class="card">
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Date</th><th>Items</th><th class="text-right">Total Cost</th></tr></thead>
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
            .join('') || '<tr><td colspan="4" class="empty-state">No purchases yet</td></tr>'}
        </tbody>
      </table></div>
    </div>
  `;
}

function purchaseModal() {
  openModal(
    'New Purchase (Restock)',
    `
    <div class="field mb"><label>Product *</label>
      <select id="f-product"><option value="">— Select product —</option></select>
    </div>
    <div class="form-row">
      <div class="field"><label>Quantity *</label><input type="number" id="f-qty" min="1" value="1" /></div>
      <div class="field"><label>Cost Price</label><input type="number" id="f-cost" step="0.01" /></div>
    </div>
    <div class="field mb"><label>Date</label><input type="date" id="f-date" value="${today()}" /></div>
    <div class="field"><label>Notes</label><input type="text" id="f-notes" /></div>
    `,
    `<button class="btn btn-outline" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="savePurchase()">Save Purchase</button>`
  );

  // Populate products
  api('/api/products').then((products) => {
    const sel = document.getElementById('f-product');
    products.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p._id;
      opt.textContent = `${p.name} (stock: ${p.stock})`;
      sel.appendChild(opt);
    });
  });
}

async function savePurchase() {
  const productId = document.getElementById('f-product').value;
  const quantity = parseInt(document.getElementById('f-qty').value) || 0;
  const costPrice = parseFloat(document.getElementById('f-cost').value) || 0;

  if (!productId || quantity <= 0) {
    toast('Select a product and valid quantity', 'error');
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
    toast('Purchase recorded');
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
      <div><h1>💸 Expenses</h1><p class="subtitle">Total: ${money(total)}</p></div>
      <button class="btn btn-primary" onclick="expenseModal()">+ Add Expense</button>
    </div>
    <div class="card">
      <div class="table-wrap"><table>
        <thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="text-right">Amount</th><th></th></tr></thead>
        <tbody>
          ${expenses
            .map(
              (e) => `<tr>
                <td>${fmtDate(e.date)}</td>
                <td>${escapeHtml(e.description)}</td>
                <td><span class="badge expense">${escapeHtml(e.category)}</span></td>
                <td class="text-right amount-neg">${money(e.amount)}</td>
                <td class="text-right"><button class="btn btn-danger btn-sm" onclick="deleteExpense('${e._id}')">Delete</button></td>
              </tr>`
            )
            .join('') || '<tr><td colspan="5" class="empty-state">No expenses yet</td></tr>'}
        </tbody>
      </table></div>
    </div>
  `;
}

function expenseModal() {
  openModal(
    'Add Expense',
    `
    <div class="form-row">
      <div class="field"><label>Description *</label><input type="text" id="f-desc" /></div>
      <div class="field"><label>Category</label><input type="text" id="f-category" placeholder="e.g. Rent, Utilities" /></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Amount *</label><input type="number" id="f-amount" min="0.01" step="0.01" /></div>
      <div class="field"><label>Date</label><input type="date" id="f-date" value="${today()}" /></div>
    </div>
    <div class="field"><label>Notes</label><input type="text" id="f-notes" /></div>
    `,
    `<button class="btn btn-outline" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveExpense()">Save</button>`
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
    toast('Expense recorded');
    navigate('expenses');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteExpense(id) {
  if (!confirm('Delete this expense?')) return;
  try {
    await api(`/api/expenses/${id}`, { method: 'DELETE' });
    toast('Expense deleted');
    navigate('expenses');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ============================================================
// LOCATIONS
// ============================================================
async function renderLocations(el) {
  const locations = await api('/api/locations');
  const byLocation = await api('/api/dashboard/by-location');

  el.innerHTML = `
    <div class="page-header">
      <div><h1>📍 Locations</h1><p class="subtitle">Where you sell</p></div>
      <button class="btn btn-primary" onclick="locationModal(null)">+ Add Location</button>
    </div>
    <div class="card">
      <div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Type</th><th>Address</th><th class="text-right">Revenue</th><th></th></tr></thead>
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
                  <button class="btn btn-outline btn-sm" onclick='locationModal(${JSON.stringify(l)})'>Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteLocation('${l._id}')">Delete</button>
                </td>
              </tr>`;
            })
            .join('') || '<tr><td colspan="5" class="empty-state">No locations yet</td></tr>'}
        </tbody>
      </table></div>
    </div>
  `;
}

function locationModal(location) {
  const isEdit = !!location;
  openModal(
    isEdit ? 'Edit Location' : 'Add Location',
    `
    <div class="form-row">
      <div class="field"><label>Name *</label><input type="text" id="f-name" value="${escapeHtml(location?.name || '')}" /></div>
      <div class="field"><label>Type</label>
        <select id="f-type">
          <option value="store" ${location?.type === 'store' ? 'selected' : ''}>Store</option>
          <option value="warehouse" ${location?.type === 'warehouse' ? 'selected' : ''}>Warehouse</option>
          <option value="market-stall" ${location?.type === 'market-stall' ? 'selected' : ''}>Market stall</option>
        </select>
      </div>
    </div>
    <div class="field"><label>Address</label><input type="text" id="f-address" value="${escapeHtml(location?.address || '')}" /></div>
    `,
    `<button class="btn btn-outline" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveLocation('${isEdit ? location._id : ''}')">Save</button>`
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
    toast('Location saved');
    navigate('locations');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteLocation(id) {
  if (!confirm('Delete this location?')) return;
  try {
    await api(`/api/locations/${id}`, { method: 'DELETE' });
    toast('Location deleted');
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
      <div><h1>📈 Reports</h1><p class="subtitle">Business performance</p></div>
    </div>

    <div class="grid grid-3">
      <div class="kpi"><span class="label">Revenue</span><span class="value positive">${money(summary.revenue)}</span></div>
      <div class="kpi"><span class="label">Expenses</span><span class="value negative">${money(summary.expenses)}</span></div>
      <div class="kpi"><span class="label">Net Income</span><span class="value ${summary.netIncome >= 0 ? 'positive' : 'negative'}">${money(summary.netIncome)}</span></div>
      <div class="kpi"><span class="label">Gross Profit</span><span class="value accent">${money(summary.profit)}</span></div>
      <div class="kpi"><span class="label">Purchases</span><span class="value">${money(summary.purchases)}</span></div>
      <div class="kpi"><span class="label">Payments Received</span><span class="value">${money(summary.payments)}</span></div>
    </div>

    <div class="card mt">
      <h2>Daily Revenue vs Expenses</h2>
      ${renderBarChart(chart)}
    </div>

    <div class="grid grid-2 mt">
      <div class="card">
        <h2>Revenue & Profit by Location</h2>
        ${
          byLocation.length
            ? `<table>
                <thead><tr><th>Location</th><th class="text-right">Revenue</th><th class="text-right">Profit</th></tr></thead>
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
            : '<p class="empty-state">No location data</p>'
        }
      </div>
      <div class="card">
        <h2>Top Products</h2>
        ${
          topProducts.length
            ? `<table>
                <thead><tr><th>Product</th><th class="text-right">Qty</th><th class="text-right">Revenue</th><th class="text-right">Profit</th></tr></thead>
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
            : '<p class="empty-state">No sales data</p>'
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
      <div><h1>⚙️ Settings</h1><p class="subtitle">App configuration</p></div>
    </div>
    <div class="card" style="max-width:520px">
      <div class="field mb"><label>Business Name</label><input type="text" id="f-bizname" value="${escapeHtml(s.businessName || '')}" /></div>
      <div class="field mb"><label>Currency</label>
        <select id="f-currency">
          <option value="USD" ${s.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
          <option value="UZS" ${s.currency === 'UZS' ? 'selected' : ''}>UZS (so'm)</option>
          <option value="EUR" ${s.currency === 'EUR' ? 'selected' : ''}>EUR (€)</option>
          <option value="RUB" ${s.currency === 'RUB' ? 'selected' : ''}>RUB (₽)</option>
        </select>
      </div>
      <button class="btn btn-primary" onclick="saveSettings()">Save Settings</button>
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
    toast('Settings saved');
    navigate('settings');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ============================================================
// INIT
// ============================================================
// Expose navigate globally for inline onclick handlers
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
window.updateProfitPreview = updateProfitPreview;
window.filterProducts = filterProducts;
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
  } catch (_) {
    // settings endpoint may not exist yet; ignore
  }

  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.dataset.view));
  });

  navigate('dashboard');
}

init();
