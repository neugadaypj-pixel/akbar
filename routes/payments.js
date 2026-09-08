const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { num, idOrNull, dateRangeFilter } = require('../lib/util');

const router = express.Router();
const col = () => getDb().collection('payments');

// List payments, optional customerId / date range
router.get('/', async (req, res) => {
  try {
    const filter = { ...dateRangeFilter(req.query) };
    if (req.query.customerId && ObjectId.isValid(req.query.customerId)) {
      filter.customerId = new ObjectId(req.query.customerId);
    }
    const payments = await col().find(filter).sort({ date: -1 }).toArray();
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record a customer debt payment
router.post('/', async (req, res) => {
  try {
    const { customerId, amount, method, notes, date } = req.body;
    if (!customerId || !ObjectId.isValid(customerId)) {
      return res.status(400).json({ error: 'customerId is required' });
    }
    const parsed = num(amount);
    if (parsed <= 0) return res.status(400).json({ error: 'amount must be positive' });

    const payment = {
      customerId: new ObjectId(customerId),
      amount: parsed,
      method: (method || 'cash').trim(),
      notes: (notes || '').trim(),
      date: date ? new Date(date) : new Date(),
      createdAt: new Date(),
    };

    const result = await col().insertOne(payment);
    res.status(201).json({ _id: result.insertedId, ...payment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = idOrNull(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    const result = await col().deleteOne({ _id: id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'payment not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
