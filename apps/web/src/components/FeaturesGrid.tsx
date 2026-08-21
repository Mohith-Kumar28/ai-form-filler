import type { ComponentType } from 'react'
import { Reveal } from '@/components/Reveal'
import {
  IconBuilding,
  IconGift,
  IconGlobe,
  IconLock,
  IconMarks,
  IconPen,
  IconQuote,
  IconSources,
  IconSparkle,
} from '@/components/ui'

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
    title: 'Rewrite it without starting over',
    description:
      'Not quite right? Ask for it warmer, more confident, plainer, more formal, shorter or longer — on the answer you already have, not a fresh one. On Pro you can just type what to change.',
    Icon: IconPen,
  },
  {
    title: 'It gets better as you use it',
    description:
      'Every answer you settle on teaches it how you write. The tenth application reads more like you than the first, and you never have to correct the same thing twice.',
    Icon: IconSparkle,
  },
  {
    title: 'Feed it however you like',
    description:
      'A CV, a spreadsheet, a link, a screenshot — or talk for a minute and let it listen. Add your own facts by hand for the things no document mentions, like your notice period.',
    Icon: IconSources,
  },
  {
    title: 'Nothing is sent without you',
    description:
      'Fillaform fills the fields and stops. You review and press submit yourself. Delete any of your details, or all of them, whenever you like.',
    Icon: IconLock,
  },
  {
    title: 'Two weeks of Pro, free',
    description:
      'The whole thing, on real applications, before you decide. A card starts the trial, nothing is charged until day 15, and cancelling before then costs nothing. Then $5 a month.',
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
