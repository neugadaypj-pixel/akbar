const express = require('express');
const { getDb } = require('../db');
const { num, idOrNull } = require('../lib/util');

const router = express.Router();
const col = () => getDb().collection('customers');

// Compute debt from sales/payments for each customer
async function withDebt(customers) {
  const sales = await getDb().collection('sales').aggregate([
    { $unwind: '$items' },
    { $group: { _id: '$customerId', total: { $sum: { $multiply: ['$items.quantity', '$items.sellPrice'] } } } },
  ]).toArray();
  const payments = await getDb().collection('payments').aggregate([
    { $group: { _id: '$customerId', total: { $sum: '$amount' } } },
  ]).toArray();

  const owed = {};
  for (const s of sales) owed[String(s._id)] = s.total;
  for (const p of payments) {
    const k = String(p._id);
    owed[k] = (owed[k] || 0) - p.total;
  }

  return customers.map((c) => ({ ...c, debt: owed[String(c._id)] || 0 }));
}

router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const filter = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
      ];
    }
    const customers = await col().find(filter).sort({ name: 1 }).toArray();
    res.json(await withDebt(customers));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = idOrNull(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    const customer = await col().findOne({ _id: id });
    if (!customer) return res.status(404).json({ error: 'customer not found' });
    const [withDebtRow] = await withDebt([customer]);
    res.json(withDebtRow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, phone, email, address, notes } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    const customer = {
      name: name.trim(),
      phone: (phone || '').trim(),
      email: (email || '').trim(),
      address: (address || '').trim(),
      notes: (notes || '').trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await col().insertOne(customer);
    res.status(201).json({ _id: result.insertedId, ...customer, debt: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = idOrNull(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    const allowed = ['name', 'phone', 'email', 'address', 'notes'];
    const update = { updatedAt: new Date() };
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = String(req.body[key]).trim();
    }
    const result = await col().findOneAndUpdate({ _id: id }, { $set: update }, { returnDocument: 'after' });
    if (!result) return res.status(404).json({ error: 'customer not found' });
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
    if (result.deletedCount === 0) return res.status(404).json({ error: 'customer not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
