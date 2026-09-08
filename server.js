require('dotenv').config();

const express = require('express');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'business-finance';

let db = null;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Helpers ----------
function transactionsCollection() {
  if (!db) {
    throw new Error('Database not connected yet');
  }
  return db.collection('transactions');
}

// ---------- API Routes ----------

// Get summary totals (income, expenses, balance)
app.get('/api/summary', async (req, res) => {
  try {
    const result = await transactionsCollection()
      .aggregate([
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' },
          },
        },
      ])
      .toArray();

    const summary = { income: 0, expenses: 0 };
    for (const row of result) {
      if (row._id === 'income') summary.income = row.total;
      if (row._id === 'expense') summary.expenses = row.total;
    }
    summary.balance = summary.income - summary.expenses;

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all transactions (newest first)
app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await transactionsCollection()
      .find({})
      .sort({ date: -1, createdAt: -1 })
      .toArray();
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new transaction
app.post('/api/transactions', async (req, res) => {
  try {
    const { type, description, category, amount, date } = req.body;

    if (!type || !['income', 'expense'].includes(type)) {
      return res.status(400).json({ error: 'type must be "income" or "expense"' });
    }
    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ error: 'description is required' });
    }
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    const transaction = {
      type,
      description: description.trim(),
      category: (category || '').trim() || 'Other',
      amount: parsedAmount,
      date: date ? new Date(date) : new Date(),
      createdAt: new Date(),
    };

    const result = await transactionsCollection().insertOne(transaction);
    res.status(201).json({ _id: result.insertedId, ...transaction });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a transaction
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'invalid id' });
    }

    const result = await transactionsCollection().deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'transaction not found' });
    }

    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Start server ----------
async function start() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    db = client.db(DB_NAME);
    console.log(`✅ Connected to MongoDB (${DB_NAME})`);

    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    console.error('   Check your MONGODB_URI in the .env file.');
    process.exit(1);
  }
}

start();
