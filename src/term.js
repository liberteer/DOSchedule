'use strict';
// Drawing primitives shared by all screens: colours, padding, wrapping, entry glyphs.

const { isDoneOn } = require('./entry');
const { screenText } = require('./emoji');

const { THEMES } = require('./themes');

const ESC = '\x1b[';
const BORDER = '36';

// The colour scheme in use. Screens are written in the classic palette and recoloured here
// (see themes.js); render() picks the scheme from the user's settings before drawing.
let theme = THEMES.classic;
function setTheme(name) { theme = THEMES[name] || THEMES.classic; }

// Escape sequence for "plain text on the page": whatever follows an unstyled run is drawn with it.
const reset = () => `${ESC}0;${theme.base};${theme.bg}m`;

// Text from the notes files may hold control characters (a tab, or an escape sequence that a terminal
// would obey: clear the screen, change the title, even set the clipboard). Every visible text goes through
// sty() or raw(), and they draw each such character as one space, so the terminal only ever gets plain text
// from your notes and columns stay in line. The files themselves are not changed.
const CONTROL = /[\x00-\x1f\x7f-\x9f]/;
const CONTROLS = /[\x00-\x1f\x7f-\x9f]/g;
// Colour emoji become one "?" (see emoji.js). fit() and wrap() do that BEFORE measuring, because one "?" may
// stand for several characters; here it is only a last safety net.
const plainText = (text) => {
  const t = screenText(text);
  return CONTROL.test(t) ? t.replace(CONTROLS, ' ') : t;
};

// Style a run of text. sgr = foreground/attributes in classic codes; bg = '40' (the page) or
// '44' (the highlighted-day block), also in classic codes.
function sty(text, sgr, bg = '40') {
  text = plainText(text);
  let fg = sgr.split(';').map((t) => (t in theme.fg ? theme.fg[t] : t)).filter((t) => t !== '').join(';');
  if (!fg) fg = theme.base;
  let back = theme.bg;
  if (bg === '44') {
    if (theme.cursor.reverse) fg = `7;${fg}`;
    else back = theme.cursor.bg;
  }
  return `${ESC}0;${fg};${back}m${text}${reset()}`;
}

// Text in exact DOS colours (no recolouring): used by popups, whose palette comes from the theme.
const raw = (text, [fg, bg]) => `${ESC}0;${fg};${bg}m${plainText(text)}${reset()}`;
const dialogColors = () => theme.dialog;

// "Plain ASCII" frame style: every special drawing character is replaced by ONE keyboard character, so
// nothing shifts. Applied to the finished frame, which is safe because escape sequences are pure ASCII.
// (It also affects the same characters if you type them into an entry; the file itself is never changed.)
const ASCII_MAP = {
  '╔': '+', '╗': '+', '╚': '+', '╝': '+', '╠': '+', '╣': '+', '╦': '+', '╩': '+', '╫': '+', '┼': '+', '╟': '+', '╢': '+', '┬': '+', '┴': '+',
  '═': '=', '║': '|', '│': '|', '─': '-',
  '◄': '<', '►': '>', '▲': '^', '▼': 'v', '↑': '^', '↓': 'v', '←': '<', '→': '>',
  '•': '*', '■': '#', 'ø': '0', '»': '~', '▒': ':',
};
const toAscii = (text) => Array.from(text, (c) => ASCII_MAP[c] || c).join('');

const len = (s) => Array.from(s).length;

// Truncate with a » (an original DOS character), or pad with spaces, to exactly w columns.
function fit(s, w) {
  if (w <= 0) return '';
  s = screenText(s);
  const a = Array.from(s);
  if (a.length > w) return `${a.slice(0, w - 1).join('')}»`;
  return s + ' '.repeat(w - a.length);
}

// Word-wrap to lines of at most w columns (very long words are split).
// The first line may be narrower (first), e.g. when something else shares that row; the others use w.
function wrap(text, w, first = w) {
  const lines = [];
  let cur = '';
  const limit = () => Math.max(1, lines.length === 0 ? first : w);
  for (let word of screenText(text).split(/\s+/).filter(Boolean)) {
    while (len(word) > limit()) {
      if (cur) { lines.push(cur); cur = ''; }
      const n = limit();
      lines.push(Array.from(word).slice(0, n).join(''));
      word = Array.from(word).slice(n).join('');
    }
    if (!cur) cur = word;
    else if (len(cur) + 1 + len(word) <= limit()) cur += ` ${word}`;
    else { lines.push(cur); cur = word; }
  }
  if (cur || !lines.length) lines.push(cur);
  return lines;
}

// `date` = the day being drawn (a finished work session greys out only its own day).
function entryColor(e, date) {
  if (isDoneOn(e, date)) return '90';
  return e.priority === 3 ? '1;91' : e.priority === 2 ? '1;93' : e.priority === 1 ? '92' : '37';
}

// 3-column marker used in lists.
function symbol(e, date) {
  const done = isDoneOn(e, date);
  if (e.kind === 'task') return done ? '[x]' : '[ ]';
  if (e.kind === 'event') return done ? ' ø ' : ' o ';
  return ' - ';
}

// 1-column marker used inside calendar cells (bullet-journal style). `date` is the day being
// drawn: a deadline task shows ■ on its deadline day and • on its work days.
function glyph(e, date) {
  const done = isDoneOn(e, date);
  if (e.kind === 'task') return done ? 'x' : (e.work && e.work.length && e.date === date ? '■' : '•');
  if (e.kind === 'event') return done ? 'ø' : 'o';
  return '-';
}

module.exports = { ESC, BORDER, sty, raw, dialogColors, reset, setTheme, toAscii, len, fit, wrap, entryColor, symbol, glyph };
