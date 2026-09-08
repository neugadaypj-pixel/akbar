const express = require('express');
const { getDb } = require('../db');
const { idOrNull } = require('../lib/util');

const router = express.Router();
const col = () => getDb().collection('locations');

router.get('/', async (req, res) => {
  try {
    const locations = await col().find({}).sort({ name: 1 }).toArray();
    res.json(locations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, type, address } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    const location = {
      name: name.trim(),
      type: (type || 'store').trim(),
      address: (address || '').trim(),
      createdAt: new Date(),
    };
    const result = await col().insertOne(location);
    res.status(201).json({ _id: result.insertedId, ...location });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = idOrNull(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    const allowed = ['name', 'type', 'address'];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = String(req.body[key]).trim();
    }
    const result = await col().findOneAndUpdate({ _id: id }, { $set: update }, { returnDocument: 'after' });
    if (!result) return res.status(404).json({ error: 'location not found' });
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
    if (result.deletedCount === 0) return res.status(404).json({ error: 'location not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
