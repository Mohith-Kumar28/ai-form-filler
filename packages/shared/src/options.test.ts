import { describe, expect, it } from 'vitest'
import { isOtherChoice, matchOptions } from './options.js'

/**
 * The comma bug, pinned.
 *
 * A real Google Form asked "Which feature excites you the most?" with these options. Splitting
 * the answer on commas — which both adapters and the recall path used to do — shattered the
 * first label into fragments that matched nothing, so an answer naming two features checked
 * one, dropped the other, and **reported success**. Nothing in the UI or the logs said so.
 */

const FEATURES = [
  "AI-powered search (e.g., 'What was that red shoe I saved?')",
  'Agentic Chatbot to ask regarding your memories',
  'Automatic smart grouping/collections of similar items',
  'Link/image/doc scraping and summarisation',
  'Automatic scraping and extraction of data from forwarded content',
  'Smart reminders autoset based on your memories',
  'Web-researched insights to provide extra context about your saved items',
]

const keysOf = (label: string) => [label]

describe('matching an answer whose option labels contain commas', () => {
  it('finds both options, where splitting on commas found one', () => {
    const answer = `${FEATURES[0]}, ${FEATURES[5]}`
    const { chosen, leftover } = matchOptions(answer, FEATURES, keysOf)

    expect(chosen).toEqual([FEATURES[0], FEATURES[5]])
    expect(leftover).toBe('')
  })

  it('finds three, including one with a slash in it', () => {
    const answer = [FEATURES[0], FEATURES[2], FEATURES[3]].join(', ')
    const { chosen, leftover } = matchOptions(answer, FEATURES, keysOf)

    expect(chosen).toHaveLength(3)
    expect(leftover).toBe('')
  })

  it('reports what it could not place, instead of quietly dropping it', () => {
    const { chosen, leftover } = matchOptions(`${FEATURES[1]}, Telepathy`, FEATURES, keysOf)

    expect(chosen).toEqual([FEATURES[1]])
    expect(leftover).toBe('telepathy')
  })
})

describe('matching without splitting the wrong thing', () => {
  it('treats a single option containing a comma as one answer', () => {
    const options = ['Yes, I agree', 'No']
    const { chosen, leftover } = matchOptions('Yes, I agree', options, keysOf)

    expect(chosen).toEqual(['Yes, I agree'])
    expect(leftover).toBe('')
  })

  it('does not let a short option match inside a longer one', () => {
    // "Yes" lives inside "Yes, I agree"; consuming the long label first is what prevents it.
    const options = ['Yes, I agree', 'Yes']
    expect(matchOptions('Yes, I agree', options, keysOf).chosen).toEqual(['Yes, I agree'])
  })

  it('does not match an option inside an unrelated word', () => {
    // "No" must not match the "No" in "Notion" — two-letter options are common.
    const options = ['No', 'Notion']
    const { chosen } = matchOptions('Notion', options, keysOf)

    expect(chosen).toEqual(['Notion'])
  })

  it('matches by value as well as by label', () => {
    const options = [
      { value: 'opt_1', label: 'United States' },
      { value: 'opt_2', label: 'India' },
    ]
    const { chosen } = matchOptions('opt_2', options, (o) => [o.value, o.label])

    expect(chosen).toEqual([options[1]])
  })

  it('is indifferent to case and spacing', () => {
    expect(matchOptions('  iOS  ', ['iOS', 'Android'], keysOf).chosen).toEqual(['iOS'])
    expect(matchOptions('ios', ['iOS', 'Android'], keysOf).chosen).toEqual(['iOS'])
  })

  it('accepts the separators a model actually writes', () => {
    const { chosen, leftover } = matchOptions('Notion and Coda', ['Notion', 'Coda'], keysOf)

    expect(chosen).toHaveLength(2)
    expect(leftover).toBe('')
  })

  it('finds nothing in an answer that names nothing', () => {
    const { chosen, leftover } = matchOptions('Atlantis', ['iOS', 'Android'], keysOf)

    expect(chosen).toEqual([])
    expect(leftover).toBe('atlantis')
  })

  it('handles an empty answer without inventing a selection', () => {
    expect(matchOptions('', ['iOS'], keysOf)).toEqual({ chosen: [], leftover: '' })
  })
})

describe('isOtherChoice', () => {
  it("recognises the free-text escape hatch, including Google's trailing colon", () => {
    // Without this, a strict "every part must be an offered option" check turns every
    // "Other: a friend at the company" answer into a skipped field.
    expect(isOtherChoice('Other:')).toBe(true)
    expect(isOtherChoice('other')).toBe(true)
    expect(isOtherChoice('__other_option__', 'Other:')).toBe(true)
  })

  it('does not mistake an ordinary option for it', () => {
    expect(isOtherChoice('Others in my team')).toBe(false)
    expect(isOtherChoice('iOS')).toBe(false)
    expect(isOtherChoice(undefined)).toBe(false)
  })
})
