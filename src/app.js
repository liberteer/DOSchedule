'use strict';
// UI-independent state + key handling for all screens (main list, month calendar).

const { todayISO, addDays, addMonths, dateLabel, longDate } = require('./dates');
const { searchEntries } = require('./search');
const { parseInput, SYMBOLS } = require('./parser');
const { appearsOn, isDeadlineTask, isDoneOn, timeLabel } = require('./entry');
const { OPTIONS, ACTIONS, loadSettings, saveSettings } = require('./settings');
const path = require('path');
const folders = require('./chooser');
const { Store } = require('./store');
const { writePointer } = require('./datadir');
const { shortDay } = require('./dates');

const SCREENS = ['main', 'month', 'week'];   // Tab cycles through these

// Is this task part of today's list? Open tasks dated today or earlier, plain tasks done today,
// and open deadline tasks on one of their work days (or from the deadline on). A finished
// deadline task is not listed again: its completion day is not stored.
const onToday = (e, today) => {
  if (isDeadlineTask(e)) return !e.done && (e.date <= today || e.work.includes(today));
  return e.date <= today && (!e.done || e.date === today);
};

const cmpDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
const KIND_ORDER = { task: 0, event: 1, note: 2 };
// Ticked entries sink below the open ones of their group (as seen on `date`); the order inside
// each of the two parts is unchanged, so priorities still run from the top.
const doneLast = (a, b, date) => Number(isDoneOn(a, date)) - Number(isDoneOn(b, date));
// Order inside one calendar day: tasks, events, notes; open before ticked; high priority first.
// Events with a start time sort by it; events without one (all day) come first.
const cmpTime = (a, b) => ((a.time || '') < (b.time || '') ? -1 : (a.time || '') > (b.time || '') ? 1 : 0);
const dayOrder = (a, b, date) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || doneLast(a, b, date)
  || (a.kind === 'event' ? cmpTime(a, b) : 0) || b.priority - a.priority || a.id - b.id;

class App {
  constructor(store, clock = () => new Date()) {
    this.store = store;
    this.clock = clock;
    this.settings = loadSettings(store.dir);   // see settings.js
    this.screen = 'main';     // 'main' | 'month' | 'week' | 'options' (opened with F10 / Ctrl+O, not part of Tab)
    this.prevScreen = 'main'; // where Esc returns from the options screen
    this.optIdx = 0;          // highlighted row: an option, or (after the options) an action
    this.search = null;       // the Find popup: { buf, cur, results, total, sel, top, page } or null
    this.dialog = null;       // popup being shown: { step: 1 | 2, choice: 'yes' | 'no' } (delete all data)
    this.welcome = null;      // the first-start question: { choice: 'use' | 'choose' } (see startWelcome)
    this.chooser = null;      // the notes-folder chooser popup (see openChooser)
    this.location = null;     // where the notes live, set by doschedule.js: { source, hasPointer, pointerFile, automatic(), platform, home }
    this.needsClear = true;   // the renderer clears the whole screen once (first frame, new colours)
    this.buf = [];            // command line, one element per character
    this.cur = 0;             // cursor position in buf
    this.editing = null;      // entry being edited, if any
    this.confirm = null;      // entry awaiting delete confirmation
    this.confirmDay = null;   // ...and, for a deadline task, the single work day to delete (else the whole entry)
    this.help = false;
    this.msg = null;          // { text, level: 'ok' | 'err' }
    this.quit = false;
    // main screen
    this.selId = null;        // selected entry
    this.selIdx = 0;
    this.top = 0;             // scroll offset (maintained by the renderer)
    this.keep = new Set();    // ids that stay visible this session (just added / ticked)
    // month screen
    this.calDate = todayISO(clock());  // highlighted day; month and week screens both follow it
    this.calFocus = 'grid';   // 'grid' (moving between days) | 'day' (selecting inside the day panel)
    this.dayIdx = 0;          // selected entry of the highlighted day (month: day panel, week: wide column)
    this.dayTop = 0;          // its scroll offset (maintained by the renderer)
  }

  get text() { return this.buf.join(''); }
  today() { return todayISO(this.clock()); }
  // Where an entry without its own date goes.
  defaultDate() { return this.screen === 'main' ? this.today() : this.calDate; }

  // ---- main screen -------------------------------------------------------

  // What the main screen shows. Also keeps the selection valid.
  view() {
    const today = this.today();
    const all = this.store.entries.filter((e) => e.kind !== 'raw');
    const shown = (e, ok) => ok || this.keep.has(e.id);
    const byPriority = (a, b) => doneLast(a, b, today) || b.priority - a.priority || cmpDate(a, b) || a.id - b.id;

    const tasks = all
      .filter((e) => e.kind === 'task' && shown(e, onToday(e, today)))
      .sort(byPriority);
    // The main list is for TODAY: only today's events (never past or upcoming ones: the calendars show those).
    const events = all
      .filter((e) => e.kind === 'event' && shown(e, e.date === today))
      .sort((a, b) => doneLast(a, b, today) || cmpTime(a, b) || b.priority - a.priority || a.id - b.id);
    // Notes: today and the last N days (the option), never notes dated in the future.
    const cutoff = addDays(today, -this.settings.noteDays);   // older notes drop off (calendars show all)
    const notes = all
      .filter((e) => e.kind === 'note' && shown(e, e.date >= cutoff && e.date <= today))
      .sort(byPriority);

    const flat = [...tasks, ...events, ...notes];
    let idx = flat.findIndex((e) => e.id === this.selId);
    if (idx < 0) idx = Math.max(0, Math.min(this.selIdx, flat.length - 1));
    this.selIdx = idx;
    this.selId = flat.length ? flat[idx].id : null;
    return { tasks, events, notes, flat, today };
  }

  selected() {
    const { flat } = this.view();
    return flat[this.selIdx] || null;
  }

  // ---- month screen ------------------------------------------------------

  dayEntries(date) {
    return this.store.entries.filter((e) => e.kind !== 'raw' && appearsOn(e, date)).sort((a, b) => dayOrder(a, b, date));
  }

  // The entry the user is pointing at (for tick / edit / delete), or null.
  current() {
    if (this.screen === 'main') return this.selected();
    if (this.screen === 'month' && this.calFocus !== 'day') return null;
    return this.dayEntries(this.calDate)[this.dayIdx] || null;
  }

  clampDay() {
    const ents = this.dayEntries(this.calDate);
    if (!ents.length && this.screen === 'month') this.calFocus = 'grid';
    this.dayIdx = Math.max(0, Math.min(this.dayIdx, ents.length - 1));
  }

  // ---- keys --------------------------------------------------------------

  say(text, level = 'ok') { this.msg = { text, level }; }

  handleKey(key) {
    if (this.chooser) { this.chooserKey(key); return; }
    if (this.welcome) { this.welcomeKey(key); return; }
    if (this.search) { this.searchKey(key); return; }
    if (this.dialog) { this.dialogKey(key); return; }
    if (this.help) { this.help = false; return; }

    if (this.confirm) {
      const e = this.confirm;
      const day = this.confirmDay;
      this.confirm = null;
      this.confirmDay = null;
      if (key.name === 'char' && key.ch.toLowerCase() === 'y') {
        this.guard(() => {
          if (day) { this.store.removeWorkDay(e, day); this.say('Work session deleted'); }
          else { this.store.remove(e); this.say(isDeadlineTask(e) ? 'Deleted with all its work sessions' : 'Deleted'); }
        });
      } else this.say('Delete cancelled');
      if (this.screen !== 'main') this.clampDay();
      return;
    }

    if (this.screen === 'options') { this.optionsKey(key); return; }

    this.msg = null;
    switch (key.name) {
      case 'ctrl-q': case 'ctrl-c': this.quit = true; break;
      case 'f10': case 'ctrl-o': this.openOptions(); break;
      case 'ctrl-f': this.openSearch(); break;
      case 'tab': this.cycle(1); break;
      case 'shift-tab': this.cycle(-1); break;
      case 'up': case 'down': case 'left': case 'right': this.nav(key.name); break;
      case 'pageup': case 'pagedown': this.page(key.name === 'pageup' ? -1 : 1); break;
      case 'ctrl-t':
        if (this.screen !== 'main') this.goTo(this.today());
        break;
      case 'enter': this.submit(); break;
      case 'escape':
        if (this.buf.length || this.editing) {
          if (this.editing) this.say('Edit cancelled');
          this.clearInput();
        } else if (this.calFocus === 'day') this.calFocus = 'grid';
        break;
      case 'f1': this.help = true; break;
      case 'f2': case 'ctrl-e': this.startEdit(); break;
      case 'ctrl-d': this.askDelete(); break;
      case 'delete':
        if (this.cur < this.buf.length) this.buf.splice(this.cur, 1);
        else if (!this.buf.length) this.askDelete();
        break;
      case 'backspace':
        if (this.cur > 0) this.buf.splice(--this.cur, 1);
        break;
      case 'home': this.cur = 0; break;
      case 'end': this.cur = this.buf.length; break;
      case 'ctrl-u': this.buf.splice(0, this.cur); this.cur = 0; break;
      case 'ctrl-w': {
        let i = this.cur;
        while (i > 0 && this.buf[i - 1] === ' ') i--;
        while (i > 0 && this.buf[i - 1] !== ' ') i--;
        this.buf.splice(i, this.cur - i);
        this.cur = i;
        break;
      }
      case 'char':
        if (!this.buf.length && key.ch === '?') { this.help = true; break; }
        if (!this.buf.length && key.ch === '/') { this.openSearch(); break; }   // no entry starts with /
        this.buf.splice(this.cur++, 0, key.ch);
        break;
      default: break;
    }
    if (this.screen !== 'main') this.clampDay();
  }

  // ---- Find popup ----------------------------------------------------------
  // "/" on an empty command line or Ctrl+F (no function keys, so it works the same on every system).
  // The field is always active: typing searches at once, Up/Down choose a result, Enter goes there.

  openSearch() {
    this.search = { buf: [], cur: 0, results: [], total: 0, sel: 0, top: 0, page: 8 };
  }

  runSearch() {
    const s = this.search;
    const { results, total } = searchEntries(this.store.entries, s.buf.join(''));
    s.results = results;
    s.total = total;
    s.sel = 0;
    s.top = 0;
  }

  searchKey(key) {
    const s = this.search;
    const last = () => Math.max(0, s.results.length - 1);
    switch (key.name) {
      case 'ctrl-q': case 'ctrl-c': this.quit = true; break;
      case 'escape': this.search = null; break;
      case 'enter': if (s.results.length) this.goToResult(s.results[s.sel]); break;
      case 'up': s.sel = Math.max(0, s.sel - 1); break;
      case 'down': s.sel = Math.min(last(), s.sel + 1); break;
      case 'pageup': s.sel = Math.max(0, s.sel - s.page); break;
      case 'pagedown': s.sel = Math.min(last(), s.sel + s.page); break;
      case 'left': s.cur = Math.max(0, s.cur - 1); break;
      case 'right': s.cur = Math.min(s.buf.length, s.cur + 1); break;
      case 'home': s.cur = 0; break;
      case 'end': s.cur = s.buf.length; break;
      case 'backspace': if (s.cur > 0) { s.buf.splice(--s.cur, 1); this.runSearch(); } break;
      case 'delete': if (s.cur < s.buf.length) { s.buf.splice(s.cur, 1); this.runSearch(); } break;
      case 'ctrl-u': s.buf.splice(0, s.cur); s.cur = 0; this.runSearch(); break;
      case 'ctrl-w': {
        let i = s.cur;
        while (i > 0 && s.buf[i - 1] === ' ') i--;
        while (i > 0 && s.buf[i - 1] !== ' ') i--;
        s.buf.splice(i, s.cur - i);
        s.cur = i;
        this.runSearch();
        break;
      }
      case 'char': s.buf.splice(s.cur++, 0, key.ch); this.runSearch(); break;
      default: break;
    }
  }

  // Take the user to a result. The main list is for TODAY only, so an entry that is on today's list is
  // shown there; anything else is shown on the week view, on its own day, with the entry highlighted.
  goToResult(e) {
    this.search = null;
    this.msg = null;
    if (this.view().flat.includes(e)) {
      this.screen = 'main';
      this.selId = e.id;
      return;
    }
    this.screen = 'week';
    this.calDate = e.date;
    this.calFocus = 'grid';
    this.dayIdx = Math.max(0, this.dayEntries(e.date).indexOf(e));
    this.dayTop = 0;
    this.say(`Found on ${longDate(e.date)}`);
  }

  // ---- options screen ----------------------------------------------------

  openOptions() {
    this.prevScreen = this.screen;
    this.screen = 'options';
  }

  // Keys on the options screen. The command line is inactive there; changes apply and save at once.
  // Rows: the OPTIONS (values you step through), then the ACTIONS (Enter does something).
  optionsKey(key) {
    this.msg = null;
    const rows = OPTIONS.length + ACTIONS.length;
    const onAction = this.optIdx >= OPTIONS.length;
    switch (key.name) {
      case 'ctrl-q': case 'ctrl-c': this.quit = true; break;
      case 'escape': case 'f10': case 'ctrl-o': case 'tab': case 'shift-tab': this.screen = this.prevScreen; break;
      case 'up': this.optIdx = Math.max(0, this.optIdx - 1); break;
      case 'down': this.optIdx = Math.min(rows - 1, this.optIdx + 1); break;
      case 'left': if (!onAction) this.changeOption(-1); break;
      case 'right': if (!onAction) this.changeOption(1); break;
      case 'enter':
        if (onAction) this.runAction(ACTIONS[this.optIdx - OPTIONS.length].key);
        else this.changeOption(1);
        break;
      case 'f1': this.help = true; break;
      case 'char': if (key.ch === '?') this.help = true; break;
      default: break;
    }
  }

  runAction(name) {
    if (name === 'deleteAll') this.dialog = { step: 1, choice: 'no' };   // always starts on [ No ]
    else if (name === 'chooseFolder') this.openChooser();
    else if (name === 'autoFolder') this.useAutomaticFolder();
  }

  // ---- First start: where should the notes live? ---------------------------------------------------------
  // Shown once, to someone who has never set anything up. [ Use this folder ] keeps the automatic folder,
  // [ Choose a folder... ] opens the folder browser (and comes back here if it is cancelled). Either way the
  // answer is recorded (see writePointer), so the question never returns; later changes go through the Options.

  startWelcome() { this.welcome = { choice: 'use' }; }

  welcomeKey(key) {
    const w = this.welcome;
    switch (key.name) {
      case 'ctrl-q': case 'ctrl-c': this.quit = true; break;
      case 'left': case 'right': case 'tab': case 'shift-tab': w.choice = w.choice === 'use' ? 'choose' : 'use'; break;
      case 'enter': if (w.choice === 'use') this.welcomeUseDefault(); else this.openChooser(); break;
      case 'escape': this.welcomeUseDefault(); break;
      case 'char':
        if (key.ch.toLowerCase() === 'u') this.welcomeUseDefault();
        else if (key.ch.toLowerCase() === 'c') this.openChooser();
        break;
      default: break;
    }
  }

  welcomeUseDefault() {
    try { writePointer(this.location.pointerFile, null); } catch (err) { this.say(`Could not save this choice: ${err.message}`, 'err'); return; }
    this.welcome = null;
    this.say(`Your notes are saved in ${this.store.dir}. You can change this any time: F10, Options.`);
  }

  // ---- "Choose notes folder": a folder browser, then a question, then the switch ---------------------------
  // Nothing is ever moved or deleted: the old notes stay where they are, and "Use the automatic notes folder"
  // (or doschedule --reset-folder) gives the earlier behaviour back.

  openChooser() {
    if (!this.location) { this.say('The notes folder cannot be changed from here', 'err'); return; }
    const start = folders.isFolder(this.store.dir) ? this.store.dir : this.location.home;
    this.chooser = { step: 'browse', dir: start, list: { entries: [], error: null }, notes: null, preview: null, sel: 0, top: 0, page: 10, buf: [], cur: 0, note: '', confirm: null };
    this.chooserGo(start, null);
  }

  chooserGo(dir, selectPath) {
    const c = this.chooser;
    c.dir = dir;
    c.list = folders.listFolder(dir, { platform: this.location.platform, driveList: this.location.driveList });
    c.notes = dir === folders.DRIVES ? null : folders.notesIn(dir);
    c.sel = Math.max(0, c.list.entries.findIndex((e) => e.path === selectPath));
    c.top = 0;
    c.note = '';
    this.chooserPreview();
  }

  // The right-hand panel: what is inside the highlighted folder (read once per move, not on every redraw).
  chooserPreview() {
    const c = this.chooser;
    const e = c.list.entries[c.sel];
    c.preview = e && e.kind !== 'up'
      ? { list: folders.listFolder(e.path, { platform: this.location.platform }), notes: folders.notesIn(e.path) }
      : null;
  }

  chooserKey(key) {
    const c = this.chooser;
    if (key.name === 'ctrl-q' || key.name === 'ctrl-c') { this.quit = true; return; }
    if (c.step === 'confirm') this.chooserConfirmKey(key);
    else if (c.step === 'browse') this.chooserBrowseKey(key);
    else this.chooserFieldKey(key);
  }

  chooserBrowseKey(key) {
    const c = this.chooser;
    const last = Math.max(0, c.list.entries.length - 1);
    const move = (to) => { c.sel = Math.max(0, Math.min(last, to)); c.note = ''; this.chooserPreview(); };
    switch (key.name) {
      case 'escape': this.chooser = null; this.say('Notes folder not changed'); break;
      case 'f7': this.chooserNewFolder(); break;                // F7 = "make directory" in the old DOS file managers
      case 'up': move(c.sel - 1); break;
      case 'down': move(c.sel + 1); break;
      case 'pageup': move(c.sel - c.page); break;
      case 'pagedown': move(c.sel + c.page); break;
      case 'home': move(0); break;
      case 'end': move(last); break;
      case 'enter': case 'right': {
        const e = c.list.entries[c.sel];
        if (e) this.chooserGo(e.path, e.kind === 'up' ? c.dir : null);
        break;
      }
      case 'backspace': case 'left': {
        const up = folders.parentOf(c.dir, this.location.platform);
        if (up === null) c.note = 'This is the top.';
        else this.chooserGo(up, c.dir);
        break;
      }
      case 'char':
        if (c.dir === folders.DRIVES) {                       // in the drive list a letter jumps to that drive
          const i = c.list.entries.findIndex((e) => e.name === `-${key.ch.toUpperCase()}-`);
          if (i >= 0) move(i);
        } else if (key.ch === ' ') this.chooserUse();
        else if (key.ch.toLowerCase() === 'n') this.chooserNewFolder();
        else if (key.ch.toLowerCase() === 't') { c.step = 'path'; c.buf = Array.from(c.dir); c.cur = c.buf.length; c.note = ''; }
        break;
      default: break;
    }
  }

  chooserNewFolder() {
    const c = this.chooser;
    if (c.dir === folders.DRIVES) { c.note = 'Open a drive first, then make the new folder inside it.'; return; }
    c.step = 'new';
    c.buf = [];
    c.cur = 0;
    c.note = '';
  }

  // Typing a path ('path') or the name of a new folder ('new'): a small line editor.
  chooserFieldKey(key) {
    const c = this.chooser;
    switch (key.name) {
      case 'escape': c.step = 'browse'; c.note = ''; break;
      case 'enter': this.chooserSubmitField(); break;
      case 'left': c.cur = Math.max(0, c.cur - 1); break;
      case 'right': c.cur = Math.min(c.buf.length, c.cur + 1); break;
      case 'home': c.cur = 0; break;
      case 'end': c.cur = c.buf.length; break;
      case 'backspace': if (c.cur > 0) c.buf.splice(--c.cur, 1); break;
      case 'delete': if (c.cur < c.buf.length) c.buf.splice(c.cur, 1); break;
      case 'ctrl-u': c.buf.splice(0, c.cur); c.cur = 0; break;
      case 'char': c.buf.splice(c.cur++, 0, key.ch); break;
      default: break;
    }
  }

  chooserSubmitField() {
    const c = this.chooser;
    const { platform, home } = this.location;
    const text = c.buf.join('');
    if (c.step === 'new') {
      if (c.dir === folders.DRIVES) { c.note = 'Open a drive first.'; return; }
      const r = folders.makeFolder(c.dir, text, platform);
      if (r.error) { c.note = r.error; return; }
      c.step = 'browse';
      this.chooserGo(r.path, null);
      c.note = 'Folder created. Space uses it for your notes.';
      return;
    }
    const target = folders.resolveTyped(text, { cwd: c.dir, home, platform });
    if (!target) { c.note = 'Type a folder path.'; return; }
    if (folders.isFolder(target)) { c.step = 'browse'; this.chooserGo(target, null); return; }
    const made = folders.makeFolder(path.dirname(target), path.basename(target), platform);
    if (made.error) { c.note = `No such folder, and it could not be created: ${made.error}`; return; }
    c.step = 'browse';
    this.chooserGo(made.path, null);
    c.note = 'Folder created. Space uses it for your notes.';
  }

  // Space: use the folder shown at the top. Asks one question first (copy / use what is there).
  chooserUse() {
    const c = this.chooser;
    if (folders.sameFolder(c.dir, this.store.dir, this.location.platform)) { c.note = 'This is already your notes folder.'; return; }
    const problem = folders.canWrite(c.dir);
    if (problem) { c.note = problem; return; }
    const target = folders.notesIn(c.dir);
    const mine = this.store.stats();
    let kind;
    let buttons;
    if (target.files > 0) { kind = 'found'; buttons = [['use', 'Use these notes', 'Use'], ['cancel', 'Cancel']]; }
    else if (mine.files > 0) { kind = 'copy'; buttons = [['copy', 'Copy my notes', 'Copy'], ['empty', 'Start empty', 'Empty'], ['cancel', 'Cancel']]; }
    else { kind = 'plain'; buttons = [['use', 'Use this folder', 'Use'], ['cancel', 'Cancel']]; }
    c.step = 'confirm';
    c.confirm = { kind, dir: c.dir, target, mine, choice: 0, buttons };
  }

  chooserConfirmKey(key) {
    const c = this.chooser;
    const q = c.confirm;
    switch (key.name) {
      case 'escape': c.step = 'browse'; break;
      case 'left': case 'shift-tab': q.choice = (q.choice + q.buttons.length - 1) % q.buttons.length; break;
      case 'right': case 'tab': q.choice = (q.choice + 1) % q.buttons.length; break;
      case 'enter': {
        const action = q.buttons[q.choice][0];
        if (action === 'cancel') c.step = 'browse';
        else this.switchFolder(q.dir, action === 'copy');
        break;
      }
      default: break;
    }
  }

  // Load the notes of another folder and remember the choice. On any problem nothing changes.
  switchFolder(dir, copy) {
    const c = this.chooser;
    const from = this.store.dir;
    const loc = this.location;
    try {
      const result = copy ? folders.copyNotes(from, dir) : null;
      const store = new Store(dir);
      store.load();
      writePointer(loc.pointerFile, dir);
      const overridden = loc.source === 'argument' || loc.source === 'environment';
      loc.source = 'chosen';
      loc.hasPointer = true;
      this.adoptStore(store);
      this.chooser = null;
      this.welcome = null;                                    // (a first-start question is answered by this, too)
      const copied = result ? ` ${result.copied} month ${result.copied === 1 ? 'file' : 'files'} copied.` : '';
      this.say(`Now using ${dir}.${copied} Your old notes stay in ${from}.${overridden ? ' (--data / DOSCHEDULE_DIR still win when given at start.)' : ''}`);
    } catch (err) {
      c.step = 'browse';
      c.note = `Could not switch: ${err.message}`;
    }
  }

  // "Use the automatic notes folder": forget the chosen folder. The earlier behaviour (a data folder next to
  // the program if there is one, else the folder of your user account) is back; no notes are touched.
  useAutomaticFolder() {
    const loc = this.location;
    if (!loc) { this.say('The notes folder cannot be changed from here', 'err'); return; }
    if (!loc.hasPointer) { this.say('The notes folder is already automatic: nothing was chosen in the app'); return; }
    try { writePointer(loc.pointerFile, null); } catch (err) { this.say(`Could not forget the chosen folder: ${err.message}`, 'err'); return; }
    loc.hasPointer = false;
    if (loc.source !== 'chosen') { this.say('Forgot the chosen folder. This run keeps its --data / DOSCHEDULE_DIR folder; the next start is automatic.'); return; }
    const auto = loc.automatic();
    const from = this.store.dir;
    try {
      const store = new Store(auto.dir);
      store.load();
      loc.source = auto.source;
      this.adoptStore(store);
      this.say(`Back to the automatic folder: ${auto.dir}. The notes in ${from} were not touched.`);
    } catch (err) {
      loc.hasPointer = true;
      try { writePointer(loc.pointerFile, from); } catch { /* keep going: report the original problem */ }
      this.say(`Could not open the automatic folder: ${err.message}`, 'err');
    }
  }

  // Start using another Store: forget everything that belonged to the old one.
  adoptStore(store) {
    this.store = store;
    this.settings = loadSettings(store.dir);
    this.keep = new Set();
    this.selId = null;
    this.selIdx = 0;
    this.top = 0;
    this.dayIdx = 0;
    this.dayTop = 0;
    this.calFocus = 'grid';
    this.clearInput();
    this.confirm = null;
    this.search = null;
    this.needsClear = true;
  }

  // ---- "Delete all data": two popups in a row, each [ Yes ] / [ No ] ------------------------

  // The popup eats every key until it is answered. Enter picks the highlighted button, Y / N answer
  // directly, Esc is No. The second popup starts on [ No ] again, so keys held down or Enter pressed
  // twice can never delete anything: you must choose Yes on both.
  dialogKey(key) {
    const d = this.dialog;
    switch (key.name) {
      case 'ctrl-q': case 'ctrl-c': this.quit = true; break;
      case 'left': case 'right': case 'tab': case 'shift-tab': d.choice = d.choice === 'no' ? 'yes' : 'no'; break;
      case 'escape': this.cancelDelete(); break;
      case 'enter': if (d.choice === 'yes') this.dialogYes(); else this.cancelDelete(); break;
      case 'char':
        if (key.ch.toLowerCase() === 'y') this.dialogYes();
        else if (key.ch.toLowerCase() === 'n') this.cancelDelete();
        break;
      default: break;
    }
  }

  dialogYes() {
    if (this.dialog.step === 1) { this.dialog = { step: 2, choice: 'no' }; return; }
    this.dialog = null;
    this.deleteAllData();
  }

  cancelDelete() {
    this.dialog = null;
    this.say('Nothing was deleted');
  }

  deleteAllData() {
    try {
      const { entries, files } = this.store.deleteAll();
      this.keep = new Set();
      this.selId = null;
      this.selIdx = 0;
      this.dayIdx = 0;
      this.calFocus = 'grid';
      this.clearInput();
      this.confirm = null;
      this.say(`All data deleted (${entries} ${entries === 1 ? 'entry' : 'entries'}, ${files} ${files === 1 ? 'file' : 'files'})`);
    } catch (err) {
      try { this.store.reload(); } catch { /* keep going: report the original problem */ }
      this.say(`Could not delete everything: ${err.message}`, 'err');
    }
  }

  changeOption(dir) {
    const option = OPTIONS[this.optIdx];
    const at = Math.max(0, option.values.findIndex((v) => v.value === this.settings[option.key]));
    this.settings[option.key] = option.values[(at + dir + option.values.length) % option.values.length].value;
    if (option.key === 'theme' || option.key === 'frame') this.needsClear = true;
    try { saveSettings(this.store.dir, this.settings); } catch (err) { this.say(`Could not save settings: ${err.message}`, 'err'); }
  }

  cycle(dir) {
    this.screen = SCREENS[(SCREENS.indexOf(this.screen) + dir + SCREENS.length) % SCREENS.length];
    this.calFocus = 'grid';
    this.dayIdx = 0;
  }

  // Move the highlighted day (month / week screens).
  goTo(date) {
    this.calDate = date;
    this.calFocus = 'grid';
    this.dayIdx = 0;
  }

  // Arrow keys. Left/Right edit the command line when it has text.
  nav(dir) {
    const horizontal = dir === 'left' || dir === 'right';
    if (horizontal && this.buf.length) {
      this.cur = dir === 'left' ? Math.max(0, this.cur - 1) : Math.min(this.buf.length, this.cur + 1);
      return;
    }
    if (this.screen === 'main') {
      if (!horizontal) this.move(dir === 'up' ? -1 : 1);
      return;
    }
    if (this.screen === 'week') {
      if (dir === 'up') this.dayIdx--;
      else if (dir === 'down') this.dayIdx++;
      else this.goTo(addDays(this.calDate, dir === 'left' ? -1 : 1));
      return;
    }
    if (this.calFocus === 'day') {
      if (dir === 'up') this.dayIdx--;
      else if (dir === 'down') this.dayIdx++;
      else if (dir === 'left') this.calFocus = 'grid';
      return;
    }
    this.calDate = addDays(this.calDate, { up: -7, down: 7, left: -1, right: 1 }[dir]);
  }

  page(dir) {
    if (this.screen === 'main') this.move(dir * 5);
    else if (this.screen === 'month') this.goTo(addMonths(this.calDate, dir));
    else this.goTo(addDays(this.calDate, dir * 7));
  }

  guard(fn) {
    try { fn(); } catch (err) { this.say(`Could not save: ${err.message}`, 'err'); }
  }

  clearInput() { this.buf = []; this.cur = 0; this.editing = null; }

  move(delta) {
    const { flat } = this.view();
    if (!flat.length) return;
    this.selIdx = Math.max(0, Math.min(flat.length - 1, this.selIdx + delta));
    this.selId = flat[this.selIdx].id;
  }

  submit() {
    if (!this.text.trim()) { this.enterOnEmpty(); return; }
    const today = this.today();
    const r = parseInput(this.text, today, this.defaultDate());
    if (!r.ok) { this.say(r.error, 'err'); return; }
    const fields = {
      kind: r.kind, priority: r.priority, text: r.text, date: r.date, work: r.work, time: r.time, end: r.end,
    };
    const what = r.work.length
      ? `${r.kind} - due ${dateLabel(r.date, today, true)}, work ${r.work.map((d) => shortDay(d, r.date)).join(', ')}`
      : `${r.kind} for ${dateLabel(r.date, today, true)}${r.time ? ` at ${r.time}${r.end ? `-${r.end}` : ''}` : ''}`;
    const tip = r.timeIgnored ? ' - no time saved: only events (o) take a time' : '';
    const wasEditing = Boolean(this.editing);
    const oldWork = wasEditing ? [...(this.editing.work || [])] : [];
    const before = wasEditing ? { date: this.editing.date, kind: this.editing.kind } : null;
    this.guard(() => {
      let e;
      if (this.editing) { e = this.editing; this.store.update(e, fields); this.say(`Saved ${what}${tip}`); }
      else { e = this.store.add(fields); this.say(`Added ${what}${tip}`); }
      this.clearInput();
      // An entry moved to another day (or turned into another kind) is no longer "pinned" to the main
      // list by an earlier add or tick: the main list follows its rules again.
      if (before && (before.date !== e.date || before.kind !== e.kind)) this.keep.delete(e.id);
      if (this.screen !== 'main') {
        const stays = appearsOn(e, this.calDate);   // still on the highlighted day?
        if (!stays) {                                // otherwise jump to where it landed:
          const moved = (e.work || []).filter((d) => !oldWork.includes(d));
          this.calDate = moved.length === 1 ? moved[0] : r.date;   // a moved session, else the deadline
        }
        const at = Math.max(0, this.dayEntries(this.calDate).indexOf(e));
        if (this.screen === 'week') this.dayIdx = at;
        else if (wasEditing && stays) this.dayIdx = at;
        else this.calFocus = 'grid';
        return;
      }
      // Main screen: select it if it belongs on today's list, otherwise say where it went.
      if (this.view().flat.includes(e)) this.selId = e.id;
      else this.say(`${this.msg.text} (not on today's list)`);
    });
  }

  // Enter on an empty command line.
  enterOnEmpty() {
    if (this.screen === 'month' && this.calFocus === 'grid') {
      if (this.dayEntries(this.calDate).length) { this.calFocus = 'day'; this.dayIdx = 0; }
      else this.say('Nothing planned for this day - type to add an entry');
      return;
    }
    const e = this.current();
    if (!e) { this.pointAtEntry(); return; }
    if (e.kind === 'note') { this.say('Only tasks and events can be ticked off'); return; }
    // A deadline task is ticked as seen on a particular day: the real today on the main list,
    // the highlighted day on the calendars.
    const date = this.viewedDay();
    this.guard(() => {
      const outcome = this.store.toggle(e, date);
      this.keep.add(e.id);
      // The ticked entry sinks to the bottom of its group: the cursor stays on this row (the next
      // entry moves up under it), so a run of Enter presses ticks a run of entries.
      if (this.screen === 'main') this.selId = null;
      const says = {
        'session-done': 'Work session done',
        'session-open': 'Work session reopened',
        'all-done': 'All work sessions done - task complete',
        'task-done': isDeadlineTask(e) ? 'Task done' : null,
        'task-open': isDeadlineTask(e) ? 'Task reopened' : null,
      };
      if (says[outcome]) this.say(says[outcome]);
    });
  }

  startEdit() {
    const e = this.current();
    if (!e) { this.pointAtEntry(); return; }
    this.editing = e;
    // Moving a work session: the work day you are looking at goes LAST in the line, so
    // Ctrl+W removes exactly that day and you type its replacement (e.g. @thu).
    const viewed = this.viewedDay();
    const onWorkDay = isDeadlineTask(e) && e.work.includes(viewed);
    const work = onWorkDay ? [...e.work.filter((d) => d !== viewed), viewed] : e.work;
    const when = isDeadlineTask(e) ? `>${e.date} ${work.map((d) => `@${d}`).join(' ')}` : e.date;
    const line = `${SYMBOLS[e.kind]}${'!'.repeat(e.priority)} ${e.text} ${when}${e.time ? ` ${timeLabel(e)}` : ''}`;
    this.buf = Array.from(line);
    this.cur = this.buf.length;
    this.say(onWorkDay
      ? 'Move this work day: Ctrl+W, then type its new day (e.g. @thu). Esc cancels'
      : 'Editing - Enter saves, Esc cancels');
  }

  // The day the user is looking at: the real today on the main list, the highlighted day on the
  // calendars. Ticking, moving and deleting a deadline task all act on this day.
  viewedDay() { return this.screen === 'main' ? this.today() : this.calDate; }

  // Del on a work day of a deadline task deletes only that work session (confirmDay); anywhere
  // else (the deadline, an overdue day, plain entries) it deletes the whole entry.
  askDelete() {
    const e = this.current();
    if (!e) { this.pointAtEntry(); return; }
    const day = this.viewedDay();
    this.confirm = e;
    this.confirmDay = isDeadlineTask(e) && e.work.includes(day) ? day : null;
  }

  pointAtEntry() {
    if (this.screen === 'month') this.say('Press Enter to open the day, then pick an entry');
    else if (this.screen === 'week') this.say('Nothing planned for this day - type to add an entry');
  }
}

module.exports = { App, dayOrder };
