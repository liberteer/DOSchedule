'use strict';
// Markdown storage: <dir>/<YYYY>/<YYYY-MM>.md, one "## YYYY-MM-DD Weekday" section per day.
//
//   # 2026-03
//
//   ## 2026-03-14 Saturday
//   - [ ] !!! Buy ice cream      task (open)      [x] = done
//   - [o] ! See the dentist      event           [ø] = event has passed / attended
//   - [-] Check that website     note
//
// Lines the app doesn't understand are kept as 'raw' entries so hand edits are never lost.

const fs = require('fs');
const path = require('path');
const { fullWeekday } = require('./dates');
const { tick } = require('./entry');

const FILE_RE = /^(\d{4}-\d{2})\.md$/;
const YEAR_DIR_RE = /^\d{4}$/;
const TITLE_RE = /^#\s+\d{4}-\d{2}\s*$/;
const SECTION_RE = /^##\s+(\d{4}-\d{2}-\d{2})\b/;
// Deadline tasks end with their work days:  - [ ] Write report (work 2026-10-14, 2026-10-15)
// Finished work sessions are listed after a semicolon:  (work 2026-10-14, 2026-10-15; done 2026-10-14)
const DATES = String.raw`\d{4}-\d{2}-\d{2}(?:,\s*\d{4}-\d{2}-\d{2})*`;
const WORK_RE = new RegExp(String.raw`\s+\(work\s+(${DATES})(?:;\s*done\s+(${DATES}))?\)\s*$`);
// An event's start (and end) time is written in front of its text:  - [o] !! 14:30-15:30 Dentist
const TIME_RE = /^(\d{1,2}:\d{2})(?:-(\d{1,2}:\d{2}))?(?:\s+|$)/;
const pad2time = (t) => t.padStart(5, '0');
const timePrefix = (e) => (e.kind === 'event' && e.time ? `${e.time}${e.end ? `-${e.end}` : ''} ` : '');
const workSuffix = (e) => (e.work && e.work.length
  ? ` (work ${e.work.join(', ')}${e.workDone && e.workDone.length ? `; done ${e.workDone.join(', ')}` : ''})`
  : '');
const ENTRY_RE = /^[-*]\s+\[( |x|X|o|O|ø|-)\]\s*(?:(!{1,3})(?:\s+|$))?(.*)$/;

const monthOf = (date) => date.slice(0, 7);
const markOf = (e) => (e.kind === 'task' ? (e.done ? 'x' : ' ') : e.kind === 'event' ? (e.done ? 'ø' : 'o') : '-');

// Every month file (YYYY-MM.md) in a data folder: in year folders, or loose in the folder itself.
function monthFilesIn(dir) {
  const files = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory() && YEAR_DIR_RE.test(ent.name)) {
      for (const f of fs.readdirSync(path.join(dir, ent.name))) {
        if (FILE_RE.test(f)) files.push(path.join(dir, ent.name, f));
      }
    } else if (ent.isFile() && FILE_RE.test(ent.name)) {
      files.push(path.join(dir, ent.name));
    }
  }
  return files.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
}

class Store {
  constructor(dir) {
    this.dir = dir;
    this.entries = [];          // in file order; includes {kind:'raw'} placeholders
    this.preamble = new Map();  // monthKey -> unparsed lines found before the first day section
    this.paths = new Map();     // monthKey -> file the month was loaded from
    this.nextId = 1;
  }

  // Every month file (YYYY-MM.md) on disk: in year folders, or loose in the data folder.
  _monthFiles() { return monthFilesIn(this.dir); }

  // Read everything again from disk (e.g. after a failed delete).
  reload() {
    this.entries = [];
    this.preamble = new Map();
    this.paths = new Map();
    this.load();
  }

  // How much there is: real entries and month files.
  stats() {
    return { entries: this.entries.filter((e) => e.kind !== 'raw').length, files: this._monthFiles().length };
  }

  // Delete ALL data: every month file and the empty year folders, nothing else (settings.json and
  // any other file in the folder are untouched). Throws if a file cannot be removed.
  deleteAll() {
    const entries = this.entries.filter((e) => e.kind !== 'raw').length;
    let files = 0;
    for (const file of this._monthFiles()) {
      fs.unlinkSync(file);
      files++;
    }
    for (const ent of fs.readdirSync(this.dir, { withFileTypes: true })) {
      if (ent.isDirectory() && YEAR_DIR_RE.test(ent.name)) {
        try { fs.rmdirSync(path.join(this.dir, ent.name)); } catch { /* not empty: leave it */ }
      }
    }
    this.entries = [];
    this.preamble = new Map();
    this.paths = new Map();
    return { entries, files };
  }

  load() {
    fs.mkdirSync(this.dir, { recursive: true });
    const files = this._monthFiles();
    for (const file of files) {
      const key = path.basename(file).slice(0, 7);
      this.paths.set(key, file);
      this._parse(fs.readFileSync(file, 'utf8'), key);
    }
    // Entries hand-moved into the "wrong" month file: re-home them right away.
    const touched = new Set();
    for (const e of this.entries) {
      if (monthOf(e.date) !== e.loadedFrom) { touched.add(e.loadedFrom); touched.add(monthOf(e.date)); }
    }
    if (touched.size) this._save([...touched]);
  }

  _parse(text, key) {
    let date = null;
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim() || TITLE_RE.test(line)) continue;
      let m = SECTION_RE.exec(line);
      if (m) { date = m[1]; continue; }
      m = ENTRY_RE.exec(line);
      if (m && date) {
        const mark = m[1].toLowerCase();
        const kind = mark === 'o' || mark === 'ø' ? 'event' : mark === '-' ? 'note' : 'task';
        let text = m[3].trim();
        let work = [];
        let workDone = [];
        let time = null;
        let end = null;
        const t = kind === 'event' ? TIME_RE.exec(text) : null;
        if (t) {
          time = pad2time(t[1]);
          end = t[2] ? pad2time(t[2]) : null;
          text = text.slice(t[0].length).trim();
        }
        const w = kind === 'task' ? WORK_RE.exec(text) : null;
        if (w) {
          work = w[1].split(/,\s*/).sort();
          workDone = w[2] ? w[2].split(/,\s*/).filter((d) => work.includes(d)).sort() : [];
          text = text.slice(0, w.index).trim();
        }
        this.entries.push({
          id: this.nextId++,
          kind,
          done: m[1] === 'x' || m[1] === 'X' || m[1] === 'ø',
          priority: m[2] ? m[2].length : 0,
          text,
          work,
          workDone,
          time,
          end,
          date,
          loadedFrom: key,
        });
      } else if (date) {
        this.entries.push({ id: this.nextId++, kind: 'raw', line, date, loadedFrom: key });
      } else {
        if (!this.preamble.has(key)) this.preamble.set(key, []);
        this.preamble.get(key).push(line);
      }
    }
  }

  pathFor(key) {
    return this.paths.get(key) || path.join(this.dir, key.slice(0, 4), `${key}.md`);
  }

  _render(key) {
    const mine = this.entries.filter((e) => monthOf(e.date) === key);
    const pre = this.preamble.get(key) || [];
    if (!mine.length && !pre.length) return null;
    const lines = [`# ${key}`];
    if (pre.length) lines.push('', ...pre);
    for (const date of [...new Set(mine.map((e) => e.date))].sort()) {
      lines.push('', `## ${date} ${fullWeekday(date)}`);
      for (const e of mine) {
        if (e.date !== date) continue;
        lines.push(e.kind === 'raw'
          ? e.line
          : `- [${markOf(e)}] ${e.priority ? `${'!'.repeat(e.priority)} ` : ''}${timePrefix(e)}${e.text}${workSuffix(e)}`);
      }
    }
    return `${lines.join('\n')}\n`;
  }

  _save(keys) {
    for (const key of new Set(keys)) {
      const file = this.pathFor(key);
      const body = this._render(key);
      if (body === null) {
        if (fs.existsSync(file)) fs.unlinkSync(file);
        this.paths.delete(key);
        continue;
      }
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = `${file}.tmp`;
      try {
        fs.writeFileSync(tmp, body, 'utf8');
        fs.renameSync(tmp, file);
      } catch (err) {
        try { fs.unlinkSync(tmp); } catch { /* ignore */ }
        fs.writeFileSync(file, body, 'utf8'); // e.g. file briefly locked by a sync client
      }
      this.paths.set(key, file);
      for (const e of this.entries) if (monthOf(e.date) === key) e.loadedFrom = key;
    }
  }

  add({ kind, priority, text, date, work, time, end }) {
    const timed = kind === 'event' && time;
    const e = {
      id: this.nextId++, kind, priority, done: false, text, date,
      work: kind === 'task' && work ? work : [], workDone: [],
      time: timed ? time : null, end: timed && end ? end : null,
    };
    this.entries.push(e);
    try { this._save([monthOf(date)]); } catch (err) { this.entries.pop(); throw err; }
    return e;
  }

  update(e, fields) {
    const before = { ...e };
    const oldMonth = monthOf(e.date);
    Object.assign(e, fields);
    if (e.kind !== before.kind || e.kind === 'note') e.done = false;
    if (e.kind !== 'task' || !e.work) e.work = [];
    // sessions only survive for days that are still work days
    e.workDone = (e.workDone || []).filter((d) => e.work.includes(d));
    if (e.kind !== 'event' || !e.time) { e.time = null; e.end = null; }   // only events have times
    const idx = this.entries.indexOf(e);
    if (e.date !== before.date) { this.entries.splice(idx, 1); this.entries.push(e); }
    try { this._save([oldMonth, monthOf(e.date)]); } catch (err) {
      Object.assign(e, before);
      if (e.date !== fields.date && idx >= 0) { this.entries.pop(); this.entries.splice(idx, 0, e); }
      throw err;
    }
  }

  // Tick / untick `e` as seen on `date` (see entry.tick). Returns what happened, or null.
  toggle(e, date) {
    if (e.kind === 'note') return null;
    const before = { done: e.done, workDone: [...(e.workDone || [])] };
    const outcome = tick(e, date);
    try { this._save([monthOf(e.date)]); } catch (err) { Object.assign(e, before); throw err; }
    return outcome;
  }

  // Delete one work session of a deadline task; the task, its deadline and the other sessions stay.
  // (Removing the last session leaves a plain task dated on the deadline.)
  removeWorkDay(e, date) {
    const before = { work: e.work, workDone: e.workDone };
    e.work = (e.work || []).filter((d) => d !== date);
    e.workDone = (e.workDone || []).filter((d) => d !== date);
    try { this._save([monthOf(e.date)]); } catch (err) { Object.assign(e, before); throw err; }
  }

  remove(e) {
    const idx = this.entries.indexOf(e);
    if (idx < 0) return;
    this.entries.splice(idx, 1);
    try { this._save([monthOf(e.date)]); } catch (err) { this.entries.splice(idx, 0, e); throw err; }
  }
}

module.exports = { Store, monthFilesIn };
