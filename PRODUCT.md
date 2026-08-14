# AI Form Filler — Product truth

## What it is

A Chrome extension that fills any web form — job applications, Google Forms, event
registrations, ATS portals — from a personal knowledge base, in the user's own writing voice.

## The unique mechanism

Every competing autofiller (Simplify Copilot, JobFill, LazyApply, Teal) maps a **fixed profile
schema** onto known ATS field names. They answer "email" and "phone" and stop.

This one ingests arbitrary material about a person — resume, portfolio site, transcripts,
GitHub, pasted notes — structures it into facts, **inferred preferences**, and writing samples,
then answers *any* question a form asks. Including the judgement calls: "would you like to hear
about future events?", "which topics interest you?", "why do you want to work here?"

It answers those the way the user would, and says so.

## Audience and scene

One person, alone, mid-task, on someone else's website. Usually job hunting — which means
doing this repeatedly, under mild dread, on a laptop, often late. The form is the obstacle
between them and the thing they want. They are not here to admire an interface.

## The surface

A 400px Chrome side panel, docked beside the form. It is never the main event — the form is.
The panel is a control surface and a receipt.

Four jobs:
1. **Sign in** and show plan/quota (50 forms/month free)
2. **Feed it** — upload a PDF, paste a link, paste text
3. **Check what it knows** — identity fields that answer questions with no model call
4. **Fill, and account for it** — what was filled, what was a judgement call, what was skipped

## The one thing the UI must make legible

**The difference between a stated fact and a judgement call.**

A wrong-but-confident answer on a job application is worse than a blank field. The product's
entire trust model rests on the user being able to see, at a glance, which answers came from
what they told it and which came from what it concluded about them.

## Constraints

- 400px wide, variable height, docked. Never full-screen.
- Dark and light both real — it sits beside whatever site the user is on.
- Content is unpredictable: 0 sources or 20; 3 fields or 34; answers 2 words or 900 characters.
- Latency is real: a fill takes 10–20 seconds. Waiting must not feel broken.
- Tailwind v4, React 19, tokens already in `src/assets/tailwind.css`.

## Brand commitments

None inherited. No logo, no brand palette, no existing identity to preserve. The current look
is an untuned developer shell and is explicitly **anti-reference**, not authority.

## What must not change

Product truth: the tier system (0–3), the quota model, the source kinds, the inferred flag,
the four jobs above. Function and copy meaning stay; their expression is open.
