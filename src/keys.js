'use strict';
// Turns raw terminal input (a string) into key objects: { name, ch? }.
// Handles xterm / VT sequences (also what Windows Terminal and libuv produce).

const CSI_FINAL = { A: 'up', B: 'down', C: 'right', D: 'left', H: 'home', F: 'end', P: 'f1', Q: 'f2', Z: 'shift-tab' };
const TILDE = { 1: 'home', 3: 'delete', 4: 'end', 5: 'pageup', 6: 'pagedown', 7: 'home', 8: 'end', 11: 'f1', 12: 'f2', 18: 'f7', 21: 'f10' };
const CONSOLE_FN = { A: 'f1', B: 'f2' };  // ESC [ [ A
const CTRL = { 3: 'ctrl-c', 4: 'ctrl-d', 5: 'ctrl-e', 6: 'ctrl-f', 15: 'ctrl-o', 17: 'ctrl-q', 20: 'ctrl-t', 21: 'ctrl-u', 23: 'ctrl-w' };

// Pasted text must never press Enter (that would save each line, and an empty line would tick the selected
// entry) or Tab. Two ways to tell it from typing:
//  * terminals that support it mark a paste with ESC[200~ ... ESC[201~ (switched on in doschedule.js);
//  * otherwise: a line break or tab with more text after it in the same piece of input. Nobody types Enter
//    and the next letters within the same moment, so that is a paste too.
// Either way line breaks and tabs become spaces. A line break at the very end of an unmarked paste stays Enter.
const PASTE_START = '\x1b[200~';
const PASTE_END = '\x1b[201~';

function pastedKeys(text) {
  const keys = [];
  for (const ch of text.replace(/\r\n|[\r\n\t]/g, ' ')) {
    const cp = ch.codePointAt(0);
    if (cp >= 32 && cp !== 127) keys.push({ name: 'char', ch });
  }
  return keys;
}

// `state` (one object kept by the caller) remembers an unfinished marked paste between pieces of input.
function parseKeys(s, state = {}) {
  const keys = [];
  let rest = (state.carry || '') + s;
  state.carry = '';
  while (rest) {
    if (state.paste) {
      const end = rest.indexOf(PASTE_END);
      if (end < 0) {                             // the paste goes on in the next piece; keep a half end mark
        let keep = 0;
        for (let n = Math.min(PASTE_END.length - 1, rest.length); n > 0; n--) if (PASTE_END.startsWith(rest.slice(-n))) { keep = n; break; }
        keys.push(...pastedKeys(rest.slice(0, rest.length - keep)));
        state.carry = rest.slice(rest.length - keep);
        return keys;
      }
      keys.push(...pastedKeys(rest.slice(0, end)));
      rest = rest.slice(end + PASTE_END.length);
      state.paste = false;
      continue;
    }
    const start = rest.indexOf(PASTE_START);
    keys.push(...typedKeys(start < 0 ? rest : rest.slice(0, start)));
    if (start < 0) break;
    state.paste = true;
    rest = rest.slice(start + PASTE_START.length);
  }
  return keys;
}

function typedKeys(s) {
  const keys = [];
  // A line break or tab followed by text (not only by keys such as arrows) in this same piece: pasted.
  const text = s.replace(/\x1b(?:\[\[[A-E]|\[[0-9;]*[@-~]|O[A-Za-z]|.)?/g, '');
  if (/[\r\n\t][^]*[^\x00-\x1f\x7f]/.test(text)) {
    const end = s.search(/[\r\n]+$/);                          // a final line break stays Enter
    const body = end >= 0 ? s.slice(0, end) : s;
    const keys2 = typedKeys(body.replace(/\r\n|[\r\n\t]/g, ' '));
    if (end >= 0) keys2.push({ name: 'enter' });
    return keys2;
  }
  let i = 0;
  let prevCR = false;
  while (i < s.length) {
    const c = s[i];
    if (c === '\x1b') {
      if (i + 1 >= s.length) { keys.push({ name: 'escape' }); i++; continue; }
      const rest = s.slice(i);
      let m = /^\x1b\[\[([A-E])/.exec(rest);
      if (m) { if (CONSOLE_FN[m[1]]) keys.push({ name: CONSOLE_FN[m[1]] }); i += m[0].length; continue; }
      m = /^\x1b\[([0-9;]*)([@-~])/.exec(rest);
      if (m) {
        const name = m[2] === '~' ? TILDE[m[1].split(';')[0]] : CSI_FINAL[m[2]];
        if (name) keys.push({ name });
        i += m[0].length; continue;
      }
      m = /^\x1bO([A-Za-z])/.exec(rest);
      if (m) { if (CSI_FINAL[m[1]]) keys.push({ name: CSI_FINAL[m[1]] }); i += m[0].length; continue; }
      i += 2; continue; // Alt+key or unknown: ignore
    }
    const cp = s.codePointAt(i);
    const ch = String.fromCodePoint(cp);
    i += ch.length;
    if (cp === 13) { keys.push({ name: 'enter' }); prevCR = true; continue; }
    if (cp === 10) { if (!prevCR) keys.push({ name: 'enter' }); prevCR = false; continue; }
    prevCR = false;
    if (cp === 9) keys.push({ name: 'tab' });
    else if (cp === 8 || cp === 127) keys.push({ name: 'backspace' });
    else if (cp < 32) { if (CTRL[cp]) keys.push({ name: CTRL[cp] }); }
    else keys.push({ name: 'char', ch });
  }
  return keys;
}

module.exports = { parseKeys };
