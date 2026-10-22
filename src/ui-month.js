'use strict';
// Month screen body: calendar grid on the left, selected day in full on the right.
// Pure: (app, inner width, body height) -> { rows, more }. The frame is drawn by ui.js.

const { addDays, parseISO, mondayIndex, daysInMonth, longDate, relativeDays } = require('./dates');
const { dayOrder } = require('./app');
const { datesOf, isDoneOn, cellText } = require('./entry');
const { sty, len, fit, entryColor, glyph, BORDER } = require('./term');
const { dayRows, scrollTop } = require('./ui-day');

const MIN_W_MONTH = 70;
const MIN_H_MONTH = 16;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const GRID = '90';          // thin grid lines inside the calendar
const SELECT_BG = '44';     // blue cursor block, Norton-Commander style

// Column widths. inner = columns between the frame's "║ " and " ║".
function layout(inner) {
  const Rw = Math.max(26, Math.min(44, Math.round((inner + 4) * 0.3)));   // day panel
  const Lw = inner - 3 - Rw;                                              // calendar (3 = " ║ ")
  const cw = Math.floor((Lw - 6) / 7);                                    // one day cell
  return { Rw, Lw, cw };
}

// Segments [{t, sgr}] -> one styled line, padded with blanks to w.
function segLine(segs, w, bg) {
  let used = 0;
  let out = '';
  for (const s of segs) { out += sty(s.t, s.sgr, bg); used += len(s.t); }
  return out + sty(' '.repeat(Math.max(0, w - used)), '37', bg);
}

function bodyMonth(app, inner, B, today) {
  const { Rw, Lw, cw } = layout(inner);
  const cal = app.calDate;
  const { y, m } = parseISO(cal);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const offset = mondayIndex(first);
  const weeks = Math.ceil((offset + daysInMonth(y, m)) / 7);
  const start = addDays(first, -offset);

  const byDate = new Map();
  const lastDay = addDays(start, weeks * 7 - 1);
  for (const e of app.store.entries) {
    // Notes stay out of the grid to keep it clean; they are still listed in the day panel.
    if (e.kind === 'raw' || e.kind === 'note') continue;
    for (const d of datesOf(e)) {   // a deadline task also sits on its work days
      if (d < first || d > lastDay) continue;
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d).push(e);
    }
  }
  for (const [d, list] of byDate) list.sort((a, b) => dayOrder(a, b, d));

  // Cell height: draw rules between weeks only when cells are tall enough to deserve them.
  const avail = B - 1;
  const tallCh = Math.floor((avail + 1) / weeks) - 1;
  const rules = tallCh >= 3;
  const ch = Math.min(7, rules ? tallCh : Math.max(1, Math.floor(avail / weeks)));

  const cellLines = (date) => {
    const inMonth = date.slice(0, 7) === first.slice(0, 7);
    const sel = date === cal;
    const isToday = date === today;
    const bg = sel ? SELECT_BG : '40';
    const ents = inMonth ? byDate.get(date) || [] : [];
    const day = `${parseISO(date).d}${isToday ? '*' : ''}`;
    const numSgr = sel ? '1;97' : isToday ? '1;92' : inMonth ? '37' : '90';
    const color = (e) => (sel && isDoneOn(e, date) ? '37' : entryColor(e, date));
    const lines = [];

    if (ch === 1) {
      // Too short for text: day number + one coloured glyph per entry.
      const segs = [{ t: day, sgr: numSgr }];
      const room = cw - len(day) - 1;
      if (ents.length && room > 0) {
        segs.push({ t: ' ', sgr: '37' });
        const shown = ents.length > room ? room - 1 : ents.length;
        for (let i = 0; i < shown; i++) segs.push({ t: glyph(ents[i], date), sgr: color(ents[i]) });
        if (shown < ents.length) segs.push({ t: '+', sgr: '90' });
      }
      lines.push(segLine(segs, cw, bg));
      return lines;
    }

    lines.push(segLine([{ t: day, sgr: numSgr }], cw, bg));
    const slots = ch - 1;
    const overflow = ents.length > slots;
    const shown = overflow ? slots - 1 : ents.length;
    for (let i = 0; i < shown; i++) {
      const e = ents[i];
      lines.push(segLine([{ t: glyph(e, date) + fit(cellText(e, cw - 1), cw - 1), sgr: color(e) }], cw, bg));
    }
    if (overflow) {
      const more = ents.length - shown;
      lines.push(segLine([{ t: cw >= 9 ? `+${more} more` : `+${more}`, sgr: sel ? '37' : '90' }], cw, bg));
    }
    while (lines.length < ch) lines.push(segLine([], cw, bg));
    return lines;
  };

  const vbar = sty('│', GRID);
  const padR = ' '.repeat(Lw - (cw * 7 + 6));
  const left = [];
  left.push(WEEKDAYS.map((n, i) => sty(fit(n, cw), i >= 5 ? '36' : '1;97')).join(vbar) + padR);
  for (let w = 0; w < weeks; w++) {
    if (rules && w > 0) left.push(sty(Array(7).fill('─'.repeat(cw)).join('┼'), GRID) + padR);
    const cells = Array.from({ length: 7 }, (_, i) => cellLines(addDays(start, w * 7 + i)));
    for (let l = 0; l < ch; l++) left.push(cells.map((c) => c[l]).join(vbar) + padR);
  }
  while (left.length < B) left.push(' '.repeat(Lw));

  // ---- right: the day in full
  const ents = app.dayEntries(cal);
  const sel = app.calFocus === 'day' ? app.dayIdx : -1;
  const rows = [
    { html: sty(fit(longDate(cal), Rw), '1;97') },
    { html: sty(fit(relativeDays(cal, today), Rw), '90') },
    { html: sty('─'.repeat(Rw), GRID) },
    ...dayRows(ents, Rw, sel, cal),
  ];
  const top = scrollTop(rows, sel, app.dayTop, B);
  app.dayTop = top;
  const right = [];
  for (let i = 0; i < B; i++) right.push(rows[top + i] ? rows[top + i].html : ' '.repeat(Rw));

  const divider = sty('║', BORDER);
  const out = [];
  for (let i = 0; i < B; i++) out.push(`${left[i]} ${divider} ${right[i]}`);
  return { rows: out, more: { up: top > 0, down: top + B < rows.length } };
}

module.exports = { bodyMonth, layout, MIN_W_MONTH, MIN_H_MONTH };
