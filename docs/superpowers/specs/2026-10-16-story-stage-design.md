# Story stage for story-video: design

Date: 2026-10-16. Status: approved in chat (method v2); built in `story.md` 2026-10-21.

## Problem

Reel scripts read like fact lists ("In 2023 we did X. In 2024, Y."): no point of view, no tension, every reel shaped like a timeline, one draft. The root cause is upstream: research produces dates and counts, never moments, and nothing stops a script from being built on stats alone.

## Goal

A story stage that runs after research and before `scenes.json`, so each video is built on one real, consented moment, opens a question that moment answers, and is written to be sent to a friend. Success: a real reel rewritten through the stage beats its first draft side by side (owner's judgement), with no invented or embellished claim.

## Files

| File | Change |
| --- | --- |
| `story-video/story.md` (new, ~120 lines, any topic) | The method below, one worked example, credits |
| `story-video/SKILL.md` | §4 Steps: new step 0 "Run `story.md`; it writes `<project>/script.md`". Deliver list: add `script.md` |
| `<project>/script.md` (per video) | Working file: brief, story bank, hooks, beats, draft, checks. Reviewed by the owner before any render |

Out of scope: social captions and posts, template or build code, a scoring script.

## Method (`story.md`)

**Rule 1, stated first: no moment, no script.** A video is built on one specific moment. Numbers back the moment up; they never stand in for it.

0. **Brief and format.** Exact viewer; who they would send it to and why; the feeling; language (the viewer's; captions match the voice; a second-language script is written, not translated); format (narrated, POV text-only, members' own clips, countdown); shape (one night in detail, countdown, question then answer); length (≤120 words for a reel).
1. **Story bank (gate).** Each moment: who, when and where, what they wanted, what got in the way, one sensory detail, source, and a tag: `verified` (a record), `owner-told`, or `needs source`. People in it carry a consent tag: `anonymous` (default), `name OK`, `photo OK`. With no `owner-told` or `verified` moment, stop and ask the owner. Never invent; an added detail ("the crowd went wild") on top of a count is invention.
2. **Three hooks.** Each opens a question that a real moment, not a stat, answers. Read them aloud; keep one. For the winner only, write the three layers: first frame that works muted (≤6 words of overlay, a face or crowd over an object), spoken line, overlay that carries the other half of the question.
3. **Beats.** Four to six, linked by *but* / *therefore* (an "and then" link means a beat goes). A point of view that acts: one fan, or "we" against something (the clock). One peak told in detail instead of a chronology. Room for a loss when there was one. The last line may echo the hook (tiebreaker, not a gate). Each beat notes what is on screen, so voice and screen do different jobs.
4. **One draft, read aloud, and four questions.** Stops a fan in 2 s with sound off? True, sourced, consented, and only this club could say it? Who would a fan send it to? Would the member it is about be proud? Then an AI-tells pass. A Bangla script is written, not translated. A weak answer means rewrite before `scenes.json`.

Close on a question or a send ("send this to who's staying up"), not "tag them": Meta demotes engagement bait.

**Worked example:** a neutral one (no real club or brand): a stat-run draft as *bad* (timeline of numbers, an embellished detail, an unverified count, a date mismatch) and its rewrite through steps 0–4 as *good*.

**Credits (MIT):** transitive-bullshit/skills `storytelling` (logline, but/therefore, revealing moment over chronology); yaxeen/storytelling-skills `storytelling-hooks` (levers, three hook layers, the right viewer, bookend); arhamhi/hooksmith (payoff justifies the setup, never invent proof). Panel review 2026-10-16 (story editor, short-form editor, fan lens).

## Neutral core, personal layers

`story.md` stays neutral: any topic, any brand. Anything specific to one organisation (voice, consent habits, data sources, places, series formats) lives in that project's own skill, which runs the stage with its own layer on top. Such layers are specified and built in their own repos.

## Testing

Rewrite one real reel through the stage: `script.md`, then `scenes.json`, then a free-voice build. Compare old and new cuts with the owner. Every line in the new script traces to research, an owner answer, or is cut. (Done once by hand, 2026-10-16, on a reel in a separate project; it worked.)
