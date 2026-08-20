/**
 * The rewrite instructions the review card offers, and the sentences it actually sends.
 *
 * Deliberately free of any zod import, like `constants.ts` and for the same reason: the
 * content script imports this, and pulling a schema module in behind one string constant took
 * that bundle from 11 kB to 93 kB once already.
 *
 * ### Why the sentences live on the client
 *
 * `POST /v1/fill/improve` takes `instruction` as free text — its own docstring calls it "a
 * preset, or the user's own words" — so a preset and a typed request are the same request, and
 * the server needs no vocabulary of its own. It had one: `IMPROVE_STYLES`, four carefully
 * written sentences that **nothing ever imported**. The panel sent `instruction: style.key`,
 * so the frontier model received the line `Instruction: professional` and the sentences never
 * reached a model at all. Keeping the words on the side that shows them to the user is what
 * makes that class of mistake impossible: what the chip says and what the model is told are
 * one object.
 *
 * Each instruction is written as something a person would say to another person, because that
 * is what the model is asked to imitate. "professional" is a category; "the way you would
 * write to a hiring manager you have not met" is an instruction.
 */

export interface RewritePreset {
  key: string
  /** What the chip says. Lower case: it sits in a row of chips, not a title. */
  label: string
  /** What the model is told. A sentence, never the key. */
  instruction: string
}

/**
 * How it should sound. Never how long it should be — that is the other axis, and mixing them
 * into one row of chips means every choice silently changes both.
 */
export const REWRITE_TONES: readonly RewritePreset[] = [
  {
    key: 'warmer',
    label: 'warmer',
    instruction:
      'Make it warmer and more human. Keep it in my voice — friendly, not gushing, and no exclamation marks.',
  },
  {
    key: 'confident',
    label: 'confident',
    instruction:
      'Make it more confident. State things directly and drop the hedging — no "I think", no "I feel like", no "somewhat".',
  },
  {
    key: 'plain',
    label: 'plainer',
    instruction:
      'Say it in plain words. Short sentences, no jargon, no buzzwords, nothing a stranger would have to re-read.',
  },
  {
    key: 'formal',
    label: 'more formal',
    instruction:
      'Make it more formal and precise, the way you would write to a hiring manager you have not met. Keep it human, not stiff.',
  },
] as const

/**
 * How long it should be.
 *
 * `expand` says "from my own notes" and "do not invent anything" in the same breath on
 * purpose. Asking a model for more words is the single most reliable way to get invented
 * facts onto a form the user is about to submit under their own name — and the server already
 * re-searches memory for this call precisely so there is real material to expand *with*.
 */
export const REWRITE_LENGTHS: readonly RewritePreset[] = [
  {
    key: 'shorter',
    label: 'shorter',
    instruction: 'Cut it to about half the length. Keep every fact and remove everything else.',
  },
  {
    key: 'expand',
    label: 'expand',
    instruction:
      'Expand it with specifics drawn from my own notes — concrete facts and examples, not adjectives. Do not invent anything I have not told you.',
  },
] as const

/**
 * Longest instruction the user may type.
 *
 * Generous for a request ("mention that I ran the migration off Oracle and keep it under a
 * paragraph") and far short of anything that could function as a second prompt.
 */
export const MAX_INSTRUCTION_LENGTH = 200

/** The sentence for a preset key, or the key itself if it is not one of ours. */
export function instructionFor(key: string): string {
  const preset = [...REWRITE_TONES, ...REWRITE_LENGTHS].find((entry) => entry.key === key)
  return preset ? preset.instruction : key
}
