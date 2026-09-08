const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { num, idOrNull } = require('../lib/util');

const router = express.Router();
const col = () => getDb().collection('products');

// List products with optional search and low-stock flag
router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const filter = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { sku: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
      ];
    }
    const products = await col().find(filter).sort({ name: 1 }).toArray();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/low-stock', async (req, res) => {
  try {
    const products = await col()
      .aggregate([
        { $addFields: { lowStock: { $lte: ['$stock', '$reorderLevel'] } } },
        { $match: { lowStock: true } },
      ])
      .toArray();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = idOrNull(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    const product = await col().findOne({ _id: id });
    if (!product) return res.status(404).json({ error: 'product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create product
router.post('/', async (req, res) => {
  try {
    const { name, sku, category, costPrice, sellPrice, stock, reorderLevel, supplierId } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

    const product = {
      name: name.trim(),
      sku: (sku || '').trim() || null,
      category: (category || 'General').trim(),
      costPrice: num(costPrice),
      sellPrice: num(sellPrice),
      stock: num(stock),
      reorderLevel: num(reorderLevel, 5),
      supplierId: idOrNull(supplierId),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await col().insertOne(product);
    res.status(201).json({ _id: result.insertedId, ...product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update product
router.put('/:id', async (req, res) => {
  try {
    const id = idOrNull(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });

    const allowed = ['name', 'sku', 'category', 'costPrice', 'sellPrice', 'stock', 'reorderLevel', 'supplierId'];
    const update = { updatedAt: new Date() };
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    if (update.name !== undefined) update.name = update.name.trim();
    if (update.supplierId !== undefined) update.supplierId = idOrNull(update.supplierId);
    ['costPrice', 'sellPrice', 'stock', 'reorderLevel'].forEach((k) => {
      if (update[k] !== undefined) update[k] = num(update[k]);
    });

    const result = await col().findOneAndUpdate(
      { _id: id },
      { $set: update },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'product not found' });
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
    if (result.deletedCount === 0) return res.status(404).json({ error: 'product not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
