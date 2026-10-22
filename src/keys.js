'use strict';
// Turns raw terminal input (a string) into key objects: { name, ch? }.
// Handles xterm / VT sequences (also what Windows Terminal and libuv produce).

const CSI_FINAL = { A: 'up', B: 'down', C: 'right', D: 'left', H: 'home', F: 'end', P: 'f1', Q: 'f2', Z: 'shift-tab' };
const TILDE = { 1: 'home', 3: 'delete', 4: 'end', 5: 'pageup', 6: 'pagedown', 7: 'home', 8: 'end', 11: 'f1', 12: 'f2', 18: 'f7', 21: 'f10' };
const CONSOLE_FN = { A: 'f1', B: 'f2' };  // ESC [ [ A
const CTRL = { 3: 'ctrl-c', 4: 'ctrl-d', 5: 'ctrl-e', 6: 'ctrl-f', 15: 'ctrl-o', 17: 'ctrl-q', 20: 'ctrl-t', 21: 'ctrl-u', 23: 'ctrl-w' };

function parseKeys(s) {
  const keys = [];
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
