import { describe, expect, it } from 'vitest'
import {
  instructionFor,
  MAX_INSTRUCTION_LENGTH,
  REWRITE_LENGTHS,
  REWRITE_TONES,
} from './rewrite.js'

/**
 * The regression this file exists for.
 *
 * The API had four carefully written rewrite instructions in `IMPROVE_STYLES`, and **nothing
 * ever imported them**. The panel sent `instruction: style.key`, so a frontier model was handed
 * the line `Instruction: professional` and asked to rewrite a cover letter with it. The
 * sentences never reached a model once, and nothing failed: rewrites came back, they were just
 * being steered by a single adjective instead of the instruction somebody had written.
 *
 * These tests assert the shape that makes it impossible rather than merely fixed — the words
 * shown on the chip and the words sent to the model are one object.
 */

const ALL = [...REWRITE_TONES, ...REWRITE_LENGTHS]

describe('rewrite presets', () => {
  it('offers both axes separately', () => {
    // Tone and length are separate rows because mixing them into one means every choice
    // silently changes both.
    expect(REWRITE_TONES.length).toBeGreaterThanOrEqual(3)
    expect(REWRITE_LENGTHS.length).toBeGreaterThanOrEqual(2)
  })

  it('sends a sentence, never a key', () => {
    for (const preset of ALL) {
      // The bug, expressed as a property: an instruction that is one word is a category, and a
      // category is what "professional" was.
      expect(preset.instruction.trim().split(/\s+/).length).toBeGreaterThan(4)
      expect(preset.instruction).not.toBe(preset.key)
      expect(preset.instruction).toMatch(/[.!]$/)
    }
  })

  it('keeps every instruction inside the length the input allows', () => {
    // Otherwise a preset could express something the user is forbidden from typing themselves,
    // which would make the free-text box the weaker half of the same control.
    for (const preset of ALL) {
      expect(preset.instruction.length).toBeLessThanOrEqual(MAX_INSTRUCTION_LENGTH)
    }
  })

  it('labels chips in the words a person would use', () => {
    for (const preset of ALL) {
      expect(preset.label.length).toBeLessThanOrEqual(14)
      // Lower case: these sit in a row of chips, not as titles.
      expect(preset.label).toBe(preset.label.toLowerCase())
    }
  })

  it('uses a distinct key for each preset', () => {
    expect(new Set(ALL.map((preset) => preset.key)).size).toBe(ALL.length)
  })

  it('forbids inventing facts when it asks for more words', () => {
    /**
     * Asking a model to expand an answer is the single most reliable way to get invented facts
     * onto a form somebody is about to submit under their own name — and it is the one failure
     * of this feature the user cannot easily catch, because the new sentence reads perfectly.
     */
    const expand = REWRITE_LENGTHS.find((preset) => preset.key === 'expand')
    expect(expand?.instruction).toMatch(/do not invent/i)
  })
})

describe('instructionFor', () => {
  it('resolves a preset key to its sentence', () => {
    expect(instructionFor('shorter')).toBe(
      REWRITE_LENGTHS.find((preset) => preset.key === 'shorter')?.instruction,
    )
  })

  it("passes the user's own words through untouched", () => {
    // A typed request and a preset are the same request by the time they reach the model, which
    // is why the server needs no vocabulary of its own.
    const typed = 'mention that I ran the migration off Oracle'
    expect(instructionFor(typed)).toBe(typed)
  })
})
