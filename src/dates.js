'use strict';
// Date helpers + free-text date extraction.
// All dates are plain 'YYYY-MM-DD' strings; arithmetic goes through UTC to dodge DST bugs.

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9,
  oct: 10, nov: 11, dec: 12,
};
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MIN_YEAR = 1970;
const MAX_YEAR = 2099;

const pad2 = (n) => String(n).padStart(2, '0');
const toISO = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;

function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

function isValidYMD(y, m, d) {
  if (y < MIN_YEAR || y > MAX_YEAR) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function todayISO(now = new Date()) {
  return toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function addDays(s, n) {
  const { y, m, d } = parseISO(s);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return toISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function weekdayIndex(s) {
  const { y, m, d } = parseISO(s);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const fullWeekday = (s) => DAY_FULL[weekdayIndex(s)];

// Short human label: "tomorrow", "Sat 14 Mar", "Sat 14 Mar 2027". Today -> '' unless showToday.
function dateLabel(s, today, showToday = false) {
  if (s === today) return showToday ? 'today' : '';
  if (s === addDays(today, 1)) return 'tomorrow';
  if (s === addDays(today, -1)) return 'yesterday';
  const { y, m, d } = parseISO(s);
  const base = `${DAY_SHORT[weekdayIndex(s)]} ${d} ${MONTH_SHORT[m - 1]}`;
  return y === parseISO(today).y ? base : `${base} ${y}`;
}

const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

const utcDay = (s) => { const { y, m, d } = parseISO(s); return Date.UTC(y, m - 1, d); };
const diffDays = (a, b) => Math.round((utcDay(b) - utcDay(a)) / 86400000);
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
// Monday = 0 ... Sunday = 6 (weeks start on Monday)
const mondayIndex = (s) => (weekdayIndex(s) + 6) % 7;

// Same day-of-month n months away, clamped to the month's length (31 Jan + 1 -> 28/29 Feb).
function addMonths(s, n) {
  const { y, m, d } = parseISO(s);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return toISO(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

const weekStart = (s) => addDays(s, -mondayIndex(s));

// ISO week number (weeks start on Monday; week 1 contains the year's first Thursday).
function isoWeek(s) {
  const thursday = addDays(weekStart(s), 3);
  return Math.floor(diffDays(`${parseISO(thursday).y}-01-01`, thursday) / 7) + 1;
}

// "12 - 18 Oct 2026", "29 Sep - 5 Oct 2026", "28 Dec 2026 - 3 Jan 2027"
function weekRangeLabel(start) {
  const a = parseISO(start);
  const b = parseISO(addDays(start, 6));
  const mon = (p) => MONTH_SHORT[p.m - 1];
  if (a.y !== b.y) return `${a.d} ${mon(a)} ${a.y} - ${b.d} ${mon(b)} ${b.y}`;
  if (a.m !== b.m) return `${a.d} ${mon(a)} - ${b.d} ${mon(b)} ${b.y}`;
  return `${a.d} - ${b.d} ${mon(b)} ${b.y}`;
}

function relativeDays(s, today) {
  const n = diffDays(today, s);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

// "Tue 13 Oct 2026"
function longDate(s) {
  const { y, m, d } = parseISO(s);
  return `${DAY_SHORT[weekdayIndex(s)]} ${d} ${MONTH_SHORT[m - 1]} ${y}`;
}

// ---------------------------------------------------------------------------
// Extraction. Conventions (documented in README):
//   dots   14.3.2026   -> day.month.year
//   slash  3/14/26     -> month/day/year  (swapped only when that is the sole valid reading)
//   ISO    2026-03-14
//   names  march 14 2026, 14 march, mar 14th
//   words  today, tomorrow, in 3 days, in 2 weeks
// Deliberately NOT supported (too ambiguous inside normal text): year-less numbers like
// "3/14" or "2.5", bare weekdays like "friday".
// ---------------------------------------------------------------------------

const NB = String.raw`(?<![\w./:-])`;           // not glued to the left of something
const NA = String.raw`(?![\w/:-])(?!\.\d)`;     // not glued to the right of something

const year = (s) => (s.length === 2 ? 2000 + Number(s) : Number(s));

// Returns {date} | {error:true} (looks like a date but impossible) | null (not a date).
function ymd(y, m, d, strong) {
  if (y < MIN_YEAR || y > MAX_YEAR) return null;
  if (isValidYMD(y, m, d)) return { date: toISO(y, m, d) };
  return strong ? { error: true } : null;
}
function dmy(a, b, y, strong) {
  let d = a, m = b;
  if (m > 12 && d <= 12) [d, m] = [m, d];
  return ymd(y, m, d, strong);
}
function mdy(a, b, y, strong) {
  let m = a, d = b;
  if (m > 12 && d <= 12) [d, m] = [m, d];
  return ymd(y, m, d, strong);
}
// "march 14" with no year -> next time that day comes around (today counts).
function yearless(mon, d, today) {
  const ty = parseISO(today).y;
  for (let y = ty; y <= ty + 8; y++) {
    if (isValidYMD(y, mon, d)) {
      const s = toISO(y, mon, d);
      if (s >= today) return { date: s };
    }
  }
  return null;
}

const PATTERNS = [
  { // 2026-03-14, 2026/3/14, 2026.3.14
    re: new RegExp(String.raw`${NB}(\d{4})([-/.])(\d{1,2})\2(\d{1,2})\.?${NA}`, 'gi'),
    resolve: (m) => ymd(+m[1], +m[3], +m[4], true),
  },
  { // 14.3.2026  14. 3. 2026  14.3.2026.
    re: new RegExp(String.raw`${NB}(\d{1,2})\.[ ]?(\d{1,2})\.[ ]?(\d{4})\.?${NA}`, 'gi'),
    resolve: (m) => dmy(+m[1], +m[2], +m[3], true),
  },
  { // 14.3.26 (short year: only if it is a real date, otherwise left alone)
    re: new RegExp(String.raw`${NB}(\d{1,2})\.(\d{1,2})\.(\d{2})\.?${NA}`, 'gi'),
    resolve: (m) => dmy(+m[1], +m[2], year(m[3]), false),
  },
  { // 14-3-2026
    re: new RegExp(String.raw`${NB}(\d{1,2})-(\d{1,2})-(\d{4})${NA}`, 'gi'),
    resolve: (m) => dmy(+m[1], +m[2], +m[3], true),
  },
  { // 3/14/26  3/14/2026
    re: new RegExp(String.raw`${NB}(\d{1,2})/(\d{1,2})/(\d{4}|\d{2})${NA}`, 'gi'),
    resolve: (m) => mdy(+m[1], +m[2], year(m[3]), m[3].length === 4),
  },
  { // march 14  march 14th, 2026  mar. 14
    re: new RegExp(String.raw`(?<!\w)(${MONTH_RE})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?!\w)(?:,?\s+(\d{4})(?![\w/:-]))?`, 'gi'),
    resolve: (m, today) => {
      const mon = MONTHS[m[1].toLowerCase()];
      return m[3] ? ymd(+m[3], mon, +m[2], true) : yearless(mon, +m[2], today);
    },
  },
  { // 14 march  14th of march 2026
    re: new RegExp(String.raw`${NB}(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s+(${MONTH_RE})(?!\w)\.?(?:,?\s+(\d{4})(?![\w/:-]))?`, 'gi'),
    resolve: (m, today) => {
      const mon = MONTHS[m[2].toLowerCase()];
      return m[3] ? ymd(+m[3], mon, +m[1], true) : yearless(mon, +m[1], today);
    },
  },
  { // today / tomorrow
    re: new RegExp(String.raw`(?<!\w)(today|tomorrow)(?![\w'’-])`, 'gi'),
    resolve: (m, today) => ({ date: m[1].toLowerCase() === 'today' ? today : addDays(today, 1) }),
  },
  { // in 3 days / in 2 weeks
    re: new RegExp(String.raw`(?<!\w)in\s+(\d{1,3})\s+(days?|weeks?)(?!\w)`, 'gi'),
    resolve: (m, today) => ({ date: addDays(today, +m[1] * (m[2].toLowerCase().startsWith('w') ? 7 : 1)) }),
  },
];

// Remove the matched date and tidy what's left ("See dentist on" -> "See dentist").
function clean(text, index, len) {
  let left = text.slice(0, index);
  const right = text.slice(index + len);
  left = left.replace(/(?:^|\s)(?:on|by|due|until|@)\s*:?\s*$/i, '').replace(/[\s,;:]+$/, '');
  return `${left} ${right}`
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?)])/g, '$1')
    .trim();
}

// First date-like thing in the text:
//   null | { error, index, raw } (looks like a date but impossible) | { date, index, len }
function findDate(text, today) {
  const cands = [];
  for (const p of PATTERNS) {
    for (const m of text.matchAll(p.re)) cands.push({ m, p, index: m.index, len: m[0].length });
  }
  cands.sort((a, b) => a.index - b.index || b.len - a.len);
  for (const c of cands) {
    const r = c.p.resolve(c.m, today);
    if (!r) continue;
    const raw = c.m[0].replace(/\s+$/, '');
    if (r.error) return { error: true, index: c.index, raw };
    return { date: r.date, index: c.index, len: raw.length };
  }
  return null;
}

// -> { text, date: 'YYYY-MM-DD' | null, error: string | null }
function extractDate(text, today) {
  const f = findDate(text, today);
  if (!f) return { text: text.trim(), date: null, error: null };
  if (f.error) return { text, date: null, error: `Not a real date: "${f.raw}"` };
  return { text: clean(text, f.index, f.len), date: f.date, error: null };
}

// A full date written exactly at the start of `text` (used right after > and @).
//   null | { error, raw } | { date, len }
function dateAtStart(text, today) {
  const f = findDate(text, today);
  if (!f || f.index !== 0) return null;
  return f.error ? { error: true, raw: f.raw } : { date: f.date, len: f.len };
}

// ---- weekday helpers (used by the > and @ symbols) --------------------------
const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const weekdayOf = (name) => WEEKDAY_KEYS.indexOf(name.slice(0, 3).toLowerCase());

// The nearest date on or after `from` that falls on weekday `wd` (0 = Sunday).
function nextWeekday(from, wd) {
  return addDays(from, (wd - weekdayIndex(from) + 7) % 7);
}

// The latest date on or before `to` (and not before `from`) that falls on `wd`, or null.
function latestWeekday(from, to, wd) {
  const d = addDays(to, -((weekdayIndex(to) - wd + 7) % 7));
  return d >= from ? d : null;
}

const isWorkday = (s) => { const w = weekdayIndex(s); return w >= 1 && w <= 5; };

// "5" for a date in the same month as `ref`, "5 Nov" otherwise, always with the weekday.
function shortDay(s, ref) {
  const { m, d } = parseISO(s);
  const sameMonth = ref && parseISO(ref).m === m;
  return `${DAY_SHORT[weekdayIndex(s)]} ${d}${sameMonth ? '' : ` ${MONTH_SHORT[m - 1]}`}`;
}

module.exports = {
  todayISO, addDays, weekdayIndex, fullWeekday, dateLabel, longDate, extractDate, parseISO, isValidYMD,
  dateAtStart, yearless, weekdayOf, nextWeekday, latestWeekday, isWorkday, shortDay, MONTH_RE,
  DAY_SHORT, MONTH_FULL, diffDays, daysInMonth, mondayIndex, addMonths, relativeDays,
  weekStart, isoWeek, weekRangeLabel,
};
