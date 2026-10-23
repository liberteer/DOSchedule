'use strict';
// Colour emoji are not part of a DOS screen: they are drawn two columns wide, in colour, and would push the
// frame out of line. So they cannot be typed or pasted (keys.js), and any already in a notes file are drawn
// as one "?" (term.js), the old DOS mark for a character it cannot show. The file keeps them.
//
// "Colour emoji" = what is shown as colour emoji by default (Unicode Emoji_Presentation), a symbol turned
// into one by U+FE0F (e.g. a heart followed by it), keycaps, flags, skin tones and joined emoji (families).
// The DOS symbols are NOT colour emoji and stay allowed: smileys, hearts, notes, arrows, blocks, frames.

const PART = String.raw`(?:\p{Regional_Indicator}{1,2}|[#*0-9]\uFE0F?\u20E3|\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F)`;
const MORE = String.raw`(?:\p{Emoji_Modifier}|\uFE0F|\u200D${PART})*`;
const ONE = new RegExp(PART, 'u');
const SEQS = new RegExp(`${PART}${MORE}`, 'gu');
// When typing: an emoji between two spaces takes one of them along ("Party X tonight" -> "Party tonight"),
// and a joiner or U+FE0F left at its end (the rest of it arrives in the next piece of input) goes with it.
const JOINERS = `[${String.fromCodePoint(0x200d, 0xfe0f)}]*`;
const TYPED = new RegExp(`( ?)(?:${PART}${MORE}${JOINERS})+( ?)`, 'gu');

const hasEmoji = (text) => ONE.test(text);

// Text as shown on screen: every emoji (with all its parts) becomes one "?".
const screenText = (text) => (hasEmoji(text) ? text.replace(SEQS, '?') : text);

// The invisible end of an emoji that arrived split over two pieces of input (joiner, U+FE0F, keycap mark).
const LEFTOVER = new RegExp(`^[${String.fromCodePoint(0x200d, 0xfe0f, 0x20e3)}]+`, 'u');

// Text as typed or pasted, without its emoji. -> { text, removed }
function withoutEmoji(text) {
  const rest = text.replace(LEFTOVER, '');
  if (!hasEmoji(rest)) return { text: rest, removed: rest !== text };
  return { text: rest.replace(TYPED, (m, a, b) => (a && b ? ' ' : a || b)), removed: true };
}

module.exports = { hasEmoji, screenText, withoutEmoji };
