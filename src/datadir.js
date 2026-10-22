'use strict';
// Where DOSchedule keeps its notes and settings. Pure: everything it needs is passed in, so it is testable.
//
// Order (first match wins):
//   1. --data <folder>              on the command line
//   2. DOSCHEDULE_DIR               environment variable
//   3. the folder chosen inside the app (Options > Choose notes folder), remembered in a small file
//      in the per-user folder (see pointerFile)
//   4. a `data` folder next to the program, if one exists (portable mode; also the folder of earlier versions)
//   5. the per-user folder of the system (created on first save; on Windows %APPDATA%\DOSchedule)
//
// "Back to automatic" in the Options removes the remembered choice, which gives 4 and 5 again.

const fs = require('fs');
const path = require('path');

function userDataDir({ platform, env, home }) {
  if (platform === 'win32') return path.win32.join(env.APPDATA || path.win32.join(home, 'AppData', 'Roaming'), 'DOSchedule');
  if (platform === 'darwin') return path.posix.join(home, 'Library', 'Application Support', 'DOSchedule');
  return path.posix.join(env.XDG_DATA_HOME || path.posix.join(home, '.local', 'share'), 'doschedule');
}

// The small file that remembers the folder chosen in the app. It stays in the per-user place (never inside
// the chosen folder, which could be on a drive that is not there), so every way of starting the program finds it.
function pointerFile({ platform, env, home }) {
  if (platform === 'win32') return path.win32.join(env.APPDATA || path.win32.join(home, 'AppData', 'Roaming'), 'DOSchedule', 'folder.json');
  if (platform === 'darwin') return path.posix.join(home, 'Library', 'Application Support', 'DOSchedule', 'folder.json');
  return path.posix.join(env.XDG_CONFIG_HOME || path.posix.join(home, '.config'), 'doschedule', 'folder.json');
}

// The remembered folder, or null (no file, unreadable, or not an absolute path).
function readPointer(file) {
  try {
    const v = JSON.parse(fs.readFileSync(file, 'utf8'));
    return v && typeof v.folder === 'string' && path.isAbsolute(v.folder) ? v.folder : null;
  } catch { return null; }
}

// Remember a folder, or (null) forget it again. Throws if the file cannot be written.
function writePointer(file, folder) {
  if (folder == null) {
    try { fs.unlinkSync(file); } catch (err) { if (err.code !== 'ENOENT') throw err; }
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify({ folder }, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

// -> { dir, source: 'argument' | 'environment' | 'chosen' | 'portable' | 'user' }
function resolveDataDir({ argv = [], env = {}, platform = process.platform, home = '', appDir, isDir = () => false, pointer = null }) {
  const i = argv.findIndex((a) => a === '--data' || a.startsWith('--data='));
  if (i >= 0) {
    const v = argv[i].includes('=') ? argv[i].slice('--data='.length) : argv[i + 1];
    if (v) return { dir: path.resolve(v), source: 'argument' };
  }
  if (env.DOSCHEDULE_DIR) return { dir: path.resolve(env.DOSCHEDULE_DIR), source: 'environment' };
  if (pointer) return { dir: path.resolve(pointer), source: 'chosen' };
  const portable = path.join(appDir, 'data');
  if (isDir(portable)) return { dir: portable, source: 'portable' };
  return { dir: userDataDir({ platform, env, home }), source: 'user' };
}

const SOURCE_TEXT = {
  argument: 'from --data',
  environment: 'from the DOSCHEDULE_DIR variable',
  chosen: 'the folder you chose in the Options',
  portable: 'a "data" folder next to the program',
  user: 'the default folder for your user account',
};

module.exports = { resolveDataDir, userDataDir, pointerFile, readPointer, writePointer, SOURCE_TEXT };
