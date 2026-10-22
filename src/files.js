'use strict';
// Saving a file without ever leaving a half-written or emptied one behind.
//   1. the new content goes to "<file>.tmp" first: if that fails (a full disk, say), the real file is untouched;
//   2. the temporary file then replaces the real one. A sync client may hold the file for a moment, so this is
//      tried a few times; only then is the file written in place, and if even that fails the old content is
//      put back.

const fs = require('fs');

const LOCKED = new Set(['EPERM', 'EACCES', 'EBUSY']);   // what Windows says while another program holds the file
const TRIES = 5;
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const removeQuietly = (file) => { try { fs.unlinkSync(file); } catch { /* already gone */ } };

// The bytes of a file, or null when there is no such file.
function readBytes(file) {
  try { return fs.readFileSync(file); } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

// Step 1. -> the temporary file. Throws (and leaves no temporary file) if it cannot be written completely.
function writeTemp(file, body) {
  const tmp = `${file}.tmp`;
  try { fs.writeFileSync(tmp, body, 'utf8'); } catch (err) { removeQuietly(tmp); throw err; }
  return tmp;
}

// Step 2. `before` = the bytes the file had (null: it did not exist), put back if the last resort fails.
function replaceWith(tmp, file, body, before) {
  for (let i = 1; ; i++) {
    try { fs.renameSync(tmp, file); return; } catch (err) {
      if (LOCKED.has(err.code) && i < TRIES) { pause(50); continue; }
      removeQuietly(tmp);                     // (also frees the room the direct write below needs)
      if (!LOCKED.has(err.code)) throw err;
      try { fs.writeFileSync(file, body, 'utf8'); return; } catch (err2) {
        try { if (before) fs.writeFileSync(file, before); else removeQuietly(file); } catch { /* nothing more to try */ }
        throw err2;
      }
    }
  }
}

// Both steps, for a single file.
function saveFile(file, body) {
  const before = readBytes(file);
  replaceWith(writeTemp(file, body), file, body, before);
}

module.exports = { readBytes, writeTemp, replaceWith, removeQuietly, saveFile };
