'use strict';
// The notes-folder chooser: a DOS-style, Norton-Commander-like window with the folders of the current
// folder on the left and a look inside the highlighted one on the right, drawn on top of the options screen.
// Pure: (app, W, H) -> { lines: [{ row, col, text }], cursor: { row, col } | null }

const { sty, raw, dialogColors, len, fit, wrap } = require('./term');
const { DRIVES } = require('./chooser');

const BOX_W = 76;

// A long path keeps its END (the part that tells folders apart): "...Documents\Notes".
const tail = (s, w) => {
  const a = Array.from(s);
  return a.length <= w ? s : `...${a.slice(a.length - (w - 3)).join('')}`;
};

const label = (e) => `[${e.name}]`;
const here = (dir) => (dir === DRIVES ? 'This computer (drives)' : dir);
const files = (n) => `${n} month ${n === 1 ? 'file' : 'files'}`;

function chooserLines(app, W, H) {
  const c = dialogColors();
  const ch = app.chooser;
  const w = Math.min(BOX_W, W - 4);
  const inner = w - 2;
  const two = w >= 62;                                  // two panels; a narrow terminal gets the list alone
  const h = Math.max(10, Math.min(H - 4, 20));
  const R = h - 7;                                      // list rows
  const row0 = Math.max(1, Math.floor((H - h) / 2));
  const col0 = Math.floor((W - w) / 2) + 1;
  const box = (t) => raw(t, c.box);
  const lines = [];
  const put = (i, text) => lines.push({ row: row0 + i, col: col0, text });

  const cw = two ? Math.ceil((w - 7) / 2) : w - 4;      // left cell width
  const rw = two ? Math.floor((w - 7) / 2) : 0;         // right cell width
  const rule = (mid) => box(`╟${'─'.repeat(two ? cw + 2 : inner)}${two ? `${mid}${'─'.repeat(rw + 2)}` : ''}╢`);

  // keep the highlighted folder in view
  ch.page = R;
  if (ch.sel < ch.top) ch.top = ch.sel;
  if (ch.sel >= ch.top + R) ch.top = ch.sel - R + 1;
  ch.top = Math.max(0, Math.min(ch.top, Math.max(0, ch.list.entries.length - R)));

  // title bar (neutral "button" colours)
  put(0, box('╔═') + raw(' Choose notes folder ', c.button) + box(`${'═'.repeat(inner - 1 - 21)}╗`));

  // the folder you are in, or the field being typed into
  const fieldW = inner - 2;
  let cursor = null;
  let head;
  if (ch.step === 'path' || ch.step === 'new') {
    const prompt = ch.step === 'path' ? 'Path: ' : 'New folder: ';
    const fw = fieldW - len(prompt);
    const start = Math.max(0, ch.cur - (fw - 1));
    head = box(prompt) + raw(fit(ch.buf.slice(start, start + fw).join(''), fw), c.button);
    cursor = { row: row0 + 1, col: col0 + 2 + len(prompt) + (ch.cur - start) };
  } else {
    const prompt = 'Folder: ';
    head = box(prompt) + raw(fit(tail(here(ch.dir), fieldW - len(prompt)), fieldW - len(prompt)), c.button);
  }
  put(1, `${box('║ ')}${head}${box(' ║')}`);
  put(2, rule('┬'));

  // the right panel: a look inside the highlighted folder
  const right = [];
  if (two) {
    const e = ch.list.entries[ch.sel];
    const p = ch.preview;
    if (e && e.kind === 'up') {
      right.push('Up one level to:', `  ${tail(here(e.path), rw - 2)}`);
    } else if (e && p) {
      right.push(`Inside ${label(e)}:`);
      const subs = p.list.entries.filter((x) => x.kind !== 'up');
      if (p.list.error) right.push(`  ${p.list.error}`);
      else if (!subs.length) right.push('  (no folders)');
      const room = R - 3;
      subs.slice(0, room).forEach((x) => right.push(`  ${label(x)}`));
      if (subs.length > room) right.push(`  ... ${subs.length - room} more`);
      while (right.length < R - 1) right.push('');
      if (e.kind === 'dir' && p.notes.files > 0) right.push(`Notes here: ${files(p.notes.files)}`);
    }
  }

  // list rows
  for (let i = 0; i < R; i++) {
    const e = ch.list.entries[ch.top + i];
    const on = e && ch.top + i === ch.sel && ch.step === 'browse';
    const txt = e ? fit(label(e), cw) : fit(ch.list.error && i === 1 ? ch.list.error : '', cw);
    const left = on ? raw(txt, c.button) : box(txt);
    const more = i === 0 && ch.top > 0 ? '▲' : i === R - 1 && ch.top + R < ch.list.entries.length ? '▼' : '║';
    const middle = two ? `${box(' │ ')}${box(fit(right[i] || '', rw))}` : '';
    put(3 + i, `${box('║ ')}${left}${middle}${box(` ${more}`)}`);
  }

  // what is in the folder you are in, and what to do next
  put(3 + R, rule('┴'));
  let info1;
  if (ch.dir === DRIVES) info1 = 'Choose a drive (or type its letter), then Enter.';
  else if (ch.list.error) info1 = ch.list.error;
  else if (ch.notes && ch.notes.files > 0) info1 = `Notes found in this folder: ${files(ch.notes.files)}${ch.notes.settings ? ', with settings' : ''}.`;
  else info1 = 'No notes in this folder yet.';
  let info2 = ch.note;
  if (!info2) {
    if (ch.step === 'path') info2 = 'Type a folder path and press Enter (a new last folder is created).';
    else if (ch.step === 'new') info2 = 'Type a name and press Enter: the folder is created inside the one above.';
    else info2 = ch.dir === DRIVES ? '' : 'Space = use the folder shown above    N = new folder    T = type a path';
  }
  put(4 + R, `${box('║ ')}${box(fit(info1, fieldW))}${box(' ║')}`);
  put(5 + R, `${box('║ ')}${box(fit(info2, fieldW))}${box(' ║')}`);
  put(6 + R, box(`╚${'═'.repeat(inner)}╝`));
  const total = 7 + R;

  const shade = (n) => sty('▒'.repeat(n), '90');
  for (let i = 1; i < total; i++) lines.push({ row: row0 + i, col: col0 + w, text: shade(2) });
  lines.push({ row: row0 + total, col: col0 + 2, text: shade(w) });

  if (ch.step === 'confirm') lines.push(...confirmLines(app, W, H, c));
  return { lines, cursor: ch.step === 'confirm' ? null : cursor };
}

// The question that follows "use this folder": a small dialog on top of the chooser.
function confirmLines(app, W, H, c) {
  const { confirm: q } = app.chooser;
  const here = app.store.dir;
  const w = Math.min(62, W - 6);
  const inner = w - 2;
  const dir = tail(q.dir, w - 6);                  // long paths keep their end (the box is as wide as the terminal allows)
  const old = tail(here, w - 6);
  let body;
  if (q.kind === 'found') {
    body = `Use the notes found in ${dir}? They are used from now on. Your current notes stay in ${old}, unchanged.`;
  } else if (q.kind === 'copy') {
    body = `Use ${dir} for your notes? Your ${files(q.mine.files)} can be copied there. Nothing is deleted from ${old}.`;
  } else {
    body = `Use ${dir} for your notes?`;
  }
  let text = wrap(body, w - 4);
  const most = Math.max(2, H - 10);                // never taller than a short terminal
  if (text.length > most) text = [...text.slice(0, most - 1), `${text[most - 1].slice(0, w - 8)} ...`];
  const h = text.length + 6;
  const row0 = Math.max(1, Math.floor((H - h) / 2));
  const col0 = Math.max(2, Math.floor((W - w) / 2) + 1);
  const box = (t) => raw(t, c.box);
  const out = [];
  const put = (i, pieces) => out.push({ row: row0 + i, col: col0, text: pieces.join('') });
  const title = ' Notes folder ';
  const left = Math.floor((inner - len(title)) / 2);
  put(0, [box(`╔${'═'.repeat(left)}`), raw(title, c.button), box(`${'═'.repeat(inner - left - len(title))}╗`)]);
  const side = (content) => [box('║ '), content, box(' ║')];
  put(1, side(box(' '.repeat(inner - 2))));
  text.forEach((l, i) => put(2 + i, side(box(fit(l, inner - 2)))));
  put(2 + text.length, side(box(' '.repeat(inner - 2))));
  // long labels if they fit, else the short ones ([ Copy ] [ Empty ] [ Cancel ])
  const build = (short) => {
    const out = [];
    q.buttons.forEach((b, i) => {
      if (i) out.push({ s: short ? ' ' : '   ', on: false });
      out.push({ s: `[ ${short ? (b[2] || b[1]) : b[1]} ]`, on: i === q.choice });
    });
    return out;
  };
  const width = (ps) => ps.reduce((n, p) => n + len(p.s), 0);
  let parts = build(false);
  if (width(parts) > inner - 2) parts = build(true);
  const bw = width(parts);
  const padL = Math.max(0, Math.floor((inner - bw) / 2));
  put(3 + text.length, [box(`║${' '.repeat(padL)}`), ...parts.map((p) => (p.on ? raw(p.s, c.button) : box(p.s))), box(`${' '.repeat(Math.max(0, inner - padL - bw))}║`)]);
  put(4 + text.length, side(box(' '.repeat(inner - 2))));
  put(5 + text.length, [box(`╚${'═'.repeat(inner)}╝`)]);
  const shade = (n) => sty('▒'.repeat(n), '90');
  for (let i = 1; i < h; i++) out.push({ row: row0 + i, col: col0 + w, text: shade(2) });
  out.push({ row: row0 + h, col: col0 + 2, text: shade(w) });
  return out;
}

module.exports = { chooserLines };
