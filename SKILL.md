---
name: story-video
description: Use when the user wants a topic explained or taught (an explainer, "help me understand X", a learning page), or wants a narrated vertical video, reel, story or short (9:16, 1080x1920) about a project, event, history or milestone.
---

# story-video

## Overview

Understanding climbs a ladder of four forms: **plain writing → one diagram → an interactive page → a narrated video**. Each form is built from the one below and must make the idea clearer, not prettier. Show a concrete case first, name it second. If a detail is missing, decide and continue.

Everything for one piece lives in a project folder (any path): `explanation.md`, `diagram.svg`, `page.html`, `scenes.json`, `photos/`, optional `logo.png` and `music.mp3`, and the build output in `out/`. `<skill>` below means this skill's folder.

**Pick a mode**
- **Explain** (default for "explain / teach X"): all four forms.
- **Just enough** (when asked to keep it light): write first; add the next form only if the idea is still not clear.
- **Reel** (the story is already known, the user wants a video): go straight to the video.

## 1. Writing → `explanation.md`

Write in controlled English, a softened form of ASD-STE100: short sentences in active voice, one statement each, the same word for the same thing every time, each term defined before its first use. Keep facts, assumptions and examples visibly apart. No hype.

Walk the reader through: the question → what they already know → what goes wrong → how it works → what happens as a result → the usual wrong belief → why it matters → a short recap.

Deliver: a one-line goal, the explanation (body 150–250 words), five facts, three defined terms, one common misconception, one example (real, or clearly labelled as made up), and sources for every claim. For general practice with no single source, cite reference pages and write "many …" rather than claim it is universal. The diagram's alt text, relationship list and accessibility notes go in this file too.

**Check:** someone skimming finds the main idea within 20 seconds. If not, rewrite.

## 2. Diagram → `diagram.svg`

Choose the shape that fits the idea (flow, states, system map, timeline, comparison, layers, cause and effect) and draw only one. It reads in one direction, has no more than seven main parts, every arrow means one named thing, labels make sense without narration, and it still works in grayscale. Ship the SVG, alt text, and a list of the relationships it shows.

The same SVG feeds the page and the video, so: transparent background, at least 5% margin inside the `viewBox`, `id`s on anything the page changes, real `<text>`, plus `<title>` and `<desc>`.

**Motion (video):** the video inlines SVGs, so tagged parts build up in step with the narration. Times are seconds from the scene start:
- `data-in="2.4"`: fades in (rising slightly) at 2.4 s. Put it on a `<g>` to move a group.
- `data-out="6"`: fades out at 6 s.
- `class="draw"` on a `path`, `line`, `polyline`, `rect` or `circle`: the stroke traces itself from `data-in` over `data-dur` (default 0.8 s). Arrowheads fade in with it.

Time each part to the word that introduces it: draft once, read the scene's start and narration length in `out/storyboard.md`, place times by word position, re-render. Keep a static copy for the page and for recap scenes. Untagged SVGs are shown whole.

**Check:** after one glance, a viewer can say the main relationship out loud.

## 3. Interactive page → `page.html`

One self-contained responsive file: semantic HTML, visible focus, respects `prefers-reduced-motion`, no needless libraries. It holds the opening question, the diagram, the explanation revealed step by step, **one** interaction, a reset, a text-only alternative and a recap. The interaction moves one real input, makes the mechanism visible, puts two states side by side and says why they differ. Controls that teach nothing do not belong.

**Check:** usable on a phone and a desktop, by keyboard alone, at the smallest, typical and largest input, after many resets, and still teaches with motion turned off.

## 4. Video → `out/<folder>.mp4`

An explainer runs 60–90 s: about 140–200 spoken words over 5–7 scenes. Reels can be shorter. Arc: hook → a situation the viewer knows → the problem made visible → how it works → the turn → what follows → recap. Diagram parts build up with the narration (see Motion); page states become before/after scenes. Narration at 125–145 words per minute, one idea per sentence; the screen supports the voice rather than repeating it word for word.

**Steps**
1. Write `scenes.json` (below). Put images, including `diagram.svg`, in `photos/`.
2. Draft for free: `VOICE=say node <skill>/build.mjs <project>`. `say` pacing is rough; `SAY_RATE` (default 120) and `SAY_VOICE` (default Daniel) tune it, and `out/storyboard.md` shows each scene's wpm.
3. Review `out/sheet.jpg` (per scene: fading in, settled, fading out): fix overflow, collisions, weak contrast, muddy half-faded frames. Read `out/storyboard.md` (timecodes, narration, on-screen text, wpm). Watch the mp4.
4. Final: the same command without `VOICE=say`. Fix any scene it reports outside 125–145 wpm and rebuild.

### scenes.json

```json
{
  "theme": "light",
  "music": "Instrumental, warm and curious, light piano and pizzicato strings. No vocals. Sits under narration.",
  "scenes": [
    { "id": "hook", "purpose": "Make the viewer ask why",
      "vo": "The shop says only three left. But ten are on the shelf.",
      "kicker": "The question", "title": "Only <em>3</em> left?", "sub": "Ten are on the shelf." }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `theme` | `"light"` (paper, charcoal, coral) for explainers. Omit for dark |
| `colors` | Override theme colors: `bg`, `ink`, `muted`, `kicker`, `accent`, `line`, `scrim` |
| `music` | ElevenLabs Music prompt, generated once into `music.mp3`. Omit for voice only, or supply your own `music.mp3` |
| `pronounce` | Respellings for the voice, e.g. `{ "Peña": "Penya" }` |
| `id`, `purpose` | Scene name and what the viewer should understand after it (storyboard) |
| `vo` | Narration. Write numbers and dates the way they are spoken |
| `kicker` | Small mono line above the title |
| `title` | HTML, about three short words. `<em>` = accent italic; `<span data-count="110">110</span>` counts up |
| `sub` | Plain line under the title |
| `photos` | Paths relative to `photos/` (jpg, png, svg); `../diagram.svg` reuses the root diagram without a copy. Several crossfade. SVGs render as images, so they use system fonts |
| `fit: "contain"` | Whole image on a light card: diagrams, documents |
| `pos` | CSS `object-position`, e.g. `"center 22%"` to keep faces in frame |
| `bleed: true` | Image fills the frame behind a scrim |
| `logo: true` | Show `logo.png` from the project folder above the text |
| `poster: true` | This scene's settled frame becomes `out/poster.jpg` and frame 0 (the thumbnail). Default: last scene |
| `year` | Draws a timeline across the scenes' years. Omit for no timeline |

**Layout:** with an image, a card fills the upper half and the text sits below it; without one, the text is centred alone (looks sparse, give most scenes an image); `bleed` puts the text over a full-frame image.

**Own template:** a project `index.html` replaces the template. It must define `window.setup({ scenes, base, theme, colors })` (scenes carry `start` and `dur` in seconds; `base` is the project folder URL; may be async) and `window.render(t)`, which draws the frame at `t` seconds as a pure function of time.

## Look

Explainers: a light editorial page: cream paper, charcoal ink, one coral accent, a little teal, monospaced labels, plenty of space. Brand reels: dark theme plus the brand's `colors`. Leave out stock AI gradients, floating particles, glossy 3D, neon interfaces and camera moves without a reason.

## Final review

Check each form alone: the text alone, the diagram alone, the page with motion off, the video muted. All four must leave the same correct picture in the viewer's head. List every mismatch and fix it.

**Deliver:** explanation, diagram (+ source and alt text), `page.html`, `out/storyboard.md`, the mp4 and `out/poster.jpg`, accessibility notes, and the folder listing. A concept, moodboard or mockup is not a delivery.

## Common mistakes

- **Paying for every draft:** each build wipes `out/` and re-voices every scene. Draft with `VOICE=say` (macOS), use ElevenLabs once at the end.
- **Overwriting a good render:** copy `out/<folder>.mp4` aside before rebuilding.
- **Music too short after edits:** delete `music.mp3` to regenerate at the new length (paid).
- **Guessed facts:** check claims against the source (code, docs, records) and cite them in `explanation.md`.
