const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb, getNextSequence, withTransaction } = require('../db');
const { num, idOrNull, dateRangeFilter } = require('../lib/util');

const router = express.Router();
const salesCol = () => getDb().collection('sales');
const productsCol = () => getDb().collection('products');

// List sales with optional date range + customerId, with populated names
router.get('/', async (req, res) => {
  try {
    const filter = { ...dateRangeFilter(req.query) };
    if (req.query.customerId && ObjectId.isValid(req.query.customerId)) {
      filter.customerId = new ObjectId(req.query.customerId);
    }
    const sales = await salesCol().find(filter).sort({ date: -1, number: -1 }).toArray();
    res.json(sales);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = idOrNull(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    const sale = await salesCol().findOne({ _id: id });
    if (!sale) return res.status(404).json({ error: 'sale not found' });
    res.json(sale);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a sale. Body:
// { customerId?, locationId?, items: [{productId, quantity, sellPrice}], paymentType: 'cash'|'card'|'credit'|'mixed', amountPaid, discount, notes }
router.post('/', async (req, res) => {
  try {
    const { customerId, locationId, items, paymentType, amountPaid, discount, notes, date } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }
    for (const item of items) {
      if (!ObjectId.isValid(item.productId)) {
        return res.status(400).json({ error: `invalid productId: ${item.productId}` });
      }
      const qty = num(item.quantity);
      if (qty <= 0) return res.status(400).json({ error: 'quantity must be positive' });
    }

    const saleDate = date ? new Date(date) : new Date();
    const sale = {
      number: await getNextSequence('saleNumber'),
      date: saleDate,
      customerId: idOrNull(customerId),
      locationId: idOrNull(locationId),
      items: [],
      subtotal: 0,
      discount: num(discount),
      total: 0,
      grossProfit: 0,
      paymentType: paymentType || 'cash',
      amountPaid: 0,
      balanceDue: 0,
      notes: (notes || '').trim(),
      createdAt: new Date(),
    };

    await withTransaction(async (session) => {
      for (const item of items) {
        const productId = new ObjectId(item.productId);
        const product = await productsCol().findOne({ _id: productId }, { session });
        if (!product) throw new Error(`Product ${item.productId} not found`);

        const quantity = num(item.quantity);
        const sellPrice = num(item.sellPrice, product.sellPrice);

        if (product.stock < quantity) {
          throw new Error(`Not enough stock for "${product.name}" (available: ${product.stock})`);
        }

        await productsCol().updateOne(
          { _id: productId },
          { $inc: { stock: -quantity }, $set: { updatedAt: new Date() } },
          { session }
        );

        const lineTotal = quantity * sellPrice;
        const lineCost = quantity * (product.costPrice || 0);
        sale.items.push({
          productId,
          name: product.name,
          sku: product.sku,
          quantity,
          sellPrice,
          costPrice: product.costPrice,
          lineTotal,
        });
        sale.subtotal += lineTotal;
        sale.grossProfit += lineTotal - lineCost;
      }

      sale.total = Math.max(0, sale.subtotal - sale.discount);

      if (sale.paymentType === 'credit') {
        sale.amountPaid = 0;
      } else {
        sale.amountPaid = Math.min(sale.total, num(amountPaid, sale.total));
      }
      sale.balanceDue = sale.total - sale.amountPaid;

      await salesCol().insertOne(sale, { session });
    });

    res.status(201).json(sale);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Refund/void a sale (restores stock)
router.post('/:id/void', async (req, res) => {
  try {
    const id = idOrNull(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });

    const sale = await salesCol().findOne({ _id: id });
    if (!sale) return res.status(404).json({ error: 'sale not found' });
    if (sale.voided) return res.status(400).json({ error: 'sale already voided' });

    await withTransaction(async (session) => {
      for (const item of sale.items) {
        await productsCol().updateOne(
          { _id: item.productId },
          { $inc: { stock: item.quantity }, $set: { updatedAt: new Date() } },
          { session }
        );
      }
      await salesCol().updateOne(
        { _id: id },
        { $set: { voided: true, voidedAt: new Date() } },
        { session }
      );
    });

    res.json({ voided: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
