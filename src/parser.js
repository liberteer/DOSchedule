'use strict';
// Parses one command-line entry:  <symbol><priority?> <text with optional date>
//   x!!! Buy ice cream        -> task, priority 3
//   o See the dentist 14.3.2026 -> event on 2026-03-14
//   - check that website      -> note

const { extractDate } = require('./dates');
const { extractSchedule } = require('./schedule');
const { extractTime } = require('./times');

const KINDS = { x: 'task', o: 'event', '-': 'note' };
const SYMBOLS = { task: 'x', event: 'o', note: '-' };

// -> { ok:true, kind, priority, text, date, work, time, end, explicit } | { ok:false, code, error }
//   time/end = 'HH:MM' start/end of an event, else null. timeIgnored = a task/note whose text
//   contains a time that was left as plain text (only events take times).
//   date = the day it lands on (a task's deadline); work = earlier work days (deadline tasks).
// defaultDate: where an entry lands when the text has no date (today on the main screen,
// the highlighted day on the calendar). Relative words ("tomorrow") always count from today.
function parseInput(line, today, defaultDate = today) {
  const m = /^\s*([xXoO-])(?=[\s!]|$)\s*(!*)\s*(.*)$/.exec(line);
  if (!m) {
    return line.trim()
      ? { ok: false, code: 'symbol', error: 'Start with x (task), o (event) or - (note)' }
      : { ok: false, code: 'blank', error: '' };
  }
  const kind = KINDS[m[1].toLowerCase()];
  const priority = Math.min(m[2].length, 3);
  // > and @ first; a plain date in the text is only looked for when they gave none.
  const sched = extractSchedule(m[3], today);
  if (sched.error) return { ok: false, code: 'date', error: sched.error };
  let { text } = sched;
  let date = sched.deadline;
  // Events may carry a start (and end) time; tasks and notes keep "14:30" as plain text.
  let time = null;
  let end = null;
  if (kind === 'event') {
    const t = extractTime(text);
    if (t.error) return { ok: false, code: 'time', error: t.error };
    ({ text, time, end } = t);
  }
  if (!date) {
    const found = extractDate(text, today);
    if (found.error) return { ok: false, code: 'date', error: found.error };
    ({ text, date } = found);
  }
  if (!text) return { ok: false, code: 'empty', error: 'Nothing written after the symbol' };
  if (kind !== 'task' && sched.work.length) {
    return { ok: false, code: 'date', error: 'Work days (@) only work on tasks (x)' };
  }
  // A task or note that looks like it has a time: it is NOT used, so tell the user (preview + message).
  const timeIgnored = kind !== 'event' && Boolean(extractTime(text).time);
  return {
    ok: true, kind, priority, text, date: date || defaultDate, work: sched.work, time, end, timeIgnored,
    explicit: Boolean(date),
  };
}

module.exports = { parseInput, SYMBOLS };
