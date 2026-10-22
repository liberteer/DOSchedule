#!/usr/bin/env node
'use strict';
// DOSchedule - keyboard-only bullet-journal planner for the terminal, in the style of DOS.
//   node doschedule.js [--data <folder>]      (or set DOSCHEDULE_DIR)
//   node doschedule.js --where                 show which data folder is used, then exit
//   node doschedule.js --reset-folder          forget the folder chosen in the Options (automatic again), then exit
//   node doschedule.js --help

const fs = require('fs');
const os = require('os');
const path = require('path');
const { resolveDataDir, pointerFile, readPointer, pointerProblem, writePointer, isSetUp, isFirstRun, SOURCE_TEXT } = require('./src/datadir');
const { notesIn } = require('./src/chooser');
const { Store } = require('./src/store');
const { App } = require('./src/app');
const { parseKeys } = require('./src/keys');
const { render } = require('./src/ui');

// The folder that holds the program: next to it, a "data" folder switches on portable mode (see datadir.js).
// A single-file build runs from its own executable, so there it is the folder of that file.
function appDir() {
  try { if (require('node:sea').isSea()) return path.dirname(process.execPath); } catch { /* not a single-file build */ }
  return __dirname;
}

const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

// Where things are on this computer: the inputs of resolveDataDir, plus the file that remembers the chosen folder.
const where = () => ({ platform: process.platform, env: process.env, home: os.homedir() });

function dataDir(argv, withPointer = true) {
  const pointer = withPointer ? readPointer(pointerFile(where())) : null;
  return resolveDataDir({ argv, ...where(), appDir: appDir(), isDir, pointer });
}

const HELP = `DOSchedule - a keyboard-only planner for the terminal

  node doschedule.js                  start the planner
  node doschedule.js --data <folder>  keep the notes in another folder (or set DOSCHEDULE_DIR)
  node doschedule.js --where          show which folder holds your notes, then exit
  node doschedule.js --reset-folder   forget the folder chosen in the Options: back to the automatic folder
  node doschedule.js --help           this text

(doschedule.cmd takes the same options.)
Inside the planner, F10 (Options) > Choose notes folder... picks where your notes are saved.

Press ? inside the planner for the keys.`;

// --data must name a folder. Without one it would be quietly ignored, or take the next option as a folder name.
function dataArgProblem(args) {
  const i = args.findIndex((a) => a === '--data' || a.startsWith('--data='));
  if (i < 0) return false;
  const v = args[i] === '--data' ? args[i + 1] : args[i].slice('--data='.length);
  return !v || (args[i] === '--data' && v.startsWith('--'));
}

function main() {
  const { stdin, stdout } = process;
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) { console.log(HELP); return; }
  if (dataArgProblem(args)) {
    console.error('--data needs a folder, for example:   node doschedule.js --data "D:\\My notes"');
    process.exit(1);
  }
  if (args.includes('--reset-folder')) {
    const file = pointerFile(where());
    try { writePointer(file, null); } catch (err) { console.error(`Could not remove ${file}: ${err.message}`); process.exit(1); }
    const auto = dataDir(args, false);
    console.log(`The notes folder is automatic again: ${auto.dir}\n(${SOURCE_TEXT[auto.source]})\nNotes in the folder you had chosen were not touched.`);
    return;
  }
  const { dir, source } = dataDir(args);
  // The file that remembers the chosen folder is damaged: it is unknown where the notes are, so say so
  // instead of opening the automatic folder (--data and DOSCHEDULE_DIR do not need it).
  const damaged = source === 'portable' || source === 'user' ? pointerProblem(pointerFile(where())) : null;
  if (damaged) {
    console.error(`The file that remembers your notes folder is damaged (${damaged}):\n  ${pointerFile(where())}\n` +
      'Start with   node doschedule.js --reset-folder   to go back to the automatic folder (then choose your\n' +
      'folder again in the Options), or with   node doschedule.js --data <folder>   for this run only.');
    process.exit(1);
  }
  if (args.includes('--where')) { console.log(`${dir}\n(${SOURCE_TEXT[source]})`); return; }
  // A folder chosen in the app must still be there (a drive may be missing): never start empty by surprise.
  if (source === 'chosen' && !isDir(dir)) {
    console.error(`The notes folder you chose is not available: ${dir}\n` +
      'Connect it again, or start with   node doschedule.js --reset-folder   to go back to the automatic folder,\n' +
      'or with   node doschedule.js --data <folder>   for this run only.');
    process.exit(1);
  }
  if (!stdin.isTTY || !stdout.isTTY) {
    console.error('DOSchedule needs an interactive terminal.');
    process.exit(1);
  }

  const store = new Store(dir);
  try {
    store.load();
  } catch (err) {
    console.error(`Could not read data folder ${store.dir}: ${err.message}`);
    process.exit(1);
  }
  const app = new App(store);
  const file = pointerFile(where());
  const setUp = isSetUp(file);
  const notes = notesIn(dir).files;
  if (isFirstRun({ source, setUp, notes })) app.startWelcome();                       // never set up, nothing here yet
  else if (source === 'user' && !setUp) { try { writePointer(file, null); } catch { /* try again next time */ } }   // notes already there: no question needed
  app.location = {
    source,
    hasPointer: readPointer(pointerFile(where())) !== null,
    pointerFile: file,
    automatic: () => dataDir(args, false),          // what "automatic" means right now
    platform: process.platform,
    home: os.homedir(),
  };
  app.screen = app.settings.startScreen;   // the "Start with" option

  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    stdout.write(`${'\x1b[0m'}\x1b[?2004l\x1b[?25h\x1b[?1049l`);
    try { stdin.setRawMode(false); } catch { /* already closed */ }
  };
  process.on('exit', restore);
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
  process.on('SIGHUP', () => process.exit(0));
  process.on('uncaughtException', (err) => { restore(); console.error(err); process.exit(1); });

  stdout.write('\x1b[?1049h\x1b]0;DOSchedule\x07\x1b[2J\x1b[?2004h');   // ?2004h: the terminal marks pasted text (see keys.js)
  stdin.setRawMode(true);
  stdin.setEncoding('utf8');
  stdin.resume();

  const draw = () => stdout.write(render(app, stdout.columns || 80, stdout.rows || 24));

  const keyState = {};                       // a pasted text can arrive in several pieces
  stdin.on('data', (chunk) => {
    for (const key of parseKeys(chunk, keyState)) {
      app.handleKey(key);
      if (app.quit) process.exit(0);
    }
    draw();
  });
  stdout.on('resize', () => { app.needsClear = true; draw(); });   // wipe in the scheme's own colour
  setInterval(draw, 30000); // keeps the clock and "today" fresh
  draw();
}

main();
