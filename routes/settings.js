const express = require('express');
const { getDb } = require('../db');

const router = express.Router();
const col = () => getDb().collection('settings');

// Get settings (single doc)
router.get('/', async (req, res) => {
  try {
    const settings = await col().findOne({ _id: 'app' }) || { _id: 'app' };
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upsert settings
router.put('/', async (req, res) => {
  try {
    const { currency, businessName } = req.body;
    const update = {};
    if (currency !== undefined) update.currency = currency;
    if (businessName !== undefined) update.businessName = businessName;

    const result = await col().findOneAndUpdate(
      { _id: 'app' },
      { $set: update, $setOnInsert: { _id: 'app' } },
      { upsert: true, returnDocument: 'after' }
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
