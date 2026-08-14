import type { FieldSchema, LearnedAnswer } from '@aff/shared'
import { describe, expect, it } from 'vitest'
import { classifyField } from './classify.js'
import { normalizeQuestion, resolveLearned } from './recall.js'

/**
 * Recall: a question already answered is answered again from what the user chose.
 *
 * This is the payoff of the learning loop and the reason it has to be exact. A remembered
 * answer that is *nearly* right, applied with confidence and no model call, is worse than
 * asking the model — so everything here is about what recall refuses to do.
 */

function field(label: string, extra: Partial<FieldSchema> = {}): FieldSchema {
  return { id: 'f1', label, kind: 'text', required: false, ...extra }
}

function recall(learned: LearnedAnswer[], schema: FieldSchema) {
  return resolveLearned(learned, new Map([[schema.id, schema]]), [classifyField(schema)])
}

describe('normalizeQuestion', () => {
  it('is stable across the punctuation different sites add', () => {
    // Google appends "*" to required questions; plenty of forms end a label with a colon.
    const forms = [
      'Which device do you use?',
      'Which device do you use? *',
      '  Which   device do you use?  ',
      'Which device do you use?:',
    ]
    const keys = new Set(forms.map((label) => normalizeQuestion(label)))
    expect(keys.size).toBe(1)
  })
})

describe('a question the user has answered before', () => {
  it('is answered from their choice, with no model call', () => {
    const schema = field('Which device do you use?', {
      kind: 'radio',
      options: [
        { value: 'a', label: 'Android' },
        { value: 'i', label: 'iOS' },
        { value: 'w', label: 'Browser' },
      ],
    })

    const { fills, unresolved } = recall(
      [{ question: 'Which device do you use?', answer: 'iOS' }],
      schema,
    )

    // The widget needs the option's value, not the label the user saw.
    expect(fills[0]?.value).toBe('i')
    expect(fills[0]?.tier).toBe(0)
    expect(fills[0]?.confidence).toBe(1)
    // Not flagged for review: asking someone to re-confirm a choice they have made twice is
    // exactly the friction this removes.
    expect(fills[0]?.inferred).toBe(false)
    expect(unresolved).toHaveLength(0)
  })

  it('matches the same question asked with different punctuation', () => {
    const schema = field('Which device do you use? *', {
      kind: 'select',
      options: [{ value: 'i', label: 'iOS' }],
    })

    const { fills } = recall([{ question: 'Which device do you use?', answer: 'iOS' }], schema)
    expect(fills[0]?.value).toBe('i')
  })

  it('restores every selection of a multi-select', () => {
    const schema = field('Which tools do you use?', {
      kind: 'multiselect',
      options: [
        { value: 'n', label: 'Notion' },
        { value: 'c', label: 'Coda' },
        { value: 'l', label: 'Linear' },
      ],
    })

    const { fills } = recall(
      [{ question: 'Which tools do you use?', answer: 'Notion, Linear' }],
      schema,
    )
    expect(fills[0]?.value).toBe('n, l')
  })

  it('answers a plain text field with the remembered value verbatim', () => {
    const schema = field('Years of experience', { kind: 'number' })
    const { fills } = recall([{ question: 'Years of experience', answer: '9' }], schema)
    expect(fills[0]?.value).toBe('9')
  })
})

describe('what recall refuses to answer', () => {
  it('leaves a different question to the model', () => {
    // "Do you have a licence?" and "Do you have a licence for heavy vehicles?" are not the
    // same question, and substring matching would confidently conflate them.
    const schema = field('Do you have a driving licence for heavy vehicles?', {
      kind: 'radio',
      options: [
        { value: 'y', label: 'Yes' },
        { value: 'n', label: 'No' },
      ],
    })

    const { fills, unresolved } = recall(
      [{ question: 'Do you have a driving licence?', answer: 'Yes' }],
      schema,
    )

    expect(fills).toHaveLength(0)
    expect(unresolved).toHaveLength(1)
  })

  it('does not force an answer this form does not offer', () => {
    const schema = field('Which device do you use?', {
      kind: 'radio',
      options: [
        { value: 'a', label: 'Android' },
        { value: 'w', label: 'Browser' },
      ],
    })

    const { fills, unresolved } = recall(
      [{ question: 'Which device do you use?', answer: 'iOS' }],
      schema,
    )

    expect(fills).toHaveLength(0)
    expect(unresolved).toHaveLength(1)
  })

  it('restores a multi-select whose option labels contain commas', () => {
    // The real form that exposed this. Splitting the remembered answer on commas turned the
    // first label into fragments, matched nothing, and left the question for the model.
    const features = [
      { value: 'a', label: "AI-powered search (e.g., 'What was that red shoe I saved?')" },
      { value: 'b', label: 'Smart reminders autoset based on your memories' },
      { value: 'c', label: 'Link/image/doc scraping and summarisation' },
    ]
    const schema = field('Which feature of Memorie excites you the most?', {
      kind: 'multiselect',
      options: features,
    })

    const { fills } = recall(
      [
        {
          question: 'Which feature of Memorie excites you the most?',
          answer: `${features[0]?.label}, ${features[1]?.label}`,
        },
      ],
      schema,
    )

    expect(fills[0]?.value).toBe('a, b')
  })

  it('drops a partly-matching multi-select rather than half-answering it', () => {
    // Applying only the half that matched would silently discard the user's other choice, and
    // report the field as filled. The model sees the whole option list and can decide.
    const schema = field('Which tools do you use?', {
      kind: 'multiselect',
      options: [{ value: 'n', label: 'Notion' }],
    })

    const { fills, unresolved } = recall(
      [{ question: 'Which tools do you use?', answer: 'Notion, Coda' }],
      schema,
    )

    expect(fills).toHaveLength(0)
    expect(unresolved).toHaveLength(1)
  })

  it('never pre-fills an essay with a one-liner', () => {
    // "9" answers "years of experience" and ruins "tell us about a project you are proud of".
    const schema = field('Tell us about a project you are proud of', { kind: 'longtext' })
    const { fills, unresolved } = recall(
      [{ question: 'Tell us about a project you are proud of', answer: 'The compiler work.' }],
      schema,
    )

    expect(fills).toHaveLength(0)
    expect(unresolved).toHaveLength(1)
  })

  it('prefers the newest answer when a question was answered twice', () => {
    const schema = field('Which device do you use?', {
      kind: 'radio',
      options: [
        { value: 'a', label: 'Android' },
        { value: 'i', label: 'iOS' },
      ],
    })

    const { fills } = recall(
      [
        { question: 'Which device do you use?', answer: 'Android' },
        { question: 'Which device do you use?', answer: 'iOS' },
      ],
      schema,
    )

    expect(fills[0]?.value).toBe('i')
  })
})
