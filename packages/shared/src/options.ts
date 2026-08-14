/**
 * Matching an answer to a form's options.
 *
 * One answer string, several selections, and option labels that contain commas — which real
 * forms do constantly: "AI-powered search (e.g., 'What was that red shoe I saved?')",
 * "Documents (PDFs, notes, etc.)", "Yes, I agree".
 *
 * Splitting the answer on commas first shatters those labels into fragments that match
 * nothing, and the failure is silent in the worst way: the widget checks whichever fragments
 * happened to match, drops the rest, and reports success. A user who picked three features got
 * one, and nothing anywhere said so.
 *
 * So the answer is consumed **greedily, longest label first**, against the whole string. A
 * label that matches is removed before the next is tried, which is what stops "Yes" matching
 * inside "Yes, I agree" and "No" inside "Notion". Whatever is left over is reported, so a
 * caller can tell a clean parse from a partial one instead of assuming.
 *
 * Lives in shared because both sides of the loop need the identical rule: the adapters that
 * write a selection onto a page, and the server that recalls one from a past answer. Two
 * implementations of this would drift, and the drift would be invisible.
 */

/** Case, spacing, and surrounding punctuation carry no meaning in an option label. */
function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Whether the character at `index` is part of a word, for boundary-safe substring matching. */
function isWordChar(text: string, index: number): boolean {
  const char = text[index]
  return char !== undefined && /[a-z0-9]/.test(char)
}

/**
 * Finds `needle` in `haystack` without matching inside a longer word.
 *
 * "No" must not match the "No" in "Notion", and a two-letter option is common enough
 * ("No", "IN", "US") that this is not a hypothetical.
 */
function indexOfWord(haystack: string, needle: string): number {
  let from = 0
  while (from <= haystack.length - needle.length) {
    const at = haystack.indexOf(needle, from)
    if (at === -1) return -1
    if (!isWordChar(haystack, at - 1) && !isWordChar(haystack, at + needle.length)) return at
    from = at + 1
  }
  return -1
}

export interface OptionMatch<T> {
  /** The options named by the answer, in the order they were matched. */
  chosen: T[]
  /**
   * What the answer said that no option accounts for, normalised.
   *
   * Empty means every part of the answer landed on an option. Anything else means the answer
   * named something this form does not offer — which is a decision point, not a detail: a page
   * writer may accept a partial selection, while a deterministic recall must refuse it.
   */
  leftover: string
}

/**
 * Resolves an answer to the options it names.
 *
 * `keysOf` returns every string an option can legitimately be identified by — its value, its
 * label, its visible text — because a model answers with what a human reads and a widget
 * stores something else.
 */
export function matchOptions<T>(
  answer: string,
  candidates: T[],
  keysOf: (candidate: T) => string[],
): OptionMatch<T> {
  const wanted = normalize(answer)
  if (wanted === '') return { chosen: [], leftover: '' }

  /**
   * The whole answer as a single option, first.
   *
   * "Yes, I agree" is one option, not two, and no amount of careful splitting can tell the
   * difference — only trying the undivided string can.
   */
  for (const candidate of candidates) {
    if (keysOf(candidate).some((key) => normalize(key) === wanted)) {
      return { chosen: [candidate], leftover: '' }
    }
  }

  // Longest first, so a label that contains a shorter one consumes it before it can match.
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      keys: keysOf(candidate)
        .map(normalize)
        .filter((key) => key !== '')
        .sort((a, b) => b.length - a.length),
    }))
    .filter((entry) => entry.keys.length > 0)
    .sort((a, b) => (b.keys[0]?.length ?? 0) - (a.keys[0]?.length ?? 0))

  // Padded so a match at either end still has a non-word character beside it.
  let remaining = ` ${wanted} `
  const chosen: T[] = []

  for (const { candidate, keys } of ranked) {
    for (const key of keys) {
      const at = indexOfWord(remaining, key)
      if (at === -1) continue
      chosen.push(candidate)
      remaining = `${remaining.slice(0, at)} ${remaining.slice(at + key.length)}`
      break
    }
  }

  return {
    chosen,
    // Separators are not leftovers — they are what joined the parts that did match.
    leftover: remaining
      .replace(/[,;|/&]|\band\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  }
}
