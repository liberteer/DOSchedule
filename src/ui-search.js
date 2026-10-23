'use strict';
// The Find popup: a DOS-style window with a text field, the results below, and the full text of the
// highlighted result at the bottom. Drawn on top of the screen, like the delete-data popup.
// Pure: (app, W, H) -> { lines: [{ row, col, text }], cursor: { row, col }, visible }

const { sty, raw, dialogColors, len, fit, wrap, symbol } = require('./term');
const { longDate } = require('./dates');
const { withTime } = require('./entry');

const BOX_W = 78;
const LABEL = 'Find: ';

function searchLines(app, W, H) {
  const c = dialogColors();
  const s = app.search;
  const w = Math.min(BOX_W, W - 4);
  const inner = w - 2;
  const textW = inner - 2;                       // between the two spaces next to the border
  const h = Math.min(H - 4, 24);
  const P = h >= 20 ? 5 : h >= 16 ? 3 : h >= 13 ? 2 : 0;          // rows for the full text of the highlighted result
  const R = Math.max(1, h - 5 - (P ? 1 + P : 0));                  // result rows
  const row0 = Math.max(1, Math.floor((H - h) / 2));
  const col0 = Math.floor((W - w) / 2) + 1;
  const box = (t) => raw(t, c.box);
  const lines = [];
  const put = (i, text) => lines.push({ row: row0 + i, col: col0, text });
  const side = (content, left = '║', right = '║') => `${box(`${left} `)}${content}${box(` ${right}`)}`;

  // keep the highlighted result in view
  s.page = R;
  if (s.sel < s.top) s.top = s.sel;
  if (s.sel >= s.top + R) s.top = s.sel - R + 1;
  s.top = Math.max(0, Math.min(s.top, Math.max(0, s.results.length - R)));

  // title bar (the "button" colours: neutral, unlike the red warning bar of the delete popup)
  put(0, box('╔═') + raw(' Find ', c.button) + box('═'.repeat(inner - 1 - 6) + '╗'));

  // the field
  const fw = textW - len(LABEL);
  const start = Math.max(0, s.cur - (fw - 1));
  const shown = s.buf.slice(start, start + fw).join('');
  put(1, side(box(LABEL) + raw(fit(shown, fw), c.button)));

  // how many
  let status;
  if (!s.buf.join('').trim()) status = 'Type to find. Case and accents ignored.';   // short enough for the smallest terminal (42 columns of room)
  else if (!s.total) status = 'Nothing found.';
  else if (s.total > s.results.length) status = `${s.total} found, showing the first ${s.results.length}.   Enter opens the highlighted one.`;
  else status = `${s.total} found.   Enter opens the highlighted one.`;
  put(2, side(box(fit(status, textW))));
  put(3, box(`╟${'─'.repeat(inner)}╢`));

  // results: marker, date, text on one row (the full text is below)
  for (let i = 0; i < R; i++) {
    const e = s.results[s.top + i];
    let content;
    if (e) {
      const on = s.top + i === s.sel;
      const row = fit(`${on ? '>' : ' '} ${symbol(e, e.date)} ${longDate(e.date)}  ${withTime(e)}`, textW);
      content = on ? raw(row, c.button) : box(row);
    } else {
      content = box(' '.repeat(textW));
    }
    const more = i === 0 && s.top > 0 ? '▲' : i === R - 1 && s.top + R < s.results.length ? '▼' : '║';
    put(4 + i, side(content, '║', more));
  }

  // the full text of the highlighted result
  let next = 4 + R;
  if (P) {
    put(next++, box(`╟${'─'.repeat(inner)}╢`));
    const e = s.results[s.sel];
    const parts = e ? wrap(withTime(e), textW) : [];
    for (let i = 0; i < P; i++) {
      const last = i === P - 1 && parts.length > P;
      put(next++, side(box(fit(last ? `${parts[i].slice(0, textW - 2)} ...` : parts[i] || '', textW))));
    }
  }
  put(next, box(`╚${'═'.repeat(inner)}╝`));
  const h2 = next + 1;

  // shadow, as on the delete popup
  const shade = (n) => sty('▒'.repeat(n), '90');
  for (let i = 1; i < h2; i++) lines.push({ row: row0 + i, col: col0 + w, text: shade(2) });
  lines.push({ row: row0 + h2, col: col0 + 2, text: shade(w) });

  return { lines, cursor: { row: row0 + 1, col: col0 + 2 + len(LABEL) + (s.cur - start) } };
}

module.exports = { searchLines };
