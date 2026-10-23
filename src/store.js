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
// Lines the app doesn't understand are kept as 'raw' entries so hand edits are never lost; so are the
// words you add to a day's heading and the blank lines between your own lines.
//
// Safety rules for saving (see _save):
//   * a month file that changed on disk since it was read (another copy of the program, or a sync from
//     another computer) is never overwritten: the save stops with an error whose code is 'ECHANGED';
//   * a month file that is not UTF-8 text is shown but never rewritten (it would lose its accented letters);
//   * every new version is written to a temporary file first, so a full disk changes nothing.

const fs = require('fs');
const path = require('path');
const { fullWeekday } = require('./dates');
const { tick } = require('./entry');
const { readBytes, writeTemp, replaceWith, removeQuietly } = require('./files');

const UTF8 = new TextDecoder('utf-8', { fatal: true });   // (also drops a byte-order mark at the start)
const sameBytes = (a, b) => (a === null || b === null ? a === b : a.equals(b));
const isBlank = (e) => e.kind === 'raw' && e.line === '';

function changedOnDisk(file) {
  const err = new Error(`${file} was changed outside DOSchedule (by another copy of it, or by a sync from another computer)`);
  err.code = 'ECHANGED';
  return err;
}

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

// Is this one of our month files? Its first line that is not blank is the title "# YYYY-MM" (an empty file
// counts too: there is nothing in it to lose). Other files that merely have a month's name are someone
// else's: they are never read, rewritten or deleted.
function isNotesFile(file) {
  let head;
  try {
    const fd = fs.openSync(file, 'r');
    try {
      const buf = Buffer.alloc(4096);
      const n = fs.readSync(fd, buf, 0, buf.length, 0);
      const bom = n >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf ? 3 : 0;
      head = buf.subarray(bom, n).toString('latin1');
    } finally { fs.closeSync(fd); }
  } catch (err) {
    // Gone: nothing to read. Any other problem (locked for a moment, no access): count it as ours, so that
    // reading it fails loudly instead of the month quietly disappearing from the planner.
    return err.code !== 'ENOENT';
  }
  const first = head.split(/\r?\n/).find((line) => line.trim());
  return first === undefined || TITLE_RE.test(first);
}

// A copy of a month file made by a sync program when two computers changed it at once, e.g.
// "2026-03 (Laptop's conflicted copy 2026-10-23).md" or "2026-03 (1).md". Never read: only reported.
const COPY_RE = /^\d{4}-\d{2}\b.*(?:conflict|copy|\(\d+\)).*\.md$/i;

// Every month file (YYYY-MM.md) in a data folder, in year folders or loose in the folder itself.
// -> { notes: [our month files], other: [files only named like one], copies: [likely sync copies of one] }
function scanMonthFiles(dir) {
  const named = [];
  const copies = [];
  const look = (folder, name) => {
    if (FILE_RE.test(name)) named.push(path.join(folder, name));
    else if (COPY_RE.test(name)) copies.push(path.join(folder, name));
  };
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory() && YEAR_DIR_RE.test(ent.name)) {
      for (const f of fs.readdirSync(path.join(dir, ent.name))) look(path.join(dir, ent.name), f);
    } else if (ent.isFile()) {
      look(dir, ent.name);
    }
  }
  named.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
  const notes = [];
  const other = [];
  for (const f of named) (isNotesFile(f) ? notes : other).push(f);
  return { notes, other, copies: copies.sort() };
}

const monthFilesIn = (dir) => scanMonthFiles(dir).notes;

function notOurs(file, key) {
  return new Error(`${file} is not a DOSchedule notes file (its first line is not "# ${key}"), so it is left alone. Move or rename it to save entries for ${key}`);
}

class Store {
  constructor(dir) {
    this.dir = dir;
    this.entries = [];          // in file order; includes {kind:'raw'} placeholders
    this.preamble = new Map();  // monthKey -> unparsed lines found before the first day section
    this.paths = new Map();     // monthKey -> file the month was loaded from
    this.disk = new Map();      // monthKey -> the bytes of its file as last read or written (to notice changes by others)
    this.headings = new Map();  // date -> its "## ..." line as written in the file (keeps words added to it)
    this.notUtf8 = new Map();   // monthKey -> file that is not UTF-8 text: read, but never rewritten
    this.skipped = [];          // files named like a month file that are not ours (see isNotesFile): never read
    this.copies = [];           // likely copies of month files made by a sync program (see COPY_RE): never read
    this.nextId = 1;
  }

  // Every month file (YYYY-MM.md) on disk: in year folders, or loose in the data folder.
  _monthFiles() { return monthFilesIn(this.dir); }

  _forget() {
    this.entries = [];
    this.preamble = new Map();
    this.paths = new Map();
    this.disk = new Map();
    this.headings = new Map();
    this.notUtf8 = new Map();
    this.skipped = [];
    this.copies = [];
  }

  // Read everything again from disk (e.g. after a failed delete, or after another copy changed a file).
  // The files are read into a new Store first: if that fails, this one keeps what it had (the screen does
  // not go empty, and the check in _save still refuses to overwrite anything that changed).
  reload() {
    const fresh = new Store(this.dir);
    fresh.nextId = this.nextId;
    fresh.load();
    for (const k of ['entries', 'preamble', 'paths', 'disk', 'headings', 'notUtf8', 'skipped', 'copies', 'nextId']) this[k] = fresh[k];
  }

  // How much there is: real entries and month files. Never throws (a folder on a drive that was just
  // unplugged simply counts no files).
  stats() {
    let files = 0;
    try { files = this._monthFiles().length; } catch { /* folder not reachable right now */ }
    return { entries: this.entries.filter((e) => e.kind !== 'raw').length, files };
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
    this._forget();
    return { entries, files };
  }

  load() {
    fs.mkdirSync(this.dir, { recursive: true });
    const scan = scanMonthFiles(this.dir);
    const files = scan.notes;
    this.skipped = scan.other;
    this.copies = scan.copies;
    // Two files for one month (one loose, one in its year folder) would be read together and written back
    // into only one of them: stop and let the person decide which one is right.
    const seen = new Map();
    for (const file of files) {
      const key = path.basename(file).slice(0, 7);
      if (seen.has(key)) {
        throw new Error(`two files hold the notes of ${key}: ${seen.get(key)} and ${file}. Keep one of them (copy what you need from the other by hand), then start again`);
      }
      seen.set(key, file);
    }
    for (const file of files) {
      const key = path.basename(file).slice(0, 7);
      const bytes = fs.readFileSync(file);
      let text;
      try { text = UTF8.decode(bytes); } catch {
        text = bytes.toString('utf8').replace(/^\uFEFF/, '');
        this.notUtf8.set(key, file);
      }
      this.paths.set(key, file);
      this.disk.set(key, bytes);
      this._parse(text, key);
    }
    // Entries hand-moved into the "wrong" month file: re-home them right away (where they go first).
    const to = new Set();
    const from = new Set();
    for (const e of this.entries) {
      if (monthOf(e.date) !== e.loadedFrom) { to.add(monthOf(e.date)); from.add(e.loadedFrom); }
    }
    if (to.size) this._save([...to, ...from]);
  }

  // A line that is not an entry: kept in its day, or before the first day (the preamble).
  _keep(line, date, key) {
    if (date) this.entries.push({ id: this.nextId++, kind: 'raw', line, date, loadedFrom: key });
    else {
      if (!this.preamble.has(key)) this.preamble.set(key, []);
      this.preamble.get(key).push(line);
    }
  }

  _parse(text, key) {
    let date = null;
    let blanks = 0;   // blank lines not yet kept: only those followed by another of your lines are
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) { blanks++; continue; }
      if (TITLE_RE.test(line)) { blanks = 0; continue; }
      let m = SECTION_RE.exec(line);
      if (m) {
        date = m[1];
        if (!this.headings.has(date)) this.headings.set(date, line.trimEnd());
        blanks = 0;                       // (_render writes the blank line before a heading itself)
        continue;
      }
      if (date || this.preamble.has(key)) for (; blanks > 0; blanks--) this._keep('', date, key);
      blanks = 0;
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
      } else {
        this._keep(line, date, key);
      }
    }
  }

  pathFor(key) {
    return this.paths.get(key) || path.join(this.dir, key.slice(0, 4), `${key}.md`);
  }

  _render(key) {
    const mine = this.entries.filter((e) => monthOf(e.date) === key);
    const pre = this.preamble.get(key) || [];
    const days = [...new Set(mine.map((e) => e.date))].sort().map((date) => {
      const rows = mine.filter((e) => e.date === date);
      while (rows.length && isBlank(rows[rows.length - 1])) rows.pop();   // the gap before the next day is added below
      return { date, rows };
    }).filter((d) => d.rows.some((e) => !isBlank(e)));
    if (!days.length && !pre.length) return null;
    const lines = [`# ${key}`];
    if (pre.length) lines.push('', ...pre);
    for (const { date, rows } of days) {
      lines.push('', this.headings.get(date) || `## ${date} ${fullWeekday(date)}`);
      for (const e of rows) {
        lines.push(e.kind === 'raw'
          ? e.line
          : `- [${markOf(e)}] ${e.priority ? `${'!'.repeat(e.priority)} ` : ''}${timePrefix(e)}${e.text}${workSuffix(e)}`);
      }
    }
    return `${lines.join('\n')}\n`;
  }

  // Write the given months, in the given order: callers put the month an entry moves TO first, so a failure
  // half-way leaves it in two files, never in none. Throws before changing anything if a file cannot be
  // changed safely (see the rules at the top of this file) or a new version cannot be written in full.
  _save(keys) {
    const plan = [...new Set(keys)].map((key) => ({ key, file: this.pathFor(key), body: this._render(key) }));
    for (const p of plan) {
      if (this.notUtf8.has(p.key)) {
        throw new Error(`${p.file} is not saved as UTF-8 text, so DOSchedule does not change it. Save it as UTF-8 in a text editor, then start again`);
      }
      p.before = readBytes(p.file);
      const known = this.disk.has(p.key) ? this.disk.get(p.key) : null;
      if (!sameBytes(p.before, known)) {
        if (known === null && !isNotesFile(p.file)) throw notOurs(p.file, p.key);
        throw changedOnDisk(p.file);
      }
    }
    const written = plan.filter((p) => p.body !== null);
    try {
      for (const p of written) {
        fs.mkdirSync(path.dirname(p.file), { recursive: true });
        p.tmp = writeTemp(p.file, p.body);
      }
      for (const p of written) {
        replaceWith(p.tmp, p.file, p.body, p.before);
        p.tmp = null;
        this.disk.set(p.key, Buffer.from(p.body, 'utf8'));
        this.paths.set(p.key, p.file);
        for (const e of this.entries) if (monthOf(e.date) === p.key) e.loadedFrom = p.key;
      }
    } catch (err) {
      for (const p of written) if (p.tmp) removeQuietly(p.tmp);
      throw err;
    }
    for (const p of plan) {
      if (p.body !== null) continue;
      if (p.before) fs.unlinkSync(p.file);   // nothing left in that month
      this.paths.delete(p.key);
      this.disk.delete(p.key);
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
    const idx = this.entries.indexOf(e);
    if (idx < 0) throw new Error('this entry no longer exists (it was deleted)');
    const before = { ...e };
    const oldMonth = monthOf(e.date);
    Object.assign(e, fields);
    if (e.kind !== before.kind || e.kind === 'note') e.done = false;
    if (e.kind !== 'task' || !e.work) e.work = [];
    // sessions only survive for days that are still work days
    e.workDone = (e.workDone || []).filter((d) => e.work.includes(d));
    if (e.kind !== 'event' || !e.time) { e.time = null; e.end = null; }   // only events have times
    if (e.date !== before.date) { this.entries.splice(idx, 1); this.entries.push(e); }
    try { this._save([monthOf(e.date), oldMonth]); } catch (err) {
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

module.exports = { Store, monthFilesIn, scanMonthFiles, isNotesFile };
