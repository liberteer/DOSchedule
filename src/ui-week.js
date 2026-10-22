'use strict';
// Week screen body: seven full-height columns (Mon-Sun). The highlighted day is a wide
// column showing everything in full; the other six are narrow one-line-per-entry overviews.
// Pure: (app, inner width, body height) -> { rows, more }. The frame is drawn by ui.js.

const { addDays, weekStart, longDate, relativeDays, parseISO, DAY_SHORT } = require('./dates');
const { dayOrder } = require('./app');
const { datesOf, cellText } = require('./entry');
const { sty, fit, entryColor, glyph, BORDER } = require('./term');
const { dayRows, scrollTop } = require('./ui-day');

const MIN_W_WEEK = 76;
const MIN_H_WEEK = 16;
const GRID = '90';

// ow = narrow column width, Sw = wide (highlighted) column width; Sw + 6*ow + 6 separators = inner.
function weekLayout(inner) {
  const usable = inner - 6;
  const ow = Math.max(7, Math.floor((usable - Math.round(usable * 0.4)) / 6));
  return { ow, Sw: usable - 6 * ow };
}

function bodyWeek(app, inner, B, today) {
  const { ow, Sw } = weekLayout(inner);
  const start = weekStart(app.calDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const selI = days.indexOf(app.calDate);

  // Narrow columns list tasks and events only (notes only show in the wide column).
  const byDate = new Map(days.map((d) => [d, []]));
  for (const e of app.store.entries) {
    if (e.kind === 'raw' || e.kind === 'note') continue;
    for (const d of datesOf(e)) if (byDate.has(d)) byDate.get(d).push(e);
  }
  for (const [d, list] of byDate) list.sort((a, b) => dayOrder(a, b, d));

  const Bb = B - 2;                       // rows under the header + rule
  let more = {};
  const cols = days.map((date, i) => {
    const lines = [];
    const isToday = date === today;
    if (i === selI) {
      const head = `${longDate(date)}  ${relativeDays(date, today)}`;
      lines.push(sty(fit(head, Sw), '1;97', '44'));
      lines.push(sty('─'.repeat(Sw), GRID));
      const ents = app.dayEntries(date);
      const rows = dayRows(ents, Sw, app.dayIdx, date);
      const top = scrollTop(rows, app.dayIdx, app.dayTop, Bb);
      app.dayTop = top;
      more = { up: top > 0, down: top + Bb < rows.length };
      for (let r = 0; r < Bb; r++) lines.push(rows[top + r] ? rows[top + r].html : ' '.repeat(Sw));
      return lines;
    }
    const { d } = parseISO(date);
    const label = `${DAY_SHORT[(i + 1) % 7]} ${d}${isToday ? '*' : ''}`;
    lines.push(sty(fit(label, ow), isToday ? '1;92' : i >= 5 ? '36' : '1;97'));
    lines.push(sty('─'.repeat(ow), GRID));
    const ents = byDate.get(date);
    const overflow = ents.length > Bb;
    const shown = overflow ? Bb - 1 : ents.length;
    for (let r = 0; r < shown; r++) {
      lines.push(sty(glyph(ents[r], date) + fit(cellText(ents[r], ow - 1), ow - 1), entryColor(ents[r], date)));
    }
    if (overflow) lines.push(sty(fit(ow >= 9 ? `+${ents.length - shown} more` : `+${ents.length - shown}`, ow), GRID));
    while (lines.length < B) lines.push(' '.repeat(ow));
    return lines;
  });

  // The highlighted column is fenced with double lines.
  const sep = (i, row) => {
    const fenced = i === selI || i + 1 === selI;
    if (row === 1) return fenced ? sty('╫', BORDER) : sty('┼', GRID);
    return fenced ? sty('║', BORDER) : sty('│', GRID);
  };
  const rows = [];
  for (let r = 0; r < B; r++) {
    let line = cols[0][r];
    for (let i = 1; i < 7; i++) line += sep(i - 1, r) + cols[i][r];
    rows.push(line);
  }
  return { rows, more };
}

module.exports = { bodyWeek, weekLayout, MIN_W_WEEK, MIN_H_WEEK };
