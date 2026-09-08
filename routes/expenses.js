const express = require('express');
const { getDb } = require('../db');
const { num, idOrNull, dateRangeFilter } = require('../lib/util');

const router = express.Router();
const col = () => getDb().collection('expenses');

// List expenses with optional date range and category
router.get('/', async (req, res) => {
  try {
    const filter = { ...dateRangeFilter(req.query) };
    if (req.query.category) filter.category = req.query.category;
    const expenses = await col().find(filter).sort({ date: -1 }).toArray();
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List distinct categories (for filters/autocomplete)
router.get('/categories', async (req, res) => {
  try {
    const categories = await col().distinct('category');
    res.json(categories.sort());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { description, category, amount, date, locationId, supplierId, notes } = req.body;
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'description is required' });
    }
    const parsed = num(amount);
    if (parsed <= 0) return res.status(400).json({ error: 'amount must be positive' });

    const expense = {
      description: description.trim(),
      category: (category || 'Other').trim(),
      amount: parsed,
      date: date ? new Date(date) : new Date(),
      locationId: idOrNull(locationId),
      supplierId: idOrNull(supplierId),
      notes: (notes || '').trim(),
      createdAt: new Date(),
    };

    const result = await col().insertOne(expense);
    res.status(201).json({ _id: result.insertedId, ...expense });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = idOrNull(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    const result = await col().deleteOne({ _id: id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'expense not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
