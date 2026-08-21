# Fillaform — Product truth

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
1. **Sign in.** Say nothing about money yet — see below.
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

Product truth: the tier system (0–3), the source kinds, the inferred flag, the four jobs above.
Function and copy meaning stay; their expression is open.

## How it is paid for

There is no free tier. Access is a **14-day trial of Pro** through Dodo's checkout, converting at
$5/month; Ultra is $15.

The unit is an **AI action**: one field an AI answered, or one rewrite. A field resolved from the
user's own saved information — tier 0, no model call — is free and uncounted, which is about a third
of the fields on a real application. Each plan also carries a separate, quieter ceiling on long
answers, because a tier-3 paragraph costs roughly a hundred times a dropdown and is the only thing
that can make a plan unaffordable.

**The panel says nothing about money until the user tries to fill something.** No meter, no badge,
no plan card, no price. They sign in, add a résumé and a few notes, check what it knows — and the
offer arrives when they press Fill, having already done the work. Asking for more room (a sixth
source, a twenty-sixth fact) is the same kind of moment and asks the same way. Once someone has met
the paywall it stays visible, so anyone who said "not now" can still find their way back.
