'use strict';
// Helpers for "deadline tasks": a task with a deadline (`date`) and work days (`work`, all
// earlier than the deadline). Each work day is its own session that can be ticked off
// (`workDone`, a subset of `work`); `done` means the whole task is finished.
// Plain tasks, events and notes have `work` / `workDone` empty or missing.

const isDeadlineTask = (e) => e.kind === 'task' && Array.isArray(e.work) && e.work.length > 0;

// Does the entry show up on this calendar day? (its own date, or one of its work days)
const appearsOn = (e, date) => e.date === date || (isDeadlineTask(e) && e.work.includes(date));

// Every day the entry occupies: work days, then the deadline.
const datesOf = (e) => (isDeadlineTask(e) ? [...e.work, e.date] : [e.date]);

// Is the entry ticked off as seen on `date`? A finished task is ticked everywhere; a deadline
// task also shows a finished work session as ticked on that one day.
const isDoneOn = (e, date) => Boolean(e.done)
  || (isDeadlineTask(e) && Array.isArray(e.workDone) && e.workDone.includes(date));

// Enter on an entry as seen on `date`. Mutates the entry and says what happened:
//   'task-done' | 'task-open'        plain tasks / events, or a whole deadline task
//   'session-done' | 'session-open'  one work day of a deadline task
//   'all-done'                       the last open work session was ticked: task complete
// Deadline task rules: a finished task reopens (with that day's session); a work day toggles
// just its own session; any other day (the deadline, or overdue) finishes the whole task.
function tick(e, date) {
  if (!isDeadlineTask(e)) {
    e.done = !e.done;
    return e.done ? 'task-done' : 'task-open';
  }
  const sessions = e.workDone || (e.workDone = []);
  const at = sessions.indexOf(date);
  if (e.done) {
    e.done = false;
    if (at >= 0) sessions.splice(at, 1);
    return 'task-open';
  }
  if (e.work.includes(date)) {
    if (at >= 0) { sessions.splice(at, 1); return 'session-open'; }
    sessions.push(date);
    sessions.sort();
    if (e.work.every((d) => sessions.includes(d))) { e.done = true; return 'all-done'; }
    return 'session-done';
  }
  e.done = true;
  return 'task-done';
}

// ---- event times (e.time / e.end are 'HH:MM' or null; only events have them) ----------------
const timeLabel = (e) => (e.time ? `${e.time}${e.end ? `-${e.end}` : ''}` : '');

// The text as shown in lists and panels, with the time in front for timed events.
const withTime = (e) => (e.time ? `${timeLabel(e)} ${e.text}` : e.text);

// The text as shown in a narrow calendar cell of text width w: the time is only worth its 6
// columns when the title keeps at least 8 of them; otherwise cells just sort by time.
const cellText = (e, w) => (e.time && w - 6 >= 8 ? `${e.time} ${e.text}` : e.text);

module.exports = {
  isDeadlineTask, appearsOn, datesOf, isDoneOn, tick, timeLabel, withTime, cellText,
};
