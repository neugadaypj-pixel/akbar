# 🏪 Market Manager

A full small-business management system for a clothing market. Tracks **products/inventory**, **customers with debt**, **suppliers**, **locations**, **sales (POS)**, **payments**, **expenses**, and **purchases** — with a live dashboard and reports.

Built with **Node.js + Express + MongoDB** and a responsive vanilla JS frontend (no build step).

## Features

### 📊 Dashboard & Reports
- Revenue, expenses, net income, gross profit
- Purchases, payments received, product count, low-stock count
- Revenue vs expenses bar chart (daily)
- Top selling products
- Revenue by location
- Low-stock alerts

### 🧾 Point of Sale (POS)
- Multi-item cart with searchable product grid
- Automatic stock deduction
- Payment types: cash, card, credit (on account), mixed
- Partial payments → automatically tracks customer debt
- Discounts and notes

### 👕 Products / Inventory
- Name, SKU, category, cost price, sell price, stock, reorder level, supplier
- Low-stock detection
- Search

### 👥 Customers
- Name, phone, email, address, notes
- Automatic **debt balance** (total sales on credit − payments received)
- Record payments
- Full transaction history (sales + payments)

### 🚚 Suppliers
- Contact, phone, email, address

### 📦 Purchases (Restock)
- Restock products (increases stock) with cost tracking

### 💸 Expenses
- Description, category, amount, date, notes
- Category badges

### 📍 Locations
- Store / warehouse / market stall, address, revenue per location

### ⚙️ Settings
- Business name and currency (USD, UZS, EUR, RUB)

## Tech stack

- **Backend**: Node.js, Express, MongoDB driver (native, no ODM)
- **Frontend**: Vanilla HTML/CSS/JS SPA
- **Database**: MongoDB (local or Atlas)
- **Deployment**: Render-ready ([`render.yaml`](render.yaml))

## Project structure

```
.
├── server.js              # Express app + route mounting
├── db.js                  # MongoDB connection + transactions helper
├── lib/util.js            # Shared validation helpers
├── routes/
│   ├── products.js        # Inventory CRUD
│   ├── customers.js       # Customers + debt
│   ├── suppliers.js
│   ├── locations.js
│   ├── sales.js           # POS + stock deduction + void
│   ├── payments.js        # Customer debt payments
│   ├── expenses.js
│   ├── purchases.js       # Restock
│   ├── dashboard.js       # KPIs + charts
│   └── settings.js
├── public/
│   ├── index.html         # SPA shell
│   ├── style.css
│   └── app.js             # All views + routing
├── package.json
├── render.yaml            # Render blueprint
└── .env.example
```

## Setup (local)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and set `MONGODB_URI`.
3. Run:
   ```bash
   npm start
   ```
4. Open http://localhost:3000

## Deployment on Render

1. Push this repo to GitHub.
2. On Render, create a **Web Service** connected to the repo.
3. Set **Build Command** `npm install` and **Start Command** `npm start`.
4. Add environment variable `MONGODB_URI` (your Atlas connection string) and `DB_NAME`.
5. Deploy.

> MongoDB Atlas: allow network access from anywhere (`0.0.0.0/0`) so Render can connect.

## API overview

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET/POST | `/api/products` | List / create products |
| PUT/DELETE | `/api/products/:id` | Update / delete product |
| GET | `/api/products/low-stock` | Low-stock products |
| GET/POST | `/api/customers` | List (with debt) / create |
| PUT/DELETE | `/api/customers/:id` | Update / delete |
| GET/POST | `/api/suppliers` | List / create |
| GET/POST | `/api/locations` | List / create |
| GET/POST | `/api/sales` | List / create sale (POS) |
| POST | `/api/sales/:id/void` | Void a sale (restore stock) |
| GET/POST | `/api/payments` | List / record payment |
| GET/POST | `/api/expenses` | List / create expense |
| GET/POST | `/api/purchases` | List / create restock |
| GET | `/api/dashboard/summary` | KPI totals |
| GET | `/api/dashboard/chart` | Daily revenue/expense series |
| GET | `/api/dashboard/top-products` | Best sellers |
| GET | `/api/dashboard/by-location` | Revenue by location |
| GET/PUT | `/api/settings` | App settings |

## Data model

- **products**: name, sku, category, costPrice, sellPrice, stock, reorderLevel, supplierId
- **customers**: name, phone, email, address, notes
- **suppliers**: name, contactName, phone, email, address
- **locations**: name, type, address
- **sales**: number, date, customerId, locationId, items[], subtotal, discount, total, grossProfit, paymentType, amountPaid, balanceDue, voided
- **payments**: customerId, amount, method, date, notes
- **expenses**: description, category, amount, date, notes
- **purchases**: number, date, supplierId, items[], totalCost
- **counters**: auto-incrementing sequences
- **settings**: businessName, currency
