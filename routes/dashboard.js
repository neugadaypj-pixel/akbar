const express = require('express');
const { getDb } = require('../db');
const { dateRangeFilter } = require('../lib/util');

const router = express.Router();

// KPI summary for a date range
router.get('/summary', async (req, res) => {
  try {
    const db = getDb();
    const range = dateRangeFilter(req.query);

    const [salesAgg, expensesAgg, purchasesAgg, paymentsAgg, productCount, lowStock, customerCount] =
      await Promise.all([
        db.collection('sales').aggregate([
          { $match: { ...range, voided: { $ne: true } } },
          { $group: { _id: null, revenue: { $sum: '$total' }, profit: { $sum: '$grossProfit' } } },
        ]).toArray(),
        db.collection('expenses').aggregate([
          { $match: range },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]).toArray(),
        db.collection('purchases').aggregate([
          { $match: range },
          { $group: { _id: null, total: { $sum: '$totalCost' } } },
        ]).toArray(),
        db.collection('payments').aggregate([
          { $match: range },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]).toArray(),
        db.collection('products').countDocuments(),
        db.collection('products').countDocuments({ $expr: { $lte: ['$stock', '$reorderLevel'] } }),
        db.collection('customers').countDocuments(),
      ]);

    const revenue = salesAgg[0]?.revenue || 0;
    const profit = salesAgg[0]?.profit || 0;
    const expenses = expensesAgg[0]?.total || 0;
    const purchases = purchasesAgg[0]?.total || 0;
    const payments = paymentsAgg[0]?.total || 0;

    res.json({
      revenue,
      expenses,
      profit,
      purchases,
      payments,
      netIncome: revenue - expenses,
      productCount,
      lowStockCount: lowStock,
      customerCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Time-series for charts (daily revenue/expenses)
router.get('/chart', async (req, res) => {
  try {
    const db = getDb();
    const range = dateRangeFilter(req.query);

    const sales = await db.collection('sales').aggregate([
      { $match: { ...range, voided: { $ne: true } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          revenue: { $sum: '$total' },
          profit: { $sum: '$grossProfit' },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray();

    const expenses = await db.collection('expenses').aggregate([
      { $match: range },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray();

    const expenseMap = {};
    for (const e of expenses) expenseMap[e._id] = e.total;

    const chart = sales.map((s) => ({
      date: s._id,
      revenue: s.revenue,
      profit: s.profit,
      expenses: expenseMap[s._id] || 0,
    }));

    res.json(chart);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Top selling products
router.get('/top-products', async (req, res) => {
  try {
    const db = getDb();
    const range = dateRangeFilter(req.query);
    const top = await db.collection('sales').aggregate([
      { $match: { ...range, voided: { $ne: true } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          name: { $first: '$items.name' },
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.lineTotal' },
          cost: { $sum: { $multiply: ['$items.quantity', '$items.costPrice'] } },
        },
      },
      {
        $addFields: {
          profit: { $subtract: ['$revenue', '$cost'] },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]).toArray();
    res.json(top);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sales by location
router.get('/by-location', async (req, res) => {
  try {
    const db = getDb();
    const range = dateRangeFilter(req.query);
    const rows = await db.collection('sales').aggregate([
      { $match: { ...range, voided: { $ne: true } } },
      { $group: { _id: '$locationId', revenue: { $sum: '$total' }, profit: { $sum: '$grossProfit' } } },
    ]).toArray();

    const locations = await db.collection('locations').find({}).toArray();
    const locMap = {};
    for (const l of locations) locMap[String(l._id)] = l.name;

    res.json(rows.map((r) => ({
      location: locMap[String(r._id)] || 'Unknown',
      revenue: r.revenue,
      profit: r.profit || 0,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
