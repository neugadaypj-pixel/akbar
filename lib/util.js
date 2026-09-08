const { ObjectId } = require('mongodb');

// Convert a value to an ObjectId, or null if missing/invalid.
function idOrNull(value) {
  if (!value) return null;
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}

function isValidId(value) {
  return !!value && ObjectId.isValid(value);
}

// Coerce to a finite number, falling back to a default.
function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// Coerce to a Date, or null if invalid.
function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// Build a date-range filter for { date: Date } fields.
// Supports "from" and "to" (YYYY-MM-DD or ISO strings). to is inclusive.
function dateRangeFilter(query) {
  const filter = {};
  const from = toDate(query.from);
  const to = toDate(query.to);

  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter.date.$lte = end;
    }
  }
  return filter;
}

module.exports = { idOrNull, isValidId, num, toDate, dateRangeFilter };
