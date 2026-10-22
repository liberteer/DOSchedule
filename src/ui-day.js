'use strict';
// One day's entries as full-width rows (grouped, wrapped, scrollable).
// Used by the month screen's right panel and by the week screen's wide column.

const { sty, len, fit, wrap, entryColor, symbol } = require('./term');
const { isDeadlineTask, withTime } = require('./entry');
const { shortDay } = require('./dates');

const TITLES = { task: 'TASKS', event: 'EVENTS', note: 'NOTES' };

// -> rows [{ html, ei?, head? }]. ei = index of the entry a row belongs to (for scrolling);
// sel = index of the highlighted entry, or -1 for none.
// `date` is the day being shown (deadline tasks explain whether it is a work day or the deadline).
function dayRows(ents, w, sel, date) {
  const rows = [];
  if (!ents.length) {
    rows.push({ html: sty(fit('  Nothing planned.', w), '90') });
    rows.push({ html: sty(fit('  Type below to add an entry.', w), '90') });
    return rows;
  }
  const textW = w - 10;     // 10 = "> " + 3-col symbol + " " + 3-col priority + " "
  let lastKind = null;
  ents.forEach((e, ei) => {
    if (e.kind !== lastKind) {
      if (lastKind) rows.push({ html: ' '.repeat(w) });
      const n = ents.filter((x) => x.kind === e.kind).length;
      const head = `── ${TITLES[e.kind]} (${n}) `;
      rows.push({ head: true, html: sty(head + '─'.repeat(Math.max(0, w - len(head))), '1;97') });
      lastKind = e.kind;
    }
    const selected = ei === sel;
    const rev = selected ? '7;' : '';
    wrap(withTime(e), textW).forEach((part, j) => {
      const prefix = j === 0
        ? `${selected ? '> ' : '  '}${symbol(e, date)} ${'!'.repeat(e.priority).padEnd(3)} `
        : ' '.repeat(10);
      rows.push({ html: sty(fit(prefix + part, w), rev + entryColor(e, date)), ei });
    });
    if (isDeadlineTask(e)) {
      const note = e.date === date
        ? `deadline; work ${e.work.map((d) => shortDay(d, e.date)).join(', ')}`
        : `work day; due ${shortDay(e.date)}`;   // absolute: "tomorrow" would be relative to the day shown
      for (const part of wrap(note, textW)) rows.push({ html: sty(fit(' '.repeat(10) + part, w), '90'), ei });
    }
  });
  return rows;
}

// Scroll offset that keeps entry `sel` (all its wrapped rows if possible, plus its section
// title) inside a window of B rows. `top` is the previous offset.
function scrollTop(rows, sel, top, B) {
  const idxs = sel < 0 ? [] : rows.map((r, i) => (r.ei === sel ? i : -1)).filter((i) => i >= 0);
  let t = idxs.length ? top : 0;
  if (idxs.length) {
    const first = idxs[0];
    const last = idxs[idxs.length - 1];
    if (first < t) t = first;
    if (last >= t + B) t = last - B + 1;
    if (first < t) t = first;
    if (rows[first - 1] && rows[first - 1].head && first - 1 < t) t = first - 1; // keep the section title in view
  }
  return Math.max(0, Math.min(t, rows.length - B));
}

module.exports = { dayRows, scrollTop };
