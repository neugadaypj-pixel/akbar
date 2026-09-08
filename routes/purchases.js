const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb, getNextSequence, withTransaction } = require('../db');
const { num, idOrNull, dateRangeFilter } = require('../lib/util');

const router = express.Router();
const purchasesCol = () => getDb().collection('purchases');
const productsCol = () => getDb().collection('products');

// List purchases (restock orders)
router.get('/', async (req, res) => {
  try {
    const filter = { ...dateRangeFilter(req.query) };
    const purchases = await purchasesCol().find(filter).sort({ date: -1, number: -1 }).toArray();
    res.json(purchases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a purchase (restock). Body:
// { supplierId?, locationId?, items: [{productId, quantity, costPrice}], date, notes }
router.post('/', async (req, res) => {
  try {
    const { supplierId, locationId, items, date, notes } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }
    for (const item of items) {
      if (!ObjectId.isValid(item.productId)) {
        return res.status(400).json({ error: `invalid productId: ${item.productId}` });
      }
      if (num(item.quantity) <= 0) {
        return res.status(400).json({ error: 'quantity must be positive' });
      }
    }

    const purchase = {
      number: await getNextSequence('purchaseNumber'),
      date: date ? new Date(date) : new Date(),
      supplierId: idOrNull(supplierId),
      locationId: idOrNull(locationId),
      items: [],
      totalCost: 0,
      notes: (notes || '').trim(),
      createdAt: new Date(),
    };

    await withTransaction(async (session) => {
      for (const item of items) {
        const productId = new ObjectId(item.productId);
        const product = await productsCol().findOne({ _id: productId }, { session });
        if (!product) throw new Error(`Product ${item.productId} not found`);

        const quantity = num(item.quantity);
        const costPrice = num(item.costPrice, product.costPrice);

        await productsCol().updateOne(
          { _id: productId },
          { $inc: { stock: quantity }, $set: { updatedAt: new Date() } },
          { session }
        );

        purchase.items.push({
          productId,
          name: product.name,
          quantity,
          costPrice,
          lineTotal: quantity * costPrice,
        });
        purchase.totalCost += quantity * costPrice;
      }

      await purchasesCol().insertOne(purchase, { session });
    });

    res.status(201).json(purchase);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
