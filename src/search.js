'use strict';
// Find entries by words. Read-only; works on the entries already in memory.
//   - capitals and accents do not matter: "zare" finds "Žare", "cuprija" finds "ćuprija"
//     (the letter đ is not an accent mark, so it gets its own rule: đ = d)
//   - every word you type must occur, in any order
//   - finished tasks and past events are included: finding old things is the point
//   - newest day first; at most `limit` results are returned, `total` says how many matched

const { timeLabel } = require('./entry');

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

const KIND_ORDER = { task: 0, event: 1, note: 2 };

// The folded text of an entry is remembered, so a keystroke only folds the new query.
const cache = new WeakMap();
function haystack(e) {
  const raw = `${e.text} ${timeLabel(e)}`;
  const hit = cache.get(e);
  if (hit && hit.raw === raw) return hit.folded;
  const folded = fold(raw);
  cache.set(e, { raw, folded });
  return folded;
}

// -> { results: [entry], total: number }
function searchEntries(entries, query, limit = 200) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return { results: [], total: 0 };
  const hits = entries.filter((e) => e.kind !== 'raw' && words.every((w) => haystack(e).includes(w)));
  hits.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)
    || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.priority - a.priority || a.id - b.id);
  return { results: hits.slice(0, limit), total: hits.length };
}

module.exports = { searchEntries, fold };
