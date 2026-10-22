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
const { resolveDataDir, pointerFile, readPointer, writePointer, SOURCE_TEXT } = require('./src/datadir');
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

  doschedule                  start the planner
  doschedule --data <folder>  keep the notes in another folder (or set DOSCHEDULE_DIR)
  doschedule --where          show which folder holds your notes, then exit
  doschedule --reset-folder   forget the folder chosen in the Options: back to the automatic folder
  doschedule --help           this text

Inside the planner, F10 (Options) > Choose notes folder... picks where your notes are saved.

Press ? inside the planner for the keys.`;

function main() {
  const { stdin, stdout } = process;
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) { console.log(HELP); return; }
  if (args.includes('--reset-folder')) {
    const file = pointerFile(where());
    try { writePointer(file, null); } catch (err) { console.error(`Could not remove ${file}: ${err.message}`); process.exit(1); }
    const auto = dataDir(args, false);
    console.log(`The notes folder is automatic again: ${auto.dir}\n(${SOURCE_TEXT[auto.source]})\nNotes in the folder you had chosen were not touched.`);
    return;
  }
  const { dir, source } = dataDir(args);
  if (args.includes('--where')) { console.log(`${dir}\n(${SOURCE_TEXT[source]})`); return; }
  // A folder chosen in the app must still be there (a drive may be missing): never start empty by surprise.
  if (source === 'chosen' && !isDir(dir)) {
    console.error(`The notes folder you chose is not available: ${dir}\n` +
      'Connect it again, or start with   doschedule --reset-folder   to go back to the automatic folder,\n' +
      'or with   doschedule --data <folder>   for this run only.');
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
  app.location = {
    source,
    hasPointer: readPointer(pointerFile(where())) !== null,
    pointerFile: pointerFile(where()),
    automatic: () => dataDir(args, false),          // what "automatic" means right now
    platform: process.platform,
    home: os.homedir(),
  };
  app.screen = app.settings.startScreen;   // the "Start with" option

  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    stdout.write(`${'\x1b[0m'}\x1b[?25h\x1b[?1049l`);
    try { stdin.setRawMode(false); } catch { /* already closed */ }
  };
  process.on('exit', restore);
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
  process.on('SIGHUP', () => process.exit(0));
  process.on('uncaughtException', (err) => { restore(); console.error(err); process.exit(1); });

  stdout.write('\x1b[?1049h\x1b]0;DOSchedule\x07\x1b[2J');
  stdin.setRawMode(true);
  stdin.setEncoding('utf8');
  stdin.resume();

  const draw = () => stdout.write(render(app, stdout.columns || 80, stdout.rows || 24));

  stdin.on('data', (chunk) => {
    for (const key of parseKeys(chunk)) {
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
