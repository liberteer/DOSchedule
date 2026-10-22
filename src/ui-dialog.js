'use strict';
// The "Delete all data" popup: a DOS-style dialog box with a shadow, drawn on top of the screen.
// Pure: (app, W, H) -> [{ row, col, text }] absolute-positioned, styled lines (1-based).

const { sty, raw, dialogColors, len, fit, wrap } = require('./term');

const BOX_W = 54;

function dialogText(app) {
  const { entries, files } = app.store.stats();
  const have = `${entries} ${entries === 1 ? 'entry' : 'entries'} in ${files} ${files === 1 ? 'file' : 'files'}`;
  if (app.dialog.step === 1) {
    return {
      title: ' Delete all data ',
      body: `This will permanently delete ALL your tasks, events and notes (${have}). Your settings are kept.`,
    };
  }
  return {
    title: ' Are you absolutely sure? ',
    body: 'LAST CHANCE: everything will be deleted now and this cannot be undone.',
  };
}

function dialogLines(app, W, H) {
  const c = dialogColors();
  const { title, body } = dialogText(app);
  const w = Math.min(BOX_W, W - 6);
  const inner = w - 2;                       // between the two border characters
  const text = wrap(body, w - 4);
  const h = text.length + 6;                 // border, blank, text, blank, buttons, blank, border
  const row0 = Math.max(1, Math.floor((H - h) / 2));
  const col0 = Math.max(2, Math.floor((W - w) / 2) + 1);
  const box = (s) => raw(s, c.box);

  const lines = [];
  const put = (i, pieces) => lines.push({ row: row0 + i, col: col0, text: pieces.join('') });

  // top border, with the title on a coloured bar
  const t = len(title) > inner - 2 ? Array.from(title).slice(0, inner - 2).join('') : title;
  const left = Math.floor((inner - len(t)) / 2);
  put(0, [box('╔' + '═'.repeat(left)), raw(t, c.title), box('═'.repeat(inner - left - len(t)) + '╗')]);

  const side = (content) => [box('║ '), content, box(' ║')];
  put(1, side(box(' '.repeat(inner - 2))));
  text.forEach((line, i) => put(2 + i, side(box(fit(line, inner - 2)))));
  put(2 + text.length, side(box(' '.repeat(inner - 2))));

  // [ Yes ]   [ No ]  with the chosen one highlighted
  const yes = app.dialog.choice === 'yes';
  const button = (label, on) => (on ? raw(label, c.button) : box(label));
  const buttons = [button('[ Yes ]', yes), box('      '), button('[ No ]', !yes)];
  const bw = 7 + 6 + 6;
  const padL = Math.floor((inner - bw) / 2);
  put(3 + text.length, [box('║' + ' '.repeat(padL)), ...buttons, box(' '.repeat(inner - padL - bw) + '║')]);

  put(4 + text.length, side(box(' '.repeat(inner - 2))));
  put(5 + text.length, [box('╚' + '═'.repeat(inner) + '╝')]);

  // shadow: two columns to the right and one row below, shifted by one, as in DOS dialogs
  const shade = (n) => sty('▒'.repeat(n), '90');
  for (let i = 1; i < h; i++) lines.push({ row: row0 + i, col: col0 + w, text: shade(2) });
  lines.push({ row: row0 + h, col: col0 + 2, text: shade(w) });
  return lines;
}

module.exports = { dialogLines };
