'use strict';
// Options screen body: one line per setting, a description of the highlighted choice, and a
// sample of the entries as they look in the current colour scheme.
// Pure: (app, inner width, body height) -> { rows, more }. The frame is drawn by ui.js.

const { sty, fit, entryColor, symbol } = require('./term');
const { OPTIONS, ACTIONS, current } = require('./settings');

const GRID = '90';
const LABEL_W = 26;

// Fake entries, just to show how priorities, done items and event/note markers are coloured.
// `spare` ones are the first to go when the terminal is too short for all of them.
const SAMPLE = [
  { kind: 'task', priority: 3, done: false, text: 'High priority task' },
  { kind: 'task', priority: 2, done: false, text: 'Medium priority task' },
  { kind: 'task', priority: 1, done: false, text: 'Low priority task', spare: 2 },
  { kind: 'task', priority: 0, done: false, text: 'Task without priority', spare: 1 },
  { kind: 'task', priority: 0, done: true, text: 'Finished task' },
  { kind: 'event', priority: 0, done: false, text: '14:30 Event' },
  { kind: 'event', priority: 0, done: true, text: 'Event that has passed' },
  { kind: 'note', priority: 0, done: false, text: 'Note' },
];

function bodyOptions(app, inner, B) {
  const rows = [];
  const blank = ' '.repeat(inner);
  // Where the notes are saved heads the screen (the window title already says "Options"): always in view.
  rows.push(sty(fit(`  ${notesFolderLine(app.store.dir, inner - 2)}`, inner), '1;97'));
  rows.push(sty('─'.repeat(inner), GRID));

  OPTIONS.forEach((option, i) => {
    const selected = i === app.optIdx;
    const choice = current(app.settings, option);
    const value = `< ${choice.label}${choice.note || ''} >`;
    const line = `${selected ? '> ' : '  '}${fit(option.label, LABEL_W)}${value}`;
    rows.push(sty(fit(line, inner), selected ? '7;1;97' : '37'));
  });

  // actions: rows that do something instead of choosing a value (listed after a gap)
  rows.push(blank);
  ACTIONS.forEach((action, i) => {
    const selected = OPTIONS.length + i === app.optIdx;
    const [on, off] = action.danger ? ['7;1;91', '1;91'] : ['7;1;97', '1;97'];   // only the dangerous one is red
    rows.push(sty(fit(`${selected ? '> ' : '  '}${action.label}`, inner), selected ? on : off));
  });

  rows.push(blank);   // (the description of the highlighted row is on the status line at the bottom)

  rows.push(sty(`── SAMPLE ${'─'.repeat(Math.max(0, inner - 10))}`, '1;97'));
  // On a short terminal drop the least telling sample rows (spare 1, then 2) rather than cutting the end off.
  const room = B - rows.length;
  let sample = SAMPLE;
  for (const level of [1, 2]) {
    if (sample.length > room) sample = sample.filter((e) => e.spare !== level);
  }
  for (const e of sample) {
    const text = `  ${symbol(e)} ${'!'.repeat(e.priority).padEnd(3)} ${e.text}`;
    rows.push(sty(fit(text, inner), entryColor(e)));
  }

  while (rows.length < B) rows.push(blank);
  return { rows: rows.slice(0, B), more: {} };
}

// "Your notes are saved in <folder>". A long folder keeps its end (the part that tells folders apart):
// the start is replaced by "...".
function notesFolderLine(dir, w) {
  const head = 'Your notes are saved in: ';
  const room = Math.max(8, w - head.length);
  const chars = Array.from(dir);
  const shown = chars.length > room ? `...${chars.slice(chars.length - (room - 3)).join('')}` : dir;
  return head + shown;
}

// One-line explanation of the highlighted row (also shown on the status line).
function describeRow(app) {
  if (app.optIdx >= OPTIONS.length) {
    const key = ACTIONS[app.optIdx - OPTIONS.length].key;
    if (key === 'chooseFolder') return 'Pick the folder where your notes are saved, with a folder browser. Your notes can be copied there; the old ones are never deleted.';
    if (key === 'autoFolder') {
      return app.location && app.location.hasPointer
        ? 'Forget the folder you chose and use the automatic one again (a "data" folder next to the program, else your user folder). No notes are touched.'
        : 'Nothing is chosen in the app, so the notes folder is automatic already.';
    }
    const { entries, files } = app.store.stats();
    return `Permanently deletes every task, event and note (${entries} ${entries === 1 ? 'entry' : 'entries'} in ${files} ${files === 1 ? 'file' : 'files'}). You are asked twice. Settings are kept.`;
  }
  return current(app.settings, OPTIONS[app.optIdx]).desc || '';
}

module.exports = { bodyOptions, describeRow, notesFolderLine };
