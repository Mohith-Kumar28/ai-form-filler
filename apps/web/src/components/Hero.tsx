import { motion, useReducedMotion } from 'motion/react'
import { IconSparkle, Mascot } from '@/components/ui'
import { ExtensionDemo } from '@/components/ExtensionDemo'
import { site } from '@/lib/site'

export function Hero() {
  const reduce = useReducedMotion()

  return (
    <section className="relative overflow-hidden pt-28 pb-20 md:pt-36 md:pb-28">
      {/* soft sunset blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full opacity-25 blur-3xl" style={{ background: 'linear-gradient(135deg, var(--sparkle), var(--accent))' }} />
        <div className="absolute top-40 -left-32 h-80 w-80 rounded-full opacity-20 blur-3xl" style={{ background: 'linear-gradient(135deg, var(--accent), var(--sun))' }} />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-start gap-12 px-6 lg:grid-cols-2 lg:gap-16">
        {/* Left — text */}
        <div className="pt-6 lg:pt-12">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            className="inline-flex items-center gap-2 rounded-full border border-border-muted bg-surface-raised px-4 py-1.5 text-[12.5px] font-medium text-ink-muted"
          >
            <IconSparkle className="size-3.5 text-accent" />
            The AI form filler that actually sounds like you
          </motion.div>

          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: [0.2, 0, 0, 1] }}
            className="display mt-6 text-[40px] leading-[1.05] text-ink md:text-[52px] lg:text-[60px]"
          >
            Forms are homework.
            <br />
            <span className="sunset-text">Your hype friend</span> does them.
          </motion.h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16, ease: [0.2, 0, 0, 1] }}
            className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-ink-muted md:text-[16px]"
          >
            Fillaform reads your résumé, links and notes, then fills{' '}
            <strong className="font-semibold text-ink">any form</strong> — job applications,
            Google Forms, registrations, surveys — in your own voice. It flags what it{' '}
            <span className="font-semibold text-accent">guessed</span> and cheers you on.
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24, ease: [0.2, 0, 0, 1] }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <a
              href={site.chromeWebStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold text-white no-underline shadow-glow transition-[filter] duration-150 hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, var(--sparkle), var(--accent))' }}
            >
              <IconSparkle className="size-4.5" />
              Add to Chrome — it's free
            </a>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-raised px-6 py-3 text-[15px] font-semibold text-ink no-underline transition-colors duration-150 hover:bg-surface-muted"
            >
              How it works
            </a>
          </motion.div>

          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-8 flex items-center gap-2"
          >
            <Mascot expression="happy" size={36} className={reduce ? '' : 'animate-bounce'} />
            <p className="text-[12px] text-ink-dim">
              &ldquo;I filled 12 fields in 20 seconds&rdquo;
            </p>
          </motion.div>
        </div>

        {/* Right — the demo */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.2, 0, 0, 1] }}
          className="lg:pt-4"
        >
          <p className="mb-3 text-center text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-dim lg:text-left">
            Click Fill this form
          </p>
          <div className="mx-auto w-full max-w-[640px] lg:max-w-full">
            <ExtensionDemo />
          </div>
        </motion.div>
      </div>
    </section>
  )
}