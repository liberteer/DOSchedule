'use strict';
// Colour schemes.
//
// The screens are written once, in the "classic" palette: light grey (37) on black (40), cyan
// frame (36), bright white headings (97), dim grey (90), red/yellow/green priorities (91/93/92),
// and a blue cursor block (44). A scheme says how to RE-COLOUR that palette:
//   bg      page background                      (a DOS background: 40-47 only)
//   base    default text colour
//   fg      what each classic foreground code becomes ('' drops it, e.g. bold)
//   cursor  { bg } a coloured block, or { reverse: true } reverse video, for the highlighted day
//   dialog  popup window colours as [foreground, background] pairs (used as they are):
//           box (the window), title (warning bar), button (the highlighted button)
//
// DOS rule: only what a DOS text screen could show: 16 foreground colours, 8 background
// colours, bold/bright and reverse. A test checks every scheme for it.

const THEMES = {
  classic: {
    label: 'Classic',
    desc: 'Light grey on black with a cyan frame. The original look.',
    bg: '40', base: '37', fg: {}, cursor: { bg: '44' },
    dialog: { box: ['30', '47'], title: ['97', '41'], button: ['97', '40'] },
  },
  blue: {
    label: 'Blue',
    desc: 'Bright cyan on blue with a white frame, like Norton Commander and Turbo Pascal.',
    bg: '44', base: '96', cursor: { bg: '40' },
    dialog: { box: ['30', '46'], title: ['97', '41'], button: ['97', '44'] },
    fg: { 37: '96', 90: '36', 36: '97' },
  },
  amber: {
    label: 'Amber',
    desc: 'Amber monochrome monitor: one colour in two brightnesses. Priority shows only as ! marks.',
    bg: '40', base: '33', cursor: { reverse: true },
    dialog: { box: ['30', '43'], title: ['93', '40'], button: ['93', '40'] },
    fg: { 37: '93', 90: '33', 36: '33', 97: '93', 92: '93', 91: '93' },
  },
  green: {
    label: 'Green',
    desc: 'Green phosphor monochrome monitor: one colour in two brightnesses. Priority shows only as ! marks.',
    bg: '40', base: '32', cursor: { reverse: true },
    dialog: { box: ['30', '42'], title: ['92', '40'], button: ['92', '40'] },
    fg: { 37: '92', 90: '32', 36: '32', 97: '92', 93: '92', 91: '92' },
  },
  light: {
    label: 'Light',
    desc: 'Black on light grey, for bright rooms. Priorities use dark red, magenta and blue.',
    bg: '47', base: '30', cursor: { reverse: true },
    dialog: { box: ['97', '40'], title: ['97', '41'], button: ['30', '47'] },
    fg: { 1: '', 37: '30', 90: '90', 36: '34', 97: '30', 91: '31', 92: '34', 93: '35' },
  },
};

const THEME_NAMES = Object.keys(THEMES);

module.exports = { THEMES, THEME_NAMES };
