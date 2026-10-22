'use strict';
// User settings: a small settings.json in the data folder (so it travels with the notes, e.g. via
// Dropbox). Each option lists its allowed values; anything else in the file is ignored.

const fs = require('fs');
const path = require('path');
const { THEMES, THEME_NAMES } = require('./themes');

const SCREEN_CHOICES = [
  { value: 'main', label: 'Main list', desc: 'Start on today\'s list of tasks, events and notes.' },
  { value: 'month', label: 'Month calendar', desc: 'Start on the month calendar.' },
  { value: 'week', label: 'Week calendar', desc: 'Start on the week calendar.' },
];

const NOTE_CHOICES = [
  { value: 0, label: 'today only' },
  { value: 1, label: 'today and yesterday' },
  { value: 3, label: 'last 3 days' },
  { value: 7, label: 'last 7 days', note: ' (default)' },
  { value: 14, label: 'last 14 days' },
  { value: 30, label: 'last 30 days' },
  { value: 3650, label: 'all of them' },
].map((c) => ({ ...c, desc: 'How far back the main list shows notes. The calendars always show every note.' }));

const FRAME_CHOICES = [
  {
    value: 'dos', label: 'DOS lines', note: ' (default)',
    desc: 'Double and single line-drawing characters, as in DOS programs. Needs a terminal font that has them (most do).',
  },
  {
    value: 'ascii', label: 'Plain ASCII',
    desc: 'Only keyboard characters (+ - = | < > ^ v # * 0). For SSH sessions, old consoles or fonts that show ? or boxes, and for pasting into plain text.',
  },
];

const OPTIONS = [
  {
    key: 'theme',
    label: 'Color scheme',
    values: THEME_NAMES.map((n) => ({ value: n, label: THEMES[n].label, desc: THEMES[n].desc })),
  },
  { key: 'frame', label: 'Frame style', values: FRAME_CHOICES },
  { key: 'noteDays', label: 'Notes on the main list', values: NOTE_CHOICES },
  { key: 'startScreen', label: 'Start with', values: SCREEN_CHOICES },
];

// Rows below the options that DO something instead of choosing a value.
const ACTIONS = [
  { key: 'chooseFolder', label: 'Choose notes folder...' },
  { key: 'autoFolder', label: 'Use the automatic notes folder' },
  { key: 'deleteAll', label: 'Delete all data...', danger: true },
];

const DEFAULTS = { theme: 'classic', frame: 'dos', noteDays: 7, startScreen: 'main' };

const fileOf = (dir) => path.join(dir, 'settings.json');

// Missing, unreadable or invalid settings fall back to the defaults, one option at a time.
function loadSettings(dir) {
  const settings = { ...DEFAULTS };
  let raw;
  try { raw = JSON.parse(fs.readFileSync(fileOf(dir), 'utf8')); } catch { return settings; }
  if (!raw || typeof raw !== 'object') return settings;
  for (const o of OPTIONS) {
    if (o.values.some((v) => v.value === raw[o.key])) settings[o.key] = raw[o.key];
  }
  return settings;
}

function saveSettings(dir, settings) {
  fs.mkdirSync(dir, { recursive: true });
  const file = fileOf(dir);
  const tmp = `${file}.tmp`;
  const body = `${JSON.stringify(settings, null, 2)}\n`;
  try {
    fs.writeFileSync(tmp, body, 'utf8');
    fs.renameSync(tmp, file);
  } catch {
    fs.writeFileSync(file, body, 'utf8');   // e.g. file briefly locked by a sync client
  }
}

// The choice currently selected for an option.
const current = (settings, option) => option.values.find((v) => v.value === settings[option.key]) || option.values[0];

module.exports = { OPTIONS, ACTIONS, DEFAULTS, loadSettings, saveSettings, current, fileOf };
