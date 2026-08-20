import type { ComponentType } from 'react'
import { Reveal } from '@/components/Reveal'
import { IconBuilding, IconGift, IconGlobe, IconLock, IconMarks, IconQuote } from '@/components/ui'

const FEATURES: {
  title: string
  description: string
  Icon: ComponentType<{ className?: string }>
}[] = [
  {
    title: 'Any form, any site',
    description:
      'Job applications, Google Forms, event registrations, surveys, contact forms — if it has fields, Fillaform fills it.',
    Icon: IconGlobe,
  },
  {
    title: 'Answers in your voice',
    description:
      'Not a templated profile mapper. Fillaform reads your writing and composes open-ended answers the way you would.',
    Icon: IconQuote,
  },
  {
    title: 'Read vs. guessed',
    description:
      'Lime means it read straight off your profile. Hot pink + sparkle means it guessed — check me. No wrong-but-confident surprises.',
    Icon: IconMarks,
  },
  {
    title: 'Built for the big ATSes',
    description:
      'Dedicated adapters for Greenhouse, Lever, Ashby and Google Forms, plus a generic fallback for everything else.',
    Icon: IconBuilding,
  },
  {
    title: 'Your data, your control',
    description:
      'You decide what to feed it and what to fill. Nothing is submitted automatically — review every answer first.',
    Icon: IconLock,
  },
  {
    title: 'Free to start',
    description:
      'Fill 5 forms a month on the free plan, forever. Upgrade for more when you need it.',
    Icon: IconGift,
  },
]

export function FeaturesGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map(({ title, description, Icon }, idx) => (
        <Reveal key={title} delay={idx * 0.06} className="h-full">
          <div className="group flex h-full flex-col rounded-2xl border border-border-muted bg-surface-raised p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-card">
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent-muted text-accent transition-transform duration-200 group-hover:scale-105">
              <Icon className="size-5" />
            </span>
            <h3 className="display mt-4 text-[18px] text-ink">{title}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{description}</p>
          </div>
        </Reveal>
      ))}
    </div>
  )
}
