// Where a sentence really ends. A full stop alone isn't enough: "one a.m. back home", "the U.S.",
// "1.5 million" and "vs. Barça" carry stops mid-sentence. Used to voice Kokoro one sentence at a
// time, and for the reframe beats, the hook check and caption breaks.
// Run `node sentences.mjs` for the self-test.
import { fileURLToPath } from "node:url";

const ABBREV = new Set(["a.m.", "p.m.", "dr.", "mr.", "mrs.", "ms.", "st.", "vs.", "e.g.", "i.e.", "approx.", "no."]);
const CLOSE = /["'”’)»]+$/;

// `word` ends a sentence when it ends in . ! ? or । (closing quotes allowed), it isn't a known
// abbreviation or an initialism (U.S., J.), and the next word doesn't start in lower case.
// The last word of a line always ends one.
export function endsSentence(word, next) {
  if (next == null) return true;
  const w = word.replace(CLOSE, "");
  if (w.endsWith("।")) return true;
  if (!/[.!?]$/.test(w)) return false;
  if (w.endsWith(".") && (ABBREV.has(w.toLowerCase()) || /^(\p{Lu}\.)+$/u.test(w))) return false;
  return !/^["'“‘(«¿¡]*\p{Ll}/u.test(next);
}

// `text` cut into sentences: [{ index, text }], each text keeping its trailing space.
export function sentences(text) {
  const out = [], words = [...text.matchAll(/\S+\s*/g)];
  let start = null;
  words.forEach((m, k) => {
    start ??= m.index;
    if (endsSentence(m[0].trim(), words[k + 1]?.[0].trim())) {
      out.push({ index: start, text: text.slice(start, m.index + m[0].length) });
      start = null;
    }
  });
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cut = t => sentences(t).map(s => s.text.trim());
  const eq = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
  eq(cut("Kickoff was one a.m. back home. We stayed up."), ["Kickoff was one a.m. back home.", "We stayed up."]);
  eq(cut("Fans in the U.S. watched too. Then Spain."), ["Fans in the U.S. watched too.", "Then Spain."]);
  eq(cut("It drew 1.5 million views. Not bad!"), ["It drew 1.5 million views.", "Not bad!"]);
  eq(cut("Madrid vs. Barça, Dr. Smith said. Who won?"), ["Madrid vs. Barça, Dr. Smith said.", "Who won?"]);
  eq(cut("He said “Go.” Then silence."), ["He said “Go.”", "Then silence."]);
  eq(cut("We met at 2 a.m."), ["We met at 2 a.m."]);
  eq(cut("আমরা জেগে ছিলাম। খেলা শুরু হলো।"), ["আমরা জেগে ছিলাম।", "খেলা শুরু হলো।"]);
  eq(cut("Wait... what happened? Nothing."), ["Wait... what happened?", "Nothing."]);
  eq(cut("¡Hala Madrid! ¿Y nada más?"), ["¡Hala Madrid!", "¿Y nada más?"]);
  const t = "One a.m. back home. Two.";
  eq(sentences(t).map(s => t.slice(s.index, s.index + s.text.length)), sentences(t).map(s => s.text));
  eq(sentences(t).reduce((n, s) => n + s.text.length, 0), t.length);
  console.log("sentences: self-test done");
}
