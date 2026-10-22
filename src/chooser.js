'use strict';
// File-system helpers for the notes-folder chooser (Options > Choose notes folder). No drawing here.
// Everything is read-only except makeFolder, canWrite (a short-lived test file) and copyNotes, which never
// overwrites and never deletes anything.

const fs = require('fs');
const path = require('path');
const { monthFilesIn } = require('./store');

const DRIVES = '::drives::';            // the virtual "folder" that lists the Windows drives
const pathOf = (platform) => (platform === 'win32' ? path.win32 : path.posix);

// Windows drives that exist ("C:\", "D:\", ...). A: and B: are skipped (slow floppy probes).
function drives(exists = (p) => fs.existsSync(p)) {
  const out = [];
  for (let c = 'C'.charCodeAt(0); c <= 'Z'.charCodeAt(0); c++) {
    const d = `${String.fromCharCode(c)}:\\`;
    if (exists(d)) out.push(d);
  }
  return out;
}

// The folder above `dir`: null at the top. On Windows the parent of a drive root is the drive list.
function parentOf(dir, platform = process.platform) {
  if (dir === DRIVES) return null;
  const up = pathOf(platform).dirname(dir);
  if (up === dir) return platform === 'win32' ? DRIVES : null;
  return up;
}

const hidden = (name, platform) => name.startsWith('.') || (platform === 'win32' && (name.startsWith('$') || name === 'System Volume Information'));

// The sub-folders of `dir`, sorted, preceded by ".." where there is a way up.
// -> { entries: [{ kind: 'up' | 'dir' | 'drive', name, path }], error: string | null }
function listFolder(dir, { platform = process.platform, driveList } = {}) {
  const entries = [];
  if (dir === DRIVES) {
    for (const d of driveList || drives()) entries.push({ kind: 'drive', name: `-${d[0]}-`, path: d });
    return { entries, error: null };
  }
  const up = parentOf(dir, platform);
  if (up !== null) entries.push({ kind: 'up', name: '..', path: up });
  let dirents;
  try { dirents = fs.readdirSync(dir, { withFileTypes: true }); } catch (err) {
    return { entries, error: `Cannot read this folder (${err.code || err.message})` };
  }
  const dirs = [];
  for (const ent of dirents) {
    if (hidden(ent.name, platform)) continue;
    let isDir = ent.isDirectory();
    if (!isDir && ent.isSymbolicLink()) { try { isDir = fs.statSync(path.join(dir, ent.name)).isDirectory(); } catch { isDir = false; } }
    if (isDir) dirs.push({ kind: 'dir', name: ent.name, path: path.join(dir, ent.name) });
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return { entries: entries.concat(dirs), error: null };
}

// Notes in a folder: how many month files, and whether a settings file is there. Never throws.
function notesIn(dir) {
  try { return { files: monthFilesIn(dir).length, settings: fs.existsSync(path.join(dir, 'settings.json')) }; } catch { return { files: 0, settings: false }; }
}

// Can notes be saved there? Creates the folder if needed and writes + removes a tiny test file.
// -> null when fine, else a short reason.
function canWrite(dir) {
  const probe = path.join(dir, `.doschedule-test-${process.pid}`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(probe, 'x');
    fs.unlinkSync(probe);
    return null;
  } catch (err) {
    return `Cannot save notes in this folder (${err.code || err.message})`;
  }
}

// Copy the month files (and settings.json) from one notes folder to another. Files that already exist
// there are left alone; nothing is ever removed or changed in the source.
// -> { copied, kept } counts of month files
function copyNotes(from, to) {
  let copied = 0;
  let kept = 0;
  for (const file of monthFilesIn(from)) {
    const target = path.join(to, path.relative(from, file));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    try { fs.copyFileSync(file, target, fs.constants.COPYFILE_EXCL); copied++; } catch (err) {
      if (err.code === 'EEXIST') kept++; else throw err;
    }
  }
  const settings = path.join(from, 'settings.json');
  if (fs.existsSync(settings)) {
    try { fs.copyFileSync(settings, path.join(to, 'settings.json'), fs.constants.COPYFILE_EXCL); } catch (err) { if (err.code !== 'EEXIST') throw err; }
  }
  return { copied, kept };
}

// A new folder inside `dir`. -> { path } or { error }. An existing folder of that name is simply entered.
function makeFolder(dir, name, platform = process.platform) {
  const clean = name.trim();
  if (!clean) return { error: 'Type a name for the new folder.' };
  if (/[\\/]/.test(clean) || (platform === 'win32' && /[<>:"|?*]/.test(clean)) || clean === '.' || clean === '..') {
    return { error: 'A folder name cannot contain \\ / or the characters < > : " | ? *' };
  }
  const target = path.join(dir, clean);
  try { fs.mkdirSync(target, { recursive: true }); } catch (err) { return { error: `Cannot create it (${err.code || err.message})` }; }
  return { path: target };
}

// What was typed into the "type a path" field -> an absolute path ("~" is your home folder).
function resolveTyped(text, { cwd, home, platform = process.platform }) {
  let t = text.trim().replace(/^"(.*)"$/, '$1');
  if (!t) return null;
  if (t === '~' || t.startsWith('~/') || t.startsWith('~\\')) t = pathOf(platform).join(home, t.slice(1));
  return pathOf(platform).resolve(cwd === DRIVES ? home : cwd, t);
}

// The same folder? (Windows ignores capitals, and a trailing separator makes no difference.)
function sameFolder(a, b, platform = process.platform) {
  const p = pathOf(platform);
  const norm = (x) => { const r = p.resolve(x); return platform === 'win32' ? r.toLowerCase() : r; };
  return norm(a) === norm(b);
}

const isFolder = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

module.exports = { DRIVES, isFolder, drives, parentOf, listFolder, notesIn, canWrite, copyNotes, makeFolder, resolveTyped, sameFolder };
