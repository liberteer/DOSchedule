'use strict';
// Pure renderer: (app state, width, height) -> one string of ANSI to write to the terminal.
// DOS look: double-line frame, light grey on black, 16-colour palette only.
// This file draws the frame + the main list; the month body lives in ui-month.js.

const { dateLabel, fullWeekday, longDate, shortDay, MONTH_FULL, parseISO, weekStart, isoWeek, weekRangeLabel } = require('./dates');
const { parseInput } = require('./parser');
const { ESC, BORDER, sty, reset, setTheme, toAscii, len, fit, wrap, entryColor, symbol } = require('./term');
const { scrollTop } = require('./ui-day');
const { OPTIONS, ACTIONS } = require('./settings');
const { bodyOptions, describeRow } = require('./ui-options');
const { dialogLines } = require('./ui-dialog');
const { searchLines } = require('./ui-search');
const { chooserLines } = require('./ui-chooser');
const { welcomeLines } = require('./ui-welcome');
const { isDeadlineTask, isDoneOn, withTime } = require('./entry');
const { bodyMonth, layout, MIN_W_MONTH, MIN_H_MONTH } = require('./ui-month');
const { bodyWeek, MIN_W_WEEK, MIN_H_WEEK } = require('./ui-week');

const MIN_W = 50;
const MIN_H = 14;

// One entry of the main list as one or more rows of width w. Long text is wrapped, never cut off: the
// first row leaves room for the date label on the right, the following rows use the full width.
function itemRows(e, selected, today, w) {
  const prefix = `${selected ? '> ' : '  '}${symbol(e, today)} ${'!'.repeat(e.priority).padEnd(3)} `;
  const deadline = isDeadlineTask(e);
  const label = deadline ? `due ${dateLabel(e.date, today, true)}` : dateLabel(e.date, today, false);   // '' for today: this list is today's
  const labelW = label ? len(label) + 1 : 0;
  const rev = selected ? '7;' : '';
  const base = entryColor(e, today);
  const open = !isDoneOn(e, today);
  const overdue = e.kind === 'task' && open && e.date < today;
  const dueNow = deadline && open && e.date <= today;
  const labelColor = selected ? base : overdue || dueNow ? '1;91' : deadline && open ? '93' : '90';
  const firstW = Math.max(1, w - len(prefix) - labelW);
  return wrap(withTime(e), Math.max(1, w - len(prefix)), firstW).map((part, i) => (i === 0
    ? sty(prefix + fit(part, firstW), rev + base) + (label ? sty(` ${label}`, rev + labelColor) : '')
    : sty(fit(' '.repeat(len(prefix)) + part, w), rev + base)));
}

function helpLines(app) {
  return [
    ['HELP - press any key to close', '1;97'],
    ['ADD (command line at the bottom, Enter saves)', '1;93'],
    ['  x text  task     x!!! text  priority: !  !!  !!!', '37'],
    ['  o text  event (with a time: o text 14:30-15:30)    - text  note', '37'],
    ['  x text >fri @wed,thu   deadline Fri, work Wed + Thu   (@2d = 2 days before)', '37'],
    ['DATES (anywhere in the text; none = today, or the calendar\'s selected day)', '1;93'],
    ['  14.3.2026   3/14/26   2026-03-14   march 14 2026   14 march', '37'],
    ['  today   tomorrow   in 3 days   in 2 weeks', '37'],
    ['KEYS', '1;93'],
    ['  Tab / Shift+Tab       next / previous screen: list, month, week', '37'],
    ['  Enter (empty line)    tick task / mark event ø   (month: open the day)', '37'],
    ['  F2 or Ctrl+E edit    Del or Ctrl+D delete    Esc clear / back    Ctrl+Q quit', '37'],
    ['  List:   Up/Down select          PgUp/PgDn  jump 5', '37'],
    ['  Month:  Arrows move day         PgUp/PgDn  month     Ctrl+T today', '37'],
    ['  Week:   Left/Right day          Up/Down  entry       PgUp/PgDn week', '37'],
    ['MARKERS  [ ] task  [x] done  o event  ø passed  - note   cells: • ■ x o ø', '1;93'],
    ['FIND  / on an empty line, or Ctrl+F: search every entry (type, ↑↓, Enter goes there)', '1;93'],
    ['OPTIONS  F10 or Ctrl+O: colours, note days, start screen, where your notes are saved, delete data', '1;93'],
  ];
}

function statusLine(app, today, w) {
  if (app.screen === 'options') {
    if (app.msg) return sty(fit(app.msg.text, w), app.msg.level === 'err' ? '1;91' : '1;92');
    const label = app.optIdx < OPTIONS.length ? OPTIONS[app.optIdx].label : ACTIONS[app.optIdx - OPTIONS.length].label;
    return sty(fit(`${label}: ${describeRow(app)}`, w), '36');
  }
  if (app.confirm) {
    const e = app.confirm;
    const what = app.confirmDay
      ? `only the work session on ${shortDay(app.confirmDay)} of "${e.text}"`
      : isDeadlineTask(e) ? `"${e.text}" and ALL its work sessions` : `"${e.text}"`;
    return sty(fit(`Delete ${what}?  y = yes, any other key = no`, w), '1;93');
  }
  if (app.msg) return sty(fit(app.msg.text, w), app.msg.level === 'err' ? '1;91' : '1;92');
  if (app.buf.length) {
    const r = parseInput(app.text, today, app.defaultDate());
    if (r.ok) {
      const pri = r.priority ? ` ${'!'.repeat(r.priority)}` : '';
      const when = `${dateLabel(r.date, today, true)} (${r.date} ${fullWeekday(r.date).slice(0, 3)})`;
      const work = r.work.length ? ` | work ${r.work.map((d) => shortDay(d, r.date)).join(', ')}` : '';
      const at = r.time ? ` | at ${r.time}${r.end ? `-${r.end}` : ''}` : '';
      const tip = r.timeIgnored ? ' (a time only works on events: start with o)' : '';
      return sty(fit(`=> ${r.kind}${pri}${tip} | ${r.work.length ? 'due ' : ''}${when}${work}${at} | ${r.text}`, w), r.timeIgnored ? '1;93' : '36');
    }
    return sty(fit(r.error, w), r.code === 'date' || r.code === 'time' ? '1;91' : '90');
  }
  if (app.screen !== 'main') {
    return sty(fit(`Adding to ${longDate(app.calDate)}:  x task   o event   - note   ! priority`, w), '90');
  }
  return sty(fit('x task   o event   - note   ! priority   date at the end, e.g.  o Dentist 14.3.2026', w), '90');
}

// Rows of the main list (Tasks / Events / Notes) for a body of B rows, Wc columns.
function bodyMain(app, view, Wc, B) {
  const rows = [];   // { html, head?, ei? }  ei = id of the entry a row belongs to
  const section = (name, list) => {
    const head = `── ${name} (${list.length}) `;
    rows.push({ head: true, html: sty(head + '─'.repeat(Math.max(0, Wc - len(head))), '1;97') });
    if (!list.length) rows.push({ html: sty(fit('   (none)', Wc), '90') });
    for (const e of list) {
      for (const html of itemRows(e, e.id === app.selId, view.today, Wc)) rows.push({ html, ei: e.id });
    }
    rows.push({ html: ' '.repeat(Wc) });
  };
  section('TASKS', view.tasks);
  section('EVENTS', view.events);
  section('NOTES', view.notes);
  rows.pop();

  const top = scrollTop(rows, app.selId === null ? -1 : app.selId, app.top, B);
  app.top = top;
  const out = [];
  for (let i = 0; i < B; i++) out.push(rows[top + i] ? rows[top + i].html : ' '.repeat(Wc));
  return { rows: out, more: { up: top > 0, down: top + B < rows.length } };
}

const MIN_SIZE = {
  main: [MIN_W, MIN_H], month: [MIN_W_MONTH, MIN_H_MONTH], week: [MIN_W_WEEK, MIN_H_WEEK], options: [MIN_W, MIN_H],
};

function drawFrame(app, W, H) {
  setTheme(app.settings.theme);
  // After a colour change (and on the first frame) wipe the screen in the new page colour.
  const wipe = app.needsClear ? `${reset()}${ESC}2J` : '';
  app.needsClear = false;
  const month = app.screen === 'month';
  const week = app.screen === 'week';
  const options = app.screen === 'options';
  const [minW, minH] = MIN_SIZE[app.screen];
  if (W < minW || H < minH) {
    const hint = app.screen === 'main' ? '' : options ? '  (Esc = back)' : '  (Tab = next screen)';
    return `${reset()}${ESC}2J${ESC}1;1H${sty(`Terminal too small: need ${minW}x${minH}, have ${W}x${H}${hint}`, '1;91')}`;
  }
  const now = app.clock();
  const today = app.today();
  const Wc = W - 4;            // content width between "║ " and " ║"
  const B = H - 6;             // body rows
  const line = (s, sgr = BORDER) => sty(s, sgr);

  // --- body
  let body;
  if (app.help) {
    const rows = helpLines(app).slice(0, B).map(([t, c]) => sty(fit(t, Wc), c));
    while (rows.length < B) rows.push(' '.repeat(Wc));
    body = { rows, more: {} };
  } else if (options) {
    body = bodyOptions(app, Wc, B);
  } else if (month) {
    body = bodyMonth(app, Wc, B, today);
  } else if (week) {
    body = bodyWeek(app, Wc, B, today);
  } else {
    body = bodyMain(app, app.view(), Wc, B);
  }
  // column of the calendar's vertical divider (for the ╦ ╩ junctions), or -1
  const divCol = month && !app.help ? layout(Wc).Lw + 3 : -1;

  // --- top bar
  const title = ' DOSchedule ';
  const { y, m } = parseISO(app.calDate);
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const stamp = ` ${longDate(today)}  ${hhmm} `;
  const room = W - 4 - len(title) - len(stamp);
  const weekCrumbs = () => {
    const range = weekRangeLabel(weekStart(app.calDate));
    return [` ◄ Week ${isoWeek(app.calDate)}  ${range} ► `, ` ◄ ${range} ► `];
  };
  const crumbs = month ? [` ◄ ${MONTH_FULL[m - 1]} ${y} ► `] : week ? weekCrumbs() : options ? [' Options '] : [''];
  const crumb = crumbs.find((c) => len(c) <= room) || '';
  const fill = Array(Math.max(0, room - len(crumb))).fill('═');
  const fillStart = 2 + len(title) + len(crumb);
  if (divCol >= fillStart && divCol < fillStart + fill.length) fill[divCol - fillStart] = '╦';
  const topBar = line('╔═') + sty(title, '1;97') + sty(crumb, '1;93') + line(fill.join('')) + sty(stamp, '1;97') + line('═╗');

  const bodyLines = body.rows.map((r, i) => {
    const right = i === 0 && body.more.up ? '▲' : i === B - 1 && body.more.down ? '▼' : '║';
    return `${line('║')} ${r} ${line(right, right === '║' ? BORDER : '1;97')}`;
  });

  // --- command line
  const Fw = W - 6;
  const start = Math.max(0, app.cur - (Fw - 1));
  const shown = app.buf.slice(start, start + Fw).join('');
  const promptColor = app.editing ? '1;93' : '1;92';
  const inputRow = `${line('║')} ${sty('>', promptColor)} ${sty(fit(shown, Fw), '1;97')} ${line('║')}`;

  // The bottom bar lists as many whole items as fit (most important first), never half of one.
  let items;
  if (app.chooser) {
    items = app.chooser.step === 'confirm' ? ['←→ choose', 'Enter confirm', 'Esc back']
      : app.chooser.step === 'browse' ? ['↑↓ choose', 'Enter open', 'Bksp up', 'Space use this folder', 'N new folder', 'T type a path', 'Esc cancel']
        : ['type', 'Enter go', 'Esc back'];
  } else if (app.welcome) items = ['←→ choose', 'Enter confirm', 'U use this folder', 'C choose another folder'];
  else if (app.search) items = ['type to search', '↑↓ choose', 'Enter go there', 'Esc close', 'PgUp/PgDn page'];
  else if (app.dialog) items = ['←→ choose', 'Enter confirm', 'Y yes', 'N or Esc no'];
  else if (options) items = ['↑↓ option', '←→ change', 'Enter change/open', 'Esc close', 'changes are saved at once'];
  else if (app.editing) items = ['EDITING', 'Enter save', 'Esc cancel'];
  else if (month && app.calFocus === 'day') items = ['↑↓ select', 'Enter tick', 'F10 options', '/ find', 'F2 edit', 'Del delete', 'Esc back', 'Tab next', '? help'];
  else if (month) items = ['Arrows day', 'PgUp/PgDn month', 'F10 options', '/ find', 'Enter open day', 'Ctrl+T today', 'Tab next', '? help'];
  else if (week) items = ['←→ day', '↑↓ entry', 'PgUp/PgDn week', 'Enter tick', 'F10 options', '/ find', 'F2 edit', 'Del delete', 'Tab next', '? help'];
  else items = ['↑↓ select', 'Enter tick/add', 'F10 options', '/ find', 'F2 edit', 'Del delete', 'Tab next', '? help', 'Ctrl+Q quit'];
  let hints = '';
  for (const item of items) {
    const next = hints ? `${hints}  ${item}` : ` ${item}`;
    if (len(next) > W - 1) break;
    hints = next;
  }

  const sep = Array(W - 2).fill('═');
  if (divCol > 0) sep[divCol - 1] = '╩';
  const lines = [
    topBar,
    ...bodyLines,
    line(`╠${sep.join('')}╣`),
    `${line('║')} ${statusLine(app, today, Wc)} ${line('║')}`,
    inputRow,
    line(`╚${'═'.repeat(W - 2)}╝`),
    `${sty(fit(hints, W - 1), '90')}${ESC}K`,   // K: paint the last column in the page colour too
  ];

  let out = `${wipe}${ESC}?25l`;
  lines.forEach((l, i) => { out += `${ESC}${i + 1};1H${l}`; });
  if (app.dialog) {                                  // a popup window on top of everything
    for (const d of dialogLines(app, W, H)) out += `${ESC}${d.row};${d.col}H${d.text}`;
  }
  if (app.welcome) {                                 // the first-start question
    for (const l of welcomeLines(app, W, H)) out += `${ESC}${l.row};${l.col}H${l.text}`;
  }
  if (app.chooser) {                                 // the notes-folder chooser (only from the options screen, or from the first-start question)
    const popup = chooserLines(app, W, H);
    for (const l of popup.lines) out += `${ESC}${l.row};${l.col}H${l.text}`;
    if (popup.cursor) out += `${ESC}${popup.cursor.row};${popup.cursor.col}H${ESC}?25h`;
  }
  if (app.search) {                                  // the Find popup, with the text cursor in its field
    const popup = searchLines(app, W, H);
    for (const l of popup.lines) out += `${ESC}${l.row};${l.col}H${l.text}`;
    out += `${ESC}${popup.cursor.row};${popup.cursor.col}H${ESC}?25h`;
  } else if (!options) out += `${ESC}${H - 2};${5 + app.cur - start}H${ESC}?25h`;   // no text cursor on the options screen
  return out;
}

// The finished frame, in the user's frame style (DOS line-drawing characters, or plain ASCII).
function render(app, W, H) {
  const out = drawFrame(app, W, H);
  return app.settings.frame === 'ascii' ? toAscii(out) : out;
}

module.exports = { render, MIN_W, MIN_H };
