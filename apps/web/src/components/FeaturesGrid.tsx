import { Reveal } from '@/components/Reveal'

const FEATURES = [
  {
    title: 'Any form, any site',
    description:
      'Job applications, Google Forms, event registrations, surveys, contact forms — if it has fields, Fillaform fills it.',
    emoji: '🌐',
  },
  {
    title: 'Answers in your voice',
    description:
      'Not a templated profile mapper. Fillaform reads your writing and composes open-ended answers the way you would.',
    emoji: '🎙️',
  },
  {
    title: 'Read vs. guessed',
    description:
      'Lime means it read straight off your profile. Hot pink + sparkle means it guessed — check me. No wrong-but-confident surprises.',
    emoji: '💖',
  },
  {
    title: 'Built for the big ATSes',
    description:
      'Dedicated adapters for Greenhouse, Lever, Ashby and Google Forms, plus a generic fallback for everything else.',
    emoji: '🏢',
  },
  {
    title: 'Your data, your control',
    description:
      'You decide what to feed it and what to fill. Nothing is submitted automatically — review every answer first.',
    emoji: '🔐',
  },
  {
    title: 'Free to start',
    description:
      'Fill 5 forms a month on the free plan, forever. Upgrade for more when you need it.',
    emoji: '✨',
  },
]

export function FeaturesGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((f, idx) => (
        <Reveal key={f.title} delay={idx * 0.06} className="h-full">
          <div className="group flex h-full flex-col rounded-2xl border border-border-muted bg-surface-raised p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-card">
            <span className="text-[26px] transition-transform duration-200 group-hover:scale-110">
              {f.emoji}
            </span>
            <h3 className="display mt-3 text-[18px] text-ink">{f.title}</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">{f.description}</p>
          </div>
        </Reveal>
      ))}
    </div>
  )
}
