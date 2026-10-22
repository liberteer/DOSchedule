'use strict';
// The first-start question: a DOS-style dialog saying where the notes will be saved, with
// [ Use this folder ] and [ Choose a folder... ]. Drawn on top of the main screen, like the other popups.
// Pure: (app, W, H) -> [{ row, col, text }]

const { sty, raw, dialogColors, len, fit, wrap } = require('./term');

const tail = (s, w) => {
  const a = Array.from(s);
  return a.length <= w ? s : `...${a.slice(a.length - (w - 3)).join('')}`;
};

function welcomeLines(app, W, H) {
  const c = dialogColors();
  const w = Math.min(62, W - 6);
  const inner = w - 2;
  const textW = inner - 2;

  // what to say, most important first: the folder is never the part that gets cut
  const intro = wrap('Your notes are saved as plain files in this folder:', textW);
  const where = wrap(tail(app.store.dir, textW * 2 - 6), textW);
  const outro = wrap('Use it, or choose another one (for example inside Dropbox). You can change this any time: F10, Options.', textW);
  const most = Math.max(3, H - 11);                         // rows for text on a short terminal
  let text = [...intro, ...where];
  if (text.length + 1 + outro.length <= most) text = [...text, '', ...outro];
  if (text.length > most) text = text.slice(0, most);

  const h = text.length + 6;                                // border, blank, text, blank, buttons, blank, border
  const row0 = Math.max(1, Math.floor((H - h) / 2));
  const col0 = Math.max(2, Math.floor((W - w) / 2) + 1);
  const box = (t) => raw(t, c.box);
  const lines = [];
  const put = (i, pieces) => lines.push({ row: row0 + i, col: col0, text: pieces.join('') });

  const title = ' Welcome to DOSchedule ';
  const t = len(title) > inner - 2 ? Array.from(title).slice(0, inner - 2).join('') : title;
  const left = Math.floor((inner - len(t)) / 2);
  put(0, [box(`╔${'═'.repeat(left)}`), raw(t, c.button), box(`${'═'.repeat(inner - left - len(t))}╗`)]);
  const side = (content) => [box('║ '), content, box(' ║')];
  put(1, side(box(' '.repeat(textW))));
  const pathStart = intro.length;
  text.forEach((line, i) => {
    const isPath = i >= pathStart && i < pathStart + where.length;
    put(2 + i, side(isPath ? raw(fit(line, textW), c.button) : box(fit(line, textW))));
  });
  put(2 + text.length, side(box(' '.repeat(textW))));

  // [ Use this folder ]   [ Choose a folder... ]   (short labels on a narrow terminal)
  const use = app.welcome.choice === 'use';
  const labels = [['Use this folder', 'Use it'], ['Choose a folder...', 'Choose...']];
  const build = (short) => labels.flatMap(([long, shortLabel], i) => [
    ...(i ? [{ s: short ? ' ' : '   ', on: false }] : []),
    { s: `[ ${short ? shortLabel : long} ]`, on: (i === 0) === use },
  ]);
  const width = (ps) => ps.reduce((n, p) => n + len(p.s), 0);
  let parts = build(false);
  if (width(parts) > inner - 2) parts = build(true);
  const bw = width(parts);
  const padL = Math.max(0, Math.floor((inner - bw) / 2));
  put(3 + text.length, [box(`║${' '.repeat(padL)}`), ...parts.map((p) => (p.on ? raw(p.s, c.button) : box(p.s))), box(`${' '.repeat(Math.max(0, inner - padL - bw))}║`)]);
  put(4 + text.length, side(box(' '.repeat(textW))));
  put(5 + text.length, [box(`╚${'═'.repeat(inner)}╝`)]);

  const shade = (n) => sty('▒'.repeat(n), '90');
  for (let i = 1; i < h; i++) lines.push({ row: row0 + i, col: col0 + w, text: shade(2) });
  lines.push({ row: row0 + h, col: col0 + 2, text: shade(w) });
  return lines;
}

module.exports = { welcomeLines };
