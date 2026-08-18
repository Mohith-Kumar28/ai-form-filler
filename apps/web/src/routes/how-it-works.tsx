import { createFileRoute } from '@tanstack/react-router'
import { Reveal } from '@/components/Reveal'
import { buildMeta, canonicalLink } from '@/lib/seo'
import { site } from '@/lib/site'

const title = 'How Fillaform Works'
const description =
  'Learn how Fillaform fills any web form in your own voice. Feed it your resume and links, it builds a knowledge graph, then fills any form with answers that sound like you.'

export const Route = createFileRoute('/how-it-works')({
  head: () => ({
    meta: buildMeta({ title: `${title} — ${site.name}`, description, path: '/how-it-works' }),
    links: [canonicalLink('/how-it-works')],
  }),
  component: HowItWorksPage,
})

function HowItWorksPage() {
  return (
    <div className="pt-24 pb-20 md:pt-32 md:pb-28">
      <div className="mx-auto max-w-3xl px-6">
        <Reveal>
          <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-accent">
            Three steps
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink md:text-5xl">
            {title}
          </h1>
        </Reveal>

        <div className="mt-16 space-y-20">
          <Step
            num="1"
            title="Feed it your material"
            content={
              <>
                <p>
                  Fillaform accepts four kinds of input: <strong>documents</strong> (resume PDF,
                  transcripts), <strong>links</strong> (LinkedIn, GitHub, portfolio site),{' '}
                  <strong>pasted text</strong> (notes, essays, bio), and <strong>images</strong>{' '}
                  (screenshots, certificates).
                </p>
                <p>
                  Each source is parsed and compiled into a structured profile. Key identity fields
                  — name, email, phone — are extracted deterministically so they answer without a
                  model call. Everything else is stored in a searchable memory layer.
                </p>
              </>
            }
          />

          <Step
            num="2"
            title="It builds a knowledge graph"
            content={
              <>
                <p>
                  Behind the scenes, Fillaform builds a retrieval-augmented profile from your
                  material. When a form asks &ldquo;Tell us about a time you led a team&rdquo;, it
                  searches your memory for relevant experiences rather than writing from a generic
                  template.
                </p>
                <p>
                  It also learns your writing voice from patterns in your accepted answers. The
                  result: open-ended responses that sound like <em>you</em>, not like an AI.
                </p>
              </>
            }
          />

          <Step
            num="3"
            title="Fill any form, anywhere"
            content={
              <>
                <p>
                  Navigate to any form — a job application on Greenhouse, a Google Form survey, an
                  event registration page. Click the Fillaform icon. It reads every field on the
                  page, maps them to your knowledge graph, and fills them in.
                </p>
                <p>
                  Each answer carries a stamp. Unmarked answers were read directly from your
                  profile. Answers with a{' '}
                  <strong className="text-accent">vermilion CONCLUDED stamp</strong> were inferred —
                  you should review these before submitting.
                </p>
              </>
            }
          />
        </div>
      </div>
    </div>
  )
}

function Step({
  num,
  title: stepTitle,
  content,
}: {
  num: string
  title: string
  content: React.ReactNode
}) {
  return (
    <Reveal>
      <div className="flex gap-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink font-sans text-sm font-semibold text-surface">
          {num}
        </span>
        <div>
          <h2 className="text-xl font-semibold text-ink">{stepTitle}</h2>
          <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-ink-muted">{content}</div>
        </div>
      </div>
    </Reveal>
  )
}
