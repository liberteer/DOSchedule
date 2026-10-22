'use strict';
// The > (deadline) and @ (work day) symbols.
//
//   x!!! Write report >fri @wed @thu       deadline Fri, work Wed + Thu
//   x Write report >fri @wed,thu           same, comma list (no spaces)
//   x Write report >fri @wed-thu           weekday range (Mon-Fri only)
//   x Write report >fri @2d                the 2 working days before the deadline
//   x Gym @mon,wed,fri                     no ">": the deadline is the last work day
//
// A symbol only counts at the start of a word and only if a date follows it; otherwise it stays
// ordinary text ("bob@example.com", "@john", "a>b"). Weekday names and year-less numbers
// like "16.10." are safe here because the symbol states the intent.

const {
  addDays, dateAtStart, yearless, weekdayOf, nextWeekday, latestWeekday, isWorkday, parseISO, isValidYMD,
} = require('./dates');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const WD = String.raw`(?:monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat|sunday|sun)`;
const RE_RANGE = new RegExp(String.raw`^(${WD})-(${WD})(?![a-z])`, 'i');
const RE_WEEKDAY = new RegExp(String.raw`^(${WD})(?![a-z])(?:\+(\d{1,2})w(?![a-z\d]))?`, 'i');
const RE_WORDS = /^(today|tomorrow)(?![\w'’-])/i;
const RE_PLUS = /^\+(\d{1,3})([dw])(?![a-z\d])/i;
const RE_COUNT = /^(\d{1,2})d(?![a-z\d])/i;
const RE_DOTS = /^(\d{1,2})\.(\d{1,2})\.(?![\w.])/;   // "16.10." with its last dot: ">9.5" is a number, not a date
const RE_SLASH = /^(\d{1,2})\/(\d{1,2})(?![\w/])/;

// One date expression at the start of `rest` -> { len, node } | { error } | null
//   node = { date } (already known) | { wd, plus } (a weekday, resolved later)
function parseDateExpr(rest, today) {
  let m = RE_WEEKDAY.exec(rest);
  if (m) return { len: m[0].length, node: { wd: weekdayOf(m[1]), plus: m[2] ? Number(m[2]) : 0 } };
  m = RE_WORDS.exec(rest);
  if (m) return { len: m[0].length, node: { date: m[1].toLowerCase() === 'today' ? today : addDays(today, 1) } };
  m = RE_PLUS.exec(rest);
  if (m) return { len: m[0].length, node: { date: addDays(today, Number(m[1]) * (m[2].toLowerCase() === 'w' ? 7 : 1)) } };
  const full = dateAtStart(rest, today);
  if (full) return full.error ? { error: `Not a real date: "${full.raw}"` } : { len: full.len, node: { date: full.date } };
  m = RE_DOTS.exec(rest);
  if (m) {
    const r = yearlessDM(Number(m[1]), Number(m[2]), today);
    if (r) return { len: m[0].length, node: { date: r } };
  }
  m = RE_SLASH.exec(rest);
  if (m) {
    let [mo, d] = [Number(m[1]), Number(m[2])];
    if (mo > 12 && d <= 12) [mo, d] = [d, mo];
    const r = yearlessDM(d, mo, today);
    if (r) return { len: m[0].length, node: { date: r } };
  }
  return null;
}

function yearlessDM(d, m, today) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const r = yearless(m, d, today);
  return r ? r.date : null;
}

// One item of an @ list at the start of `rest`.
function parseWorkItem(rest, today) {
  let m = RE_COUNT.exec(rest);
  if (m) return { len: m[0].length, item: { count: Number(m[1]) } };
  m = RE_RANGE.exec(rest);
  if (m) return { len: m[0].length, item: { from: weekdayOf(m[1]), to: weekdayOf(m[2]), raw: m[0] } };
  const e = parseDateExpr(rest, today);
  if (!e) return null;
  if (e.error) return e;
  return { len: e.len, item: { ...e.node, raw: rest.slice(0, e.len) } };
}

// Find every > / @ token. -> { tokens: [{ start, end, kind: '>'|'@', ... }], error? }
function scan(text, today) {
  const tokens = [];
  const re = /(?<=^|\s)([>@])(?=\S)/g;
  let m;
  while ((m = re.exec(text))) {
    const start = m.index;
    const sym = m[1];
    let pos = start + 1;
    if (sym === '>') {
      const e = parseDateExpr(text.slice(pos), today);
      if (!e) continue;
      if (e.error) return { error: e.error };
      tokens.push({ kind: '>', start, end: pos + e.len, node: e.node, raw: text.slice(start, pos + e.len) });
      re.lastIndex = pos + e.len;
    } else {
      const items = [];
      for (;;) {
        const it = parseWorkItem(text.slice(pos), today);
        if (!it) break;
        if (it.error) return { error: it.error };
        items.push(it.item);
        pos += it.len;
        if (text[pos] === ',' && text[pos + 1] && /\S/.test(text[pos + 1])) {
          if (parseWorkItem(text.slice(pos + 1), today)) { pos += 1; continue; }
        }
        break;
      }
      if (!items.length) continue;
      tokens.push({ kind: '@', start, end: pos, items, raw: text.slice(start, pos) });
      re.lastIndex = pos;
    }
  }
  return { tokens };
}

// Weekday given in a > token: the nearest one on/after today, plus whole weeks.
const deadlineFromNode = (n, today) => (n.date ? n.date : addDays(nextWeekday(today, n.wd), 7 * n.plus));

// Working days (Mon-Fri) from a to b inclusive; the two ends are always kept.
function span(a, b) {
  const out = [];
  for (let d = a; d <= b; d = addDays(d, 1)) if (d === a || d === b || isWorkday(d)) out.push(d);
  return out;
}

// Turn the @ items into dates. `deadline` may be null (then weekdays count forward from today).
function resolveWork(items, deadline, today) {
  const dates = [];
  const pick = (wd, plus, raw) => {
    if (plus) return addDays(nextWeekday(today, wd), 7 * plus);
    if (!deadline) return nextWeekday(today, wd);
    const d = latestWeekday(today, deadline, wd);
    if (!d) {
      throw new Error(nextWeekday(today, wd) > deadline
        ? `${DAY_NAMES[wd]} is after the deadline (@${raw})`
        : `No ${DAY_NAMES[wd]} between today and the deadline (@${raw})`);
    }
    return d;
  };
  for (const it of items) {
    if (it.count !== undefined) {
      if (!deadline) throw new Error(`@${it.count}d needs a deadline: add >friday (or another date)`);
      const days = [];
      for (let d = addDays(deadline, -1); d >= today && days.length < it.count; d = addDays(d, -1)) {
        if (isWorkday(d)) days.push(d);
      }
      if (days.length < it.count) {
        throw new Error(days.length
          ? `Only ${days.length} working day${days.length === 1 ? '' : 's'} left before the deadline (@${it.count}d)`
          : `No working days left before the deadline (@${it.count}d)`);
      }
      dates.push(...days);
    } else if (it.from !== undefined) {
      const a = pick(it.from, 0, it.raw);
      let b = pick(it.to, 0, it.raw);
      if (!deadline && b < a) b = addDays(b, 7);
      if (b < a) throw new Error(`Range runs backwards: @${it.raw}`);
      dates.push(...span(a, b));
    } else if (it.date) {
      dates.push(it.date);
    } else {
      dates.push(pick(it.wd, it.plus, it.raw));
    }
  }
  return dates;
}

function stripTokens(text, tokens) {
  let out = text;
  for (const t of [...tokens].sort((a, b) => b.start - a.start)) out = out.slice(0, t.start) + out.slice(t.end);
  return out.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?)])/g, '$1').trim();
}

// -> { text, deadline: 'YYYY-MM-DD' | null, work: [dates before the deadline], error }
// deadline === null means no symbol produced a date (text is unchanged apart from trimming).
function extractSchedule(text, today) {
  const none = { text: text.trim(), deadline: null, work: [], error: null };
  const sc = scan(text, today);
  if (sc.error) return { ...none, error: sc.error };
  const { tokens } = sc;
  if (!tokens.length) return none;

  const deadlines = tokens.filter((t) => t.kind === '>');
  if (deadlines.length > 1) return { ...none, error: 'Only one deadline (>) per task' };

  try {
    let deadline = deadlines.length ? deadlineFromNode(deadlines[0].node, today) : null;
    const items = tokens.filter((t) => t.kind === '@').flatMap((t) => t.items);
    let work = resolveWork(items, deadline, today);
    if (!deadline) {
      if (!work.length) return none;
      deadline = work.reduce((a, b) => (b > a ? b : a));
    }
    if (work.some((d) => d > deadline)) {
      const late = work.filter((d) => d > deadline)[0];
      throw new Error(`Work day ${late} is after the deadline ${deadline}`);
    }
    work = [...new Set(work)].filter((d) => d < deadline).sort();
    const p = parseISO(deadline);
    if (!isValidYMD(p.y, p.m, p.d)) throw new Error('Deadline is outside the supported years (1970-2099)');
    return { text: stripTokens(text, tokens), deadline, work, error: null };
  } catch (err) {
    return { ...none, error: err.message };
  }
}

module.exports = { extractSchedule };
