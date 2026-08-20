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
      'Job applications, Google Forms, registrations, surveys, contact forms. If a page has fields, Fillaform fills them.',
    Icon: IconGlobe,
  },
  {
    title: 'Written answers, not templates',
    description:
      '\u201cWhy do you want to work here?\u201d gets a real answer, drawn from your own notes and written the way you write.',
    Icon: IconQuote,
  },
  {
    title: 'It tells you what it guessed',
    description:
      'Answers taken straight from your details are left alone. Anything Fillaform inferred gets a small label, so you review those and nothing else.',
    Icon: IconMarks,
  },
  {
    title: 'Knows the big job sites',
    description:
      'Purpose-built support for Greenhouse, Lever, Ashby and Google Forms, plus a general fallback that handles everything else.',
    Icon: IconBuilding,
  },
  {
    title: 'Nothing is sent without you',
    description:
      'Fillaform fills the fields and stops. You review and press submit yourself. Delete any of your details, or all of them, whenever you like.',
    Icon: IconLock,
  },
  {
    title: 'Free to start',
    description:
      'Five forms a month, free, with no card and no time limit. Upgrade only if you need more.',
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
