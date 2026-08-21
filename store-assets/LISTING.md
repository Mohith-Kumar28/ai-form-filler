# Store listing copy

The text half of the Chrome Web Store listing. The artwork is in this directory; these are the
fields you paste into the developer dashboard beside it.

Two of these fields are duplicated in code and must be edited in both places or the listing and
the installed extension will disagree:

| Field | Also lives in | Chrome's limit |
| --- | --- | --- |
| Name | `apps/extension/wxt.config.ts` → `manifest.name` | 75 chars, ~45 visible in search |
| Short description | `apps/extension/wxt.config.ts` → `manifest.description` | 132 chars |
| Detailed description | here only | 16,000 chars |
| Permission justifications | derived from `manifest.permissions` | 1,000 chars each |

The justifications at the bottom of this file are keyed to the permissions the manifest actually
declares. Add or remove one there and the Privacy practices tab changes with it.

## Why "AI" is in every field

"Fillaform" is a coined word with no search volume, and the store ranks substantially on the name
and description fields. The phrase people actually type is **AI form filler**, so it is in the
name, the short description, and the first line of the detailed description.

It is also the honest distinction. Every incumbent in this category is a profile-field mapper:
it copies a saved string into a matching input. This writes answers to questions it has never
seen, from a corpus you gave it. Leading with "form filler" alone sells the commodity half and
buries the part worth paying for.

What stays out: no superlatives, no invented testimonials, no "revolutionary". The claims below
are all things the extension does.

---

## Name

```
Fillaform — AI Form Filler
```

## Short description

```
AI form filler for job applications and any web form. Answers come from your own knowledge base, in your own writing voice.
```

126 characters. Chrome truncates at 132.

## Category

Productivity → Workflow & Planning

## Detailed description

```
Fillaform is an AI form filler that writes real answers — not just your name and email. It reads
the form in front of you, answers every question from your own resume and notes, tells you which
answers it had to guess, and then stops so you can review and submit.

Job applications, Google Forms, registrations, surveys, contact forms — if a page has fields, it
fills them.

Ordinary autofill copies a saved value into a field labelled "name". That covers about a third of
a real application. The rest is questions: why this role, describe a time you disagreed with a
manager, what are you looking for, what is your notice period. Fillaform answers those too,
because it is an AI writing from your own material rather than a lookup table.


━━━ HOW IT WORKS ━━━

1. Tell it about you, once. Drop in your resume, a transcript, a portfolio link, past job
   applications you were happy with — or just talk for a minute and let it listen.
2. Open any form and press Fill, or hit Alt+F without leaving the keyboard.
3. Read what it wrote. Rewrite anything you want in one tap. Press submit yourself.


━━━ IT WRITES THE HARD FIELDS ━━━

The long boxes are the reason this exists. Cover letter paragraphs, "tell us about yourself",
"why do you want to work here", "describe a challenge you overcame" — answered in full sentences,
from things you have actually done, in the way you actually write.

Not a template with your name pasted in. Not a generic cover letter you have to rewrite anyway.
The short fields get auto-filled at the same time, so one press handles the whole form.


━━━ SIX ONE-TAP REWRITES ━━━

Answer nearly right? Fix it without starting over. Every answer can be made:

• warmer          • plainer         • shorter
• more confident  • more formal     • expanded with more specifics

Each rewrite works on the answer you already have, so you refine it rather than rolling the dice
on a fresh one. On Pro you can also just type what to change — "mention the Oracle migration and
keep it under a paragraph".


━━━ IT TELLS YOU WHAT IT GUESSED ━━━

The problem with an AI filling a form you sign is not knowing which parts to trust.

Answers taken straight from something you gave it are left unmarked. Anything inferred gets a
small tag on the field reading "I guessed" or "not sure". Click the tag to read the reasoning,
edit it, or rewrite it. So you check three fields instead of re-reading all forty.


━━━ IT LEARNS HOW YOU WRITE ━━━

Every answer you keep teaches it your voice — sentence length, how formal you are, the words you
use and the ones you never would. The tenth application reads more like you than the first, and
you should not have to correct the same thing twice.


━━━ WHERE IT WORKS ━━━

Purpose-built support, field by field, for the sites people actually apply through:

• Greenhouse
• Lever
• Ashby
• Google Forms

Everything else is handled by a general engine that reads labels the way a person does — so
registrations, surveys, contact forms, grant and visa applications, university and scholarship
applications, event signups and internal HR tools work too. If a page has fields, it fills them.


━━━ FEED IT ANYTHING ━━━

Four ways to add what it knows:

• File — your resume or CV as PDF or Word, plus PowerPoint, Excel, txt, Markdown, CSV, RTF,
  JSON, HTML and ePub. Images too (PNG, JPG, WebP, HEIC, SVG), so a screenshot of a form you
  already filled works. Audio and video as well.
• Link — any URL. LinkedIn, GitHub, a personal site, a portfolio, a job description.
• Note — type or paste. A few lines about what you are looking for goes a long way.
• Voice — hold the mic and talk. It transcribes and files it away.

Then add plain facts by hand for the things no document mentions: notice period, salary
expectation, visa status, references, why you left.


━━━ WHAT IT DOES NOT DO ━━━

• It never submits. It fills the fields and hands the form back to you.
• It does not invent credentials. Asked to write more, it draws on your own notes rather than
  padding with things you never said.
• It does not need a new profile per site. One knowledge base, every form.


━━━ PRIVACY ━━━

Your sources and answers are sent to our servers so the model can use them, and to the model
provider that writes the answer. They are not sold, and they are not used to train models. You
can delete any source, any saved fact, or your entire account from inside the extension.

The extension reads the page you are on only after you ask it to fill something. Nothing is
transmitted until you press Fill.

Full detail: https://fillaform.in/privacy


━━━ WHAT IT COSTS ━━━

Every account starts with a free one-time grant — no card:

• 50 fields filled
• 20 long written answers
• 5 sources, 25 saved facts

Then Pro is $5/month with a 14-day free trial: 600 fields, 150 long answers, 30 sources, files up
to 30 MB. The trial takes a card, nothing is charged until day 15, and cancelling before then
costs nothing. Ultra is $15/month for 2,500 fields and 500 long answers.

Fields answered from information you already gave it are free and never counted — on a real
application that is roughly a third of them.

Current plans: https://fillaform.in/pricing


━━━ COMMON QUESTIONS ━━━

Is it free?
There is a free one-time grant to try it on real forms, with no card. After that it is a paid
plan; the 14-day Pro trial takes a card and charges nothing until day 15.

Does it submit forms by itself?
No. It fills and stops. You read the answers and press submit.

How is this different from Chrome autofill or a password manager?
Browser autofill repeats values you have typed before. This is an AI autofill: it writes answers
to questions it has never seen, using your resume and notes.

Does it write cover letter answers?
Yes — the long "why this company" and "tell us about yourself" boxes are what it is built for.

Do I have to set up a profile for every site?
No. You tell it about yourself once and it works on any form.

What if an answer is wrong?
Edit it in place, or use a one-tap rewrite. What you settle on is what it learns from.

Does it work outside job applications?
Yes. Google Forms, surveys, registrations, grant and visa applications, contact forms — any page
with fields.


Questions or problems: support@fillaform.in
```

### Notes on the shape of it

**Paste it exactly as wrapped.** The dashboard preserves line breaks and renders no markup at
all — no bold, no headings, no links. The `━━━` rules and the bullets are the only structure
available, which is why they carry the section breaks.

**The first three lines are the whole ad.** The store truncates behind a "Read more" fold, and
those lines are also what Google shows in a result. They lead with "AI form filler", say what it
writes, and name the surfaces — job applications, Google Forms, registrations, surveys — before
anything is cut.

**Every claim is checked against the build**, and the numbers come from `PLAN_LIMITS`,
`PLAN_LONGFORM_LIMITS`, `PLAN_SOURCE_LIMITS` and `PLAN_FACT_LIMITS` in `@aff/shared`. The six
rewrites are `REWRITE_TONES` + `REWRITE_LENGTHS` in `packages/shared/src/rewrite.ts`; the four
named sites are the adapters in `packages/form-adapters/`; the file types are the `ACCEPT` list
in `AddSource.tsx`. If any of those change, this description is wrong and needs the same edit.

### Search terms it is written around

Nobody searches "Fillaform". The store matches on the name and description fields, so the copy
places the phrases people actually type, in prose rather than in a keyword list — the store
penalises stuffing, and a list reads as spam to the human deciding whether to install:

`ai form filler` · `form filler` · `autofill` · `ai autofill` · `job application autofill` ·
`cover letter` · `resume autofill` · `google forms` · `greenhouse` · `lever` · `ashby` ·
`application form filler` · `survey` · `registration`

Two are deliberate concessions to search over house style: **resume** rather than CV (roughly ten
times the search volume, and the US store is the bigger market), and **autofill** as one word,
which is how it is typed.

### Before pasting

Check that the pricing block still matches `apps/web/src/lib/site.ts` and the plan constants.
Prices in *text* are fine to state — unlike the artwork, a description is one edit away from
correct — but a stale number here is a complaint from someone who was charged something else.

## Building the upload artifact

```
pnpm zip     # -> apps/extension/build/fillaform-<version>-chrome.zip
```

The filename carries `manifest.version`, and the previous zip is deleted on each run — so the
one file in `apps/extension/build/` is always the one to upload, and its name tells you which
version it is before you open it.

Use this, not a hand-made zip of the build folder. `pnpm zip` sets `STORE_BUILD=1`, which
strips two manifest fields that a local build needs and the store will not take:

- **`key`** — the store rejects the upload outright with *"key field is not allowed in
  manifest"*. It pins the extension ID locally so Google sign-in keeps working; the store
  issues its own key instead.
- **`version_name`** — a local build stamp. Harmless but wrong to publish: it reads `0.1.0+…`
  while `version` says `0.0.1`.

`pnpm zip` leaves `apps/extension/build/chrome-mv3` in that stripped state. Run `pnpm build:ext`
before loading that folder unpacked again — `pnpm ext:reveal` warns you if you forget.

**`version` must increase on every upload.** The store refuses a version it has already seen.
Bump `manifest.version` in `wxt.config.ts` (currently `0.0.1`) and re-run `pnpm zip`; the new
filename reflects the bump, so a rejected upload is visible from the folder rather than only
from the store's error.

## Fields the store also asks for

| Field | Value |
| --- | --- |
| Website | https://fillaform.in |
| Support URL | https://fillaform.in/contact |
| Privacy policy URL | https://fillaform.in/privacy |

## Privacy practices tab

Every box the dashboard blocks publishing on. Each justification names the API called and the
user action that triggers it — reviewers reject vague ones, and a justification that does not
match the code is the most common cause of a second rejection.

**`scripting` is not in this list.** It was declared and never used, and has been removed from
the manifest — see `permissions` in `wxt.config.ts`. If the dashboard still asks for it, you are
uploading an older zip.

### Single purpose

```
Fillaform fills in web forms on the user's behalf. When the user presses Fill, it reads the
fields of the form on the current page, generates an answer for each one from documents and
notes that the user has previously added to their own Fillaform profile, and writes those
answers into the fields. The user then reviews the form and submits it themselves. Everything
in the extension exists to serve that one purpose: the side panel is where the user adds and
manages the source material the answers are drawn from, and the on-page overlay is where the
user reviews, edits and rewrites an answer before submitting.
```

### `storage`

```
Stores the user's signed-in session token, their cached plan and remaining quota, and the
in-progress result of a fill. The fill result is kept in chrome.storage.session because the
side panel can be closed by the user mid-fill; without it, closing the panel would discard
answers the user has not yet reviewed. No page content or browsing history is stored.
```

### `identity`

```
Used solely for Google sign-in, via chrome.identity.getAuthToken, so the user can access the
Fillaform account holding their documents and notes. It is called only from the background
service worker and only when the user presses Sign in. The token is used to authenticate
requests to our own API at api.fillaform.in and is never sent anywhere else. Signing out calls
chrome.identity.removeCachedAuthToken.
```

### `sidePanel`

```
The extension's entire interface is a side panel. It is where the user adds their CV, notes and
links, reviews the answers generated for a form, and manages their account. chrome.sidePanel is
used to open that panel when the user clicks the toolbar icon or the on-page Fill button.
```

### `activeTab`

```
Needed to read the URL of the tab the user is currently on and to send a message to that tab's
content script asking it to detect the form, so the panel can show how many fields were found
before the user presses Fill. It applies only to the tab the user is actively working in, and
only after the user opens the panel or presses Fill. It also allows the extension to keep
working for users who set the extension's site access to "on click" rather than granting broad
host access.
```

### `favicon`

```
The side panel lists the links the user has saved as source material. This permission serves
chrome-extension://<id>/_favicon/, which renders each saved site's icon from Chrome's own local
cache. It is used purely so that list is legible. The alternative would be for the extension to
make a network request to every site in the user's list, which we specifically want to avoid.
```

### Host permission use (`<all_urls>`)

```
Fillaform is a general-purpose form filler, so it cannot know in advance which sites its users
will fill forms on. Users fill job applications on employer career pages and applicant tracking
systems, plus Google Forms, university and grant applications, event registrations, surveys and
contact forms — an open-ended set of domains that cannot be enumerated in a manifest.

The content script's behaviour is deliberately narrow. On page load it only observes: it finds
form fields and their labels so the panel can report whether the page has a fillable form. No
page content is transmitted at that stage. Only when the user presses Fill are the field labels
and surrounding question text sent to our API to be answered, and only for the form on the page
the user chose. The extension does not read page content on sites where the user never presses
Fill, does not collect browsing history, and never submits a form on the user's behalf.
```

### Remote code

Select **"No, I am not using remote code."**

All JavaScript that runs is bundled inside the package. There is no `eval`, no `new Function`,
no remotely-loaded script, no CDN, and no externally-hosted module — verified against the built
output. If a reviewer asks, the distinction worth stating is:

```
The extension sends form field labels to our API and receives back text answers, which are
written into form fields as values. That is data, not code. No script is fetched or executed
from a remote source at any point.
```

### Data usage certification

The three checkboxes must be ticked, and all three are true of this extension:

- Data is not being sold to third parties
- Data is not being used or transferred for purposes unrelated to the item's single purpose
- Data is not being used or transferred to determine creditworthiness or for lending purposes

### Data types to declare

Tick these, and no others:

| Type | Why | What to say |
| --- | --- | --- |
| Personally identifiable information | The CV, name and contact details the user adds | Used to fill forms on the user's behalf |
| Authentication information | The Google sign-in token | Used to sign the user in to their account |
| Website content | Form field labels and nearby question text, on the page the user chose to fill | Sent only when the user presses Fill, only to generate answers |

**Not** location, health, financial, personal communications, or web history — the extension
collects none of them. Do not tick "User activity": it does not track clicks, mouse movement or
navigation.

The privacy policy URL is required for all of this and must be live before submitting:
https://fillaform.in/privacy
