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
Fillaform is an AI form filler for Chrome. It reads the form in front of you, writes the answers
from what it knows about you, and stops — you review and submit.

Ordinary autofill copies a saved name into a field labelled "name". That covers about a third of
a real application. The rest is questions: why this role, describe a time you disagreed with a
manager, what are you looking for. Fillaform answers those too, because it is an AI writing from
your own material rather than a lookup table.

WHAT IT DOES

• Fills any form, not just job applications — Google Forms, registrations, surveys, grant and
  visa applications, anything with inputs.
• Writes long answers. Essays, cover-letter paragraphs, "tell us about yourself" boxes.
• Learns your writing voice from the answers you keep, so the AI stops sounding like an AI.
• Labels its work. Every field is marked as read from something you gave it, or guessed by the
  AI — so you know exactly which lines to check before you submit.
• One tap to redo an answer: shorter, longer, warmer, plainer, more specific, or with your own
  instruction.
• Fill from the keyboard with Alt+F, without leaving the form you are typing in.

WHAT YOU GIVE IT

Once, at the start: a CV or resume, a transcript, a LinkedIn or GitHub URL, past applications
you were happy with, or just a few notes typed straight in. Files, links, and plain text all
work. Add more whenever; the AI answers from everything it has.

WHAT IT DOES NOT DO

It does not submit anything. It fills the form and hands it back to you.

PRIVACY

Your sources and answers are sent to our servers so the AI can use them, and to the model
provider that generates the answer. They are not sold, and they are not used to train models.
Full detail, including what is stored and for how long: https://fillaform.in/privacy

PRICING

Every account starts with a free grant of fills and long answers — no card. After that, Pro is a
paid monthly plan with a 14-day free trial, and fields answered from your own saved information
never count against it. Current numbers: https://fillaform.in/pricing
```

Keep the prose paragraphs wrapped as written — the dashboard preserves line breaks, and the
all-caps headings are the only structure the store's renderer gives you.

## Fields the store also asks for

| Field | Value |
| --- | --- |
| Website | https://fillaform.in |
| Support URL | https://fillaform.in/contact |
| Privacy policy URL | https://fillaform.in/privacy |
| Single purpose | Filling web forms on the user's behalf, using an AI model and information the user has supplied. |
| `<all_urls>` justification | A general-purpose form filler cannot know in advance which sites a user fills forms on. The content script observes only; nothing is transmitted until the user clicks fill. |
