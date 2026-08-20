import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { FeedbackRequest } from '@aff/shared'
import { describe, expect, it } from 'vitest'
import { destinationFor, looksSecret, mayReplaceStored } from './answer-bank.js'
import { answerHashOf, keptRejections, questionHashFor } from './learned-store.js'
import { learnedDocument, parseLearnedAnswer } from './supermemory.js'

type Entry = FeedbackRequest['entries'][number]

function entry(over: Partial<Entry> = {}): Entry {
  return { label: 'Question', accepted: 'Answer', edited: true, ...over }
}

/**
 * The bug this file exists for: an answer stored in a shape nothing can retrieve.
 *
 * Every case here is one the product got wrong in production, and each is silent — the write
 * succeeds, the log says a memory was recorded, and the answer simply never comes back.
 */
describe('the shape an answer is stored in', () => {
  it('leaves prose exactly as it always was', () => {
    // Pinned byte for byte. The index already holds thousands of documents in this shape, and
    // changing it would make old and new answers rank differently for no gain at all.
    const { content, metadata } = learnedDocument({
      shape: 'prose',
      question: 'Why do you want to work here?',
      answer: "I've followed the compiler team since 2019.",
      origin: 'https://boards.greenhouse.io',
      edited: true,
    })

    expect(content).toBe(
      "Question: Why do you want to work here?\n\nTheir answer: I've followed the compiler team since 2019.",
    )
    expect(metadata.kind).toBe('user_answer')
    expect(metadata.edited).toBe('true')
  })

  it('carries the option set a choice was picked from', () => {
    // "10" on its own retrieves nothing useful and means nothing later. The set is what makes
    // it a fact about the person rather than a loose number.
    const { content, metadata } = learnedDocument({
      shape: 'choice',
      question: 'Which platform do you primarily build for?',
      answer: 'iOS',
      options: ['iOS', 'Android', 'Web'],
      origin: 'https://example.com',
      edited: true,
    })

    expect(content).toContain('Their answer: iOS')
    expect(content).toContain('Chosen from: iOS | Android | Web')
    expect(metadata.optionSet).toBe('iOS | Android | Web')
    expect(metadata.kind).toBe('user_choice')
  })

  it('puts the option set in the content, not only the metadata', () => {
    // Retrieval returns chunk text. Metadata never reaches a prompt, so an option set stored
    // only there is invisible to the thing that needs it.
    const { content } = learnedDocument({
      shape: 'choice',
      question: 'Rate your interest',
      answer: '10',
      options: ['1', '5', '10'],
      origin: 'https://example.com',
      edited: false,
    })
    expect(content).toContain('1 | 5 | 10')
  })

  it('spells a "No" out in words', () => {
    /**
     * The checkbox bug, in one assertion.
     *
     * An embedding of the bare token "No" matches everything and retrieves nothing, so a user
     * who declined sponsorship on one form was asked again — and guessed at again — on every
     * later one. The negation has to be lexically present in the chunk for the next search to
     * find it.
     */
    const { content, metadata } = learnedDocument({
      shape: 'boolean',
      question: 'Do you require visa sponsorship?',
      answer: 'No',
      boolean: false,
      origin: 'https://example.com',
      edited: true,
    })

    expect(content).toContain('This was a yes/no question and they answered No.')
    expect(metadata.boolean).toBe(false)
    expect(metadata.optionSet).toBe('Yes | No')
  })

  it('does not claim an option set it was not given', () => {
    const { content, metadata } = learnedDocument({
      shape: 'choice',
      question: 'Anything else?',
      answer: 'Nope',
      options: [],
      origin: 'https://example.com',
      edited: false,
    })
    expect(content).not.toContain('Chosen from')
    expect(metadata.optionSet).toBeUndefined()
  })
})

describe('where an answer is sent', () => {
  it('reads the widget kind, which used to be hardcoded away', () => {
    // `identitySlotFor` was called with kind 'text' regardless, which disabled its typed
    // fallbacks: a tel input whose label read unusually went to memory, where tier 0 — the
    // only path that answers a phone field — can never reach it.
    expect(destinationFor(entry({ label: 'Reach me on', kind: 'tel' }), 'phone')).toBe('identity')
  })

  it('sends a constrained choice to the choice shape', () => {
    expect(destinationFor(entry({ label: 'Platform', kind: 'select' }), undefined)).toBe('choice')
    expect(destinationFor(entry({ label: 'Platform', kind: 'radio' }), undefined)).toBe('choice')
  })

  it('sends a yes/no checkbox to the boolean shape', () => {
    expect(
      destinationFor(entry({ label: 'Subscribe?', kind: 'checkbox', accepted: 'no' }), undefined),
    ).toBe('boolean')
  })

  it('falls back to prose for a checkbox whose answer is neither yes nor no', () => {
    // Asserting a boolean here would mean picking a side, and picking wrong states the
    // opposite of what the person chose.
    expect(
      destinationFor(
        entry({ label: 'Subscribe?', kind: 'checkbox', accepted: 'maybe later' }),
        undefined,
      ),
    ).toBe('prose')
  })

  /**
   * The regression this whole file was worth writing for.
   *
   * `identitySlotFor` correctly refused to store an emergency contact's phone number in the
   * user's profile — and the entry then fell through to the memory write, so a stranger's
   * number became a retrievable passage in the index that answers every later question. The
   * check worked and made the outcome worse.
   */
  it("drops someone else's details from both stores, not just the profile", () => {
    expect(destinationFor(entry({ label: 'Phone', section: 'Emergency contact' }), undefined)).toBe(
      'drop',
    )
    expect(destinationFor(entry({ label: 'Reference name' }), undefined)).toBe('drop')
    expect(destinationFor(entry({ label: 'Current employer' }), undefined)).toBe('drop')
  })

  it('never learns a secret, by label or by shape', () => {
    expect(destinationFor(entry({ label: 'Password' }), undefined)).toBe('drop')
    expect(destinationFor(entry({ label: 'One-time code' }), undefined)).toBe('drop')
    expect(looksSecret(entry({ accepted: '4111 1111 1111 1111' }))).toBe(true)
    expect(looksSecret(entry({ label: 'Verification code', accepted: '482913' }))).toBe(true)
    // A four-digit answer to an ordinary question is a year, not a PIN.
    expect(looksSecret(entry({ label: 'What year did you graduate?', accepted: '2019' }))).toBe(
      false,
    )
  })
})

describe('the key an answer is remembered under', () => {
  it('keeps two documents for the same essay question on two sites', async () => {
    // "Why do you want to work here?" has a different true answer at every company. Replacing
    // one with the other overwrites a good answer with the answer to a different question.
    const a = await questionHashFor('Why us?', { origin: 'https://a.com' })
    const b = await questionHashFor('Why us?', { origin: 'https://b.com' })
    expect(a).not.toBe(b)
  })

  it('keeps one answer for a question whose answer cannot differ by site', async () => {
    // Visa status is visa status. The newer answer must replace the older one, not sit beside
    // it contradicting it — which is what sharing a key achieves.
    const a = await questionHashFor('Do you require sponsorship?', {})
    const b = await questionHashFor('do you require SPONSORSHIP?', {})
    expect(a).toBe(b)
  })

  it('does not confuse a question with the same label in another section', async () => {
    const own = await questionHashFor('Phone', {})
    const other = await questionHashFor('Phone', { section: 'Emergency contact' })
    expect(own).not.toBe(other)
  })

  it('treats a multi-selection as a set, so reordering is not a new answer', async () => {
    expect(await answerHashOf('Notion, Coda')).toBe(await answerHashOf('coda,  Notion'))
  })
})

/**
 * The boundary that keeps `learned_pointers` from becoming the store that was deleted once
 * already.
 *
 * Discipline is not the mechanism — the table has no answer column, so there is nothing to
 * read. This is the second half: the answering paths must not even reach for it. Asserted by
 * reading the files, because an import is exactly the kind of thing that gets added in passing.
 */
describe('the learned store is not an answering path', () => {
  it.each(['retrieval.ts', 'router/tier0.ts', 'llm/generate.ts', 'llm/prompt.ts'])(
    '%s does not import learned-store',
    (file) => {
      const path = file.includes('/')
        ? resolve(process.cwd(), 'src', file)
        : resolve(process.cwd(), 'src/services', file)
      expect(readFileSync(path, 'utf8')).not.toContain('learned-store')
    },
  )
})

/**
 * Reading a learned answer back out of the index.
 *
 * The write path was never the whole loop, and this was the missing half. A stored answer came
 * back from retrieval as an anonymous passage — the same kind of thing as a paragraph of the
 * user's résumé — so the prompt could not say "this is the answer you gave to this question",
 * and the model treated the strongest signal in the system as background reading. Asked the
 * same question a second time it would compose something new and generic, which from the user's
 * side is indistinguishable from the correction never having been learned at all.
 *
 * These pair with `the shape an answer is stored in` above, and that pairing is the point: the
 * two functions share the bytes that separate a question from its answer, so a change to the
 * document shape cannot silently stop the reader recognising it.
 */
describe('reading a learned answer back', () => {
  const roundTrip = (input: Parameters<typeof learnedDocument>[0]) =>
    parseLearnedAnswer(learnedDocument(input).content)

  it('recovers a prose answer', () => {
    expect(
      roundTrip({
        shape: 'prose',
        question: 'What are you currently exploring with AI?',
        answer: 'Building a second-brain app, and aiming for a thousand users this quarter.',
        origin: 'https://docs.google.com',
        edited: true,
      }),
    ).toEqual({
      question: 'What are you currently exploring with AI?',
      answer: 'Building a second-brain app, and aiming for a thousand users this quarter.',
    })
  })

  it('recovers a choice without the option set trailing into the answer', () => {
    // "Chosen from: ..." exists so a short answer is findable by an embedding. Reading it back
    // as part of the answer would type it into the form.
    expect(
      roundTrip({
        shape: 'choice',
        question: 'Preferred platform',
        answer: 'iOS',
        options: ['iOS', 'Android', 'Web'],
        origin: 'https://jobs.example.com',
        edited: true,
      }),
    ).toEqual({ question: 'Preferred platform', answer: 'iOS' })
  })

  it('recovers a boolean without its explanatory sentence', () => {
    expect(
      roundTrip({
        shape: 'boolean',
        question: 'Do you require visa sponsorship?',
        answer: 'No',
        boolean: false,
        origin: 'https://jobs.example.com',
        edited: true,
      }),
    ).toEqual({ question: 'Do you require visa sponsorship?', answer: 'No' })
  })

  it("does not mistake the user's own documents for answers they gave", () => {
    /**
     * The important negative. Everything else in the index is a document the user supplied, and
     * labelling one of those "your answer to this question" would put words in their mouth and
     * invite the model to type a résumé paragraph into a form field.
     */
    expect(parseLearnedAnswer('I led the compiler team from 2019.')).toBeNull()
    expect(parseLearnedAnswer('')).toBeNull()
    // A fragment of a learned document: Supermemory chunks long content, so the head can be
    // absent. Still a fine passage, just not a quotable answer.
    expect(parseLearnedAnswer('Their answer: iOS')).toBeNull()
    // Shaped like the head, but with nothing in it.
    expect(parseLearnedAnswer('Question: \n\nTheir answer: ')).toBeNull()
  })
})

/**
 * What a rejection is for, and when it stops being true.
 *
 * The second cause of the reported "it wrote its own generic thing". A user who edits an answer
 * usually extends ours rather than replacing it, and clearing the field first files our original
 * text as a rejection — so the prompt ended up saying both "reuse their answer", which contains
 * our paragraph, and "never offer that paragraph again". Composing something new is a reasonable
 * reading of a contradiction, and it looks exactly like the edit was never learned.
 */
describe('a rejection that has been superseded', () => {
  it('is dropped once the user has said what the answer is', () => {
    expect(
      keptRejections(
        ["I'm currently building AI-powered tools."],
        "I'm building tools, and aiming for a thousand users.",
        true,
      ),
    ).toEqual([])
  })

  it('is dropped even when the new answer is nothing like it', () => {
    // A rejection says "not this" without saying what is right, which is the only reason to keep
    // one. Being told what is right supersedes it whatever the words are.
    expect(keptRejections(['Twitter', 'A friend'], 'LinkedIn', true)).toEqual([])
  })

  it('survives when nothing was actually stored', () => {
    // A memory outage learned nothing, so the negatives are still all we know.
    expect(keptRejections(['Twitter'], 'LinkedIn', false)).toEqual(['Twitter'])
  })

  it('still drops a value the user has now typed themselves', () => {
    // The original case: somebody who cleared "Twitter" and later typed it has changed their
    // mind, and avoiding it forever would make the field permanently unanswerable.
    expect(keptRejections(['Twitter', 'A friend'], 'twitter', false)).toEqual(['A friend'])
  })
})

/**
 * What may overwrite an answer we already hold.
 *
 * The data loss behind "why isn't the thousand-users thing in Supermemory any more" — visible in
 * the console as a memory tagged `replaced`. The user extended our paragraph with a sentence
 * they cared about, it was stored, they cleared the form and filled it again, and then pressed
 * Keep on the generic answer the model produced. Keep reports `confirmed: true, edited: false`,
 * and it took the same write path as an edit — so it PATCHed the document and their sentence
 * ceased to exist. No later fill could retrieve it, because there was nothing left to retrieve.
 */
describe('what may overwrite a stored answer', () => {
  const edited = entry({ edited: true, accepted: 'Aiming for a thousand users this quarter.' })
  const confirmed = entry({ edited: false, confirmed: true, accepted: 'A generic paragraph.' })

  it("lets the user's own words replace what we hold", () => {
    expect(mayReplaceStored(edited, true)).toBe(true)
  })

  it('refuses to let a confirmation overwrite a stored answer', () => {
    // A confirmation says "what you wrote is acceptable". It is our text, and it cannot outrank
    // theirs.
    expect(mayReplaceStored(confirmed, true)).toBe(false)
  })

  it('still stores a confirmation when we hold nothing for the question', () => {
    // The documented value of a confirmation: an inference the model got right is otherwise
    // thrown away entirely, and the next form re-derives it from scratch.
    expect(mayReplaceStored(confirmed, false)).toBe(true)
  })

  it('treats a rewrite the user kept as their own words', () => {
    // We wrote it, they asked for it and signed off on it: `feedbackEntryFor` marks that both
    // edited and confirmed, and it is a real answer for the question.
    expect(mayReplaceStored(entry({ edited: true, confirmed: true }), true)).toBe(true)
  })
})
