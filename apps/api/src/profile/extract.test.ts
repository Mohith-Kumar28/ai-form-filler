import { describe, expect, it } from 'vitest'
import { extractIdentity, mergeIdentity } from './extract.js'
import { htmlToText } from './parse.js'

describe('extractIdentity', () => {
  const resume = `
    Mohith Kumar
    Bengaluru, India
    mohith@example.com | +91 98765 43210
    https://linkedin.com/in/mohithkumar
    https://github.com/mohithkumar
    https://mohith.dev

    Education
    IIT Madras, BTech Computer Science, 2021 - 2025, CGPA 8.9
  `

  it('pulls the email out and lowercases it', () => {
    expect(extractIdentity('Contact: Mohith.Kumar@Example.COM').email).toBe(
      'mohith.kumar@example.com',
    )
  })

  it('finds a phone number with a country code', () => {
    const identity = extractIdentity(resume)
    expect(identity.phone?.replace(/\D/g, '')).toBe('919876543210')
  })

  it('does not mistake a date range for a phone number', () => {
    // "2021 - 2025" is 8 digits; the 9+ digit floor is what rejects it.
    expect(extractIdentity('Worked there 2021 - 2025').phone).toBeUndefined()
  })

  it('does not mistake a CGPA or short number for a phone', () => {
    expect(extractIdentity('CGPA 8.9 out of 10').phone).toBeUndefined()
  })

  it('classifies known platform links', () => {
    const { links } = extractIdentity(resume)
    expect(links?.linkedin).toBe('https://linkedin.com/in/mohithkumar')
    expect(links?.github).toBe('https://github.com/mohithkumar')
  })

  it('treats an unrecognised URL as a personal website', () => {
    expect(extractIdentity(resume).links?.website).toBe('https://mohith.dev')
  })

  it('does not misfile a platform URL as the website', () => {
    const { links } = extractIdentity('https://github.com/someone')
    expect(links?.github).toBe('https://github.com/someone')
    expect(links?.website).toBeUndefined()
  })

  it('strips trailing punctuation dragged in from prose', () => {
    const { links } = extractIdentity('See https://github.com/me, or email me.')
    expect(links?.github).toBe('https://github.com/me')
  })

  it('handles a regional LinkedIn subdomain', () => {
    const { links } = extractIdentity('https://in.linkedin.com/in/someone')
    expect(links?.linkedin).toBe('https://in.linkedin.com/in/someone')
  })

  it('returns an empty object for text with no contact details', () => {
    expect(extractIdentity('Just some prose about nothing in particular.')).toEqual({})
  })
})

describe('mergeIdentity', () => {
  it('never overwrites a value the user typed', () => {
    const merged = mergeIdentity(
      { email: 'user@typed.com', links: {} },
      { email: 'parsed@resume.com', phone: '+1 555 123 4567' },
    )
    expect(merged.email).toBe('user@typed.com')
    // An absent field is still filled in from the parse.
    expect(merged.phone).toBe('+1 555 123 4567')
  })

  it('prefers user links over extracted ones for the same platform', () => {
    const merged = mergeIdentity(
      { links: { github: 'https://github.com/correct' } },
      { links: { github: 'https://github.com/stale', linkedin: 'https://linkedin.com/in/x' } },
    )
    expect(merged.links.github).toBe('https://github.com/correct')
    expect(merged.links.linkedin).toBe('https://linkedin.com/in/x')
  })
})

describe('htmlToText', () => {
  it('drops script and style content entirely', () => {
    const text = htmlToText('<style>.a{color:red}</style><p>Hello</p><script>evil()</script>')
    expect(text).toContain('Hello')
    expect(text).not.toContain('color:red')
    expect(text).not.toContain('evil')
  })

  it('turns block-level closes into line breaks', () => {
    expect(htmlToText('<p>One</p><p>Two</p>').trim().split('\n').filter(Boolean).length).toBe(2)
  })

  it('decodes the entities that actually show up in prose', () => {
    expect(htmlToText('<p>R&amp;D &lt;tag&gt; &quot;quoted&quot;&nbsp;end</p>')).toContain(
      'R&D <tag> "quoted" end',
    )
  })

  it('decodes numeric entities', () => {
    expect(htmlToText('<p>caf&#233;</p>')).toContain('café')
  })
})
