const express = require('express');
const { getDb } = require('../db');
const { idOrNull } = require('../lib/util');

const router = express.Router();
const col = () => getDb().collection('suppliers');

router.get('/', async (req, res) => {
  try {
    const suppliers = await col().find({}).sort({ name: 1 }).toArray();
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, contactName, phone, email, address } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    const supplier = {
      name: name.trim(),
      contactName: (contactName || '').trim(),
      phone: (phone || '').trim(),
      email: (email || '').trim(),
      address: (address || '').trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await col().insertOne(supplier);
    res.status(201).json({ _id: result.insertedId, ...supplier });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = idOrNull(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    const allowed = ['name', 'contactName', 'phone', 'email', 'address'];
    const update = { updatedAt: new Date() };
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = String(req.body[key]).trim();
    }
    const result = await col().findOneAndUpdate({ _id: id }, { $set: update }, { returnDocument: 'after' });
    if (!result) return res.status(404).json({ error: 'supplier not found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = idOrNull(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    const result = await col().deleteOne({ _id: id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'supplier not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
