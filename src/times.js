'use strict';
// Start (and optional end) time of an event, written anywhere in its text:
//   o Dentist 14:30            o Dentist 14:30-15:30
//   o Call 2pm                 o Call 2:30pm-4pm        o Standup at 9:05
// Only events take times; for tasks and notes "14:30" stays ordinary text. Bare numbers
// ("chapter 2", "room 14") never count: a time needs a colon with two minute digits, or am/pm.

// Sticky, so it only matches exactly at the index we ask about.
const TOKEN = /(?:(\d{1,2}):(\d{2})(?:\s?([ap]m))?|(\d{1,2})\s?([ap]m))(?![\w:])/iy;

const pad2 = (n) => String(n).padStart(2, '0');
const hhmm = (minutes) => `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;

// -> null | { len, ok, colon, minutes, raw }   (ok = a real clock time)
function readAt(text, i) {
  TOKEN.lastIndex = i;
  const m = TOKEN.exec(text);
  if (!m) return null;
  const meridiem = (m[3] || m[5] || '').toLowerCase();
  const hour = Number(m[1] !== undefined ? m[1] : m[4]);
  const min = m[2] !== undefined ? Number(m[2]) : 0;
  const ok = min <= 59 && (meridiem ? hour >= 1 && hour <= 12 : hour <= 23);
  const h24 = meridiem ? (hour % 12) + (meridiem === 'pm' ? 12 : 0) : hour;
  return { len: m[0].length, ok, colon: m[1] !== undefined, minutes: h24 * 60 + min, raw: m[0] };
}

function tidy(left, right) {
  const l = left.replace(/(?:^|\s)(?:at|from)\s*$/i, '').replace(/[\s,;:]+$/, '');
  return `${l} ${right}`
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?)])/g, '$1')
    .trim();
}

// -> { text, time: 'HH:MM' | null, end: 'HH:MM' | null, error: string | null }
function extractTime(text) {
  const none = { text, time: null, end: null, error: null };
  const digit = /\d/g;
  let m;
  while ((m = digit.exec(text))) {
    const i = m.index;
    if (i > 0 && /[\w:./-]/.test(text[i - 1])) continue;       // part of a longer number / date
    const a = readAt(text, i);
    if (!a) continue;
    if (!a.ok) {
      if (a.colon) return { ...none, error: `Not a real time: "${a.raw}"` };
      continue;
    }
    let total = a.len;
    let end = null;
    const dash = /^\s*(?:[-–]\s*|to\s+)/i.exec(text.slice(i + a.len));   // 9:00-10:00, 9:00 to 10:00
    if (dash) {
      const b = readAt(text, i + a.len + dash[0].length);
      if (b && !b.ok && b.colon) return { ...none, error: `Not a real time: "${b.raw}"` };
      if (b && b.ok) {
        if (b.minutes <= a.minutes) return { ...none, error: `End time must be after the start: "${a.raw}-${b.raw}"` };
        end = hhmm(b.minutes);
        total += dash[0].length + b.len;
      }
    }
    return { text: tidy(text.slice(0, i), text.slice(i + total)), time: hhmm(a.minutes), end, error: null };
  }
  return none;
}

module.exports = { extractTime };
