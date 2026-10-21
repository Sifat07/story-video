# Story stage → `script.md`

Run this before `scenes.json` for any reel or story, and for an explainer built around one event. It turns research into one script the owner reviews before anything is rendered. Research gives dates and counts; this stage finds the moment they belong to.

**Rule 1: no moment, no script.** A video is built on one specific moment: a person, a place, a minute. Numbers back the moment up. They never stand in for it.

## Steps

### 0. Brief

Write down, in one line each:

- **Viewer:** the exact person watching, where, and when (on the bus, the night before the match).
- **Send to:** who they would send it to, and why.
- **Feeling:** what they should feel at the end.
- **Language:** the viewer's language. Captions match the voice. A script in a second language is written in that language, not translated.
- **Format:** narrated, text-only POV, the members' own clips, or a countdown.
- **Shape:** one moment in detail, a countdown, or a question and its answer. Not a timeline.
- **Length:** ≤120 words for a reel.

### 1. Story bank (gate)

List the moments you have. For each: who, when and where, what they wanted, what got in the way, one sensory detail, and the source. One table row per moment; the fields can share one cell.

- **Tag** each moment: `verified` (a record: a document, a photo, a post, a result), `owner-told`, or `needs source`.
- **Consent** for each person in it: `anonymous` (the default), `name OK`, `photo OK`. A face or a name goes on screen only with that person's yes.
- **Gate:** with no `verified` or `owner-told` moment, stop and ask the owner for one. Do not write around the gap.
- **Never invent.** A detail added on top of a fact ("the crowd went wild" on a headcount) is invention. So is a quote nobody said or a message nobody sent.
- List what you left out and why, so the owner can see it.

### 2. Three hooks

Write three opening lines. Each opens a question that a moment from the bank answers, not a stat. Read them aloud; note for each what it opens, what answers it, and its weakness. Keep one.

For the one you keep, write three layers:

- **First frame, muted:** a face or a crowd rather than an object, with ≤6 words of overlay. Most viewers see this frame with the sound off.
- **Spoken line:** the hook itself.
- **Overlay:** the other half of the question, so the frame and the voice need each other.

### 3. Beats

Four to six beats, each one line, with a column for what is on screen. Voice and screen do different jobs.

- **Link with *but* or *therefore*.** An "and then" link means a beat goes.
- **A point of view that acts:** one person, or "we" against something (the clock, the weather, the odds).
- **One peak, told in detail,** instead of a chronology.
- **Room for a loss** when there was one. A story with no risk is an ad.
- The last line may echo the hook, so the reel loops. This is a tiebreaker, not a rule.

### 4. One draft, read aloud

Write it once and read it aloud at speaking pace. Then answer four questions in the file:

1. Does the first frame stop a viewer in 2 s with the sound off?
2. Is every line true, sourced and consented, and could only this group say it?
3. Who would a viewer send it to?
4. Would the person it is about be proud of it?

Then an AI-tells pass: cut "more than just", "here's the thing", rules of three, and lines that would fit any group. A weak answer to any question means rewrite before `scenes.json`.

**Close on a question or a send** ("Send this to whoever runs with you"), not "tag a friend" or "comment below": platforms demote engagement bait. No sign-up line in a reel; it turns the story into an ad.

## `script.md` layout

```markdown
# <title>: script
Status line: what the owner approved, and when.

## 0. Brief            (the seven lines)
## 1. Story bank       | # | Moment | Source | Tag | Consent |   then "Not used: …"
## 2. Hooks            three, one kept, its three layers
## 3. Beats            | Beat | Line (link) | On screen |
## 4. Draft            the narration, then ### Checks (the four questions + AI tells)
## Open                - [ ] each consent or fact still waiting on the owner
```

`scenes.json` is written from section 4. Every narration line traces to a story-bank row, or it is cut.

## Worked example (made up)

A neighbourhood running club, the Riverside Night Runners. Club, people and events are invented for this example.

**Before** (a stat run):

> Founded in 2019, the Riverside Night Runners have grown every year. In 2021 we had 120 members. In 2023 we ran 40 races. Over 500 runners have joined us since. At our tenth anniversary run, the whole street cheered us home. Join us today!

What is wrong: a timeline of numbers with no moment; "the whole street cheered" is added on top of a headcount; "over 500" has no record; a club founded in 2019 has no tenth anniversary; "Join us" turns it into an ad.

**Through the stage:**

- **Brief:** a club member, 25–45, on their phone after work. Sends it to the friend who keeps saying they'll start running. Feeling: nobody gets left behind. ≤120 words.
- **Story bank:** M1, owner-told, anonymous: February 2024, the river-path lights failed mid-run; members switched on phone torches and ran the last 2 km by them. M2, verified (results sheet): that night's last finisher came in 21 minutes after the rest, in their first race. M3, owner-told: nobody went home; the group waited at the line. Not used: member counts (they back nothing here), "500 runners" (no record).
- **Hook kept:** "The lights went out with two kilometres to go." Opens: then what? Answered by M1–M3. Muted first frame: torches bobbing on a dark path, overlay "2 km left. No lights."
- **Beats:** lights out (but) → torches on (therefore) → the pack splits, one runner far behind (but) → nobody leaves the line → the last torch arrives, 21 minutes later (therefore) → close.
- **Draft:**

> The lights went out with two kilometres to go.
> So we ran by phone torch.
> One of us was far behind. First race. Twenty-one minutes behind.
> Nobody went home.
> We stood at the line and watched one torch come down the path.
> Send this to whoever says they're too slow to start.

- **Checks:** muted, the torches and the overlay stop a viewer. Each line traces to M1–M3; the runner stays anonymous. Sent to the friend who hasn't started. The runner would likely be proud, but ask them first: it is their slowest night, told in public.

## Neutral core

This file stays neutral: any topic, any group. An organisation's voice, consent habits, data sources, places and series live in that project's own skill, which runs this stage with its own layer on top.

## Credits

Built from these MIT-licensed skills, adapted rather than copied:

- [transitive-bullshit/skills](https://github.com/transitive-bullshit/skills) `storytelling`: logline, *but* / *therefore*, the revealing moment over chronology.
- [yaxeen/storytelling-skills](https://github.com/yaxeen/storytelling-skills) `storytelling-hooks`: hook levers, the three hook layers, the right viewer, the bookend.
- [arhamhi/hooksmith](https://github.com/arhamhi/hooksmith): the payoff justifies the setup; never invent proof.

Method reviewed by a panel (story editor, short-form editor, fan) on 2026-10-16.
