# 💼 Business Finance Tracker

A simple app to track a small business's **income** and **expenses**, with totals and a running balance. Built with **Node.js + Express + MongoDB** and a lightweight HTML/CSS/JS frontend.

## Features

- Add income and expense transactions (type, amount, description, category, date)
- View total income, total expenses, and balance
- Filter transactions by type
- Delete transactions
- Data persisted in MongoDB

## Why not a plain HTML file?

Browsers cannot talk to MongoDB directly (MongoDB uses its own TCP protocol, not HTTP). This project uses a small Node.js/Express server that serves the HTML and acts as the bridge to MongoDB.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure your MongoDB connection

Copy the example environment file:

```bash
copy .env.example .env
```

Then edit `.env` and set your `MONGODB_URI`. You can use:

- **Local MongoDB** (default): `mongodb://localhost:27017`
- **MongoDB Atlas** (free tier): get your connection string from the Atlas dashboard and paste it in.

### 3. Run the app

```bash
npm start
```

Open http://localhost:3000 in your browser.

## Project structure

```
.
├── server.js          # Express server + MongoDB API
├── package.json
├── .env.example       # Environment variable template
└── public/
    ├── index.html     # Frontend UI
    ├── style.css      # Styling
    └── app.js         # Frontend logic + API calls
```

## API

| Method | Endpoint                 | Description                  |
| ------ | ------------------------ | ---------------------------- |
| GET    | `/api/transactions`      | List all transactions        |
| POST   | `/api/transactions`      | Add a transaction            |
| DELETE | `/api/transactions/:id`  | Delete a transaction         |
| GET    | `/api/summary`           | Income, expenses, balance    |
