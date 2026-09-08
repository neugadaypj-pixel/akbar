const { MongoClient } = require('mongodb');

let client = null;
let db = null;

async function connect(uri, dbName) {
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  return db;
}

function getDb() {
  if (!db) {
    throw new Error('Database not connected yet');
  }
  return db;
}

// Auto-incrementing sequence used for sale/purchase numbers.
async function getNextSequence(name) {
  const result = await getDb()
    .collection('counters')
    .findOneAndUpdate(
      { _id: name },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
  return result.seq;
}

// Runs `fn(session)` inside a MongoDB transaction (Atlas supports these).
async function withTransaction(fn) {
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      await fn(session);
    });
  } finally {
    await session.endSession();
  }
}

module.exports = { connect, getDb, getNextSequence, withTransaction };
