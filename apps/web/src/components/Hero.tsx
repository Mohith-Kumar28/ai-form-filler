import { motion, useReducedMotion } from 'motion/react'
import { IconSparkle, Mascot } from '@/components/ui'
import { site } from '@/lib/site'

export function Hero() {
  const reduce = useReducedMotion()

  return (
    <section className="relative overflow-hidden pt-28 pb-20 md:pt-40 md:pb-28">
      {/* soft sunset blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full opacity-25 blur-3xl" style={{ background: 'linear-gradient(135deg, var(--sparkle), var(--accent))' }} />
        <div className="absolute top-40 -left-32 h-80 w-80 rounded-full opacity-20 blur-3xl" style={{ background: 'linear-gradient(135deg, var(--accent), var(--sun))' }} />
        <div className="absolute right-1/4 -bottom-32 h-72 w-72 rounded-full opacity-15 blur-3xl" style={{ background: 'var(--sparkle)' }} />
      </div>

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          className="mx-auto inline-flex items-center gap-2 rounded-full border border-border-muted bg-surface-raised px-4 py-1.5 text-[12.5px] font-medium text-ink-muted"
        >
          <IconSparkle className="size-3.5 text-accent" />
          The AI form filler that actually sounds like you
        </motion.div>

        <motion.h1
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.2, 0, 0, 1] }}
          className="display mt-6 text-[44px] leading-[1.05] text-ink md:text-[68px]"
        >
          Forms are homework.
          <br />
          <span className="sunset-text">Your hype friend</span> does them.
        </motion.h1>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.16, ease: [0.2, 0, 0, 1] }}
          className="mx-auto mt-6 max-w-[52ch] text-[16px] leading-relaxed text-ink-muted md:text-[17px]"
        >
          Fillaform reads your résumé, links and notes, then fills{' '}
          <strong className="font-semibold text-ink">any form</strong> — job applications, Google
          Forms, registrations, surveys — in your own voice. It flags what it{' '}
          <span className="font-semibold text-accent">guessed</span> and cheers you on the whole way.
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.24, ease: [0.2, 0, 0, 1] }}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
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
            href="#demo"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-raised px-6 py-3 text-[15px] font-semibold text-ink no-underline transition-colors duration-150 hover:bg-surface-muted"
          >
            Watch it fill a form
          </a>
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
          className="mt-12 flex items-center justify-center gap-2"
        >
          <Mascot expression="happy" size={44} className={reduce ? '' : 'animate-bounce'} />
          <div className="text-left">
            <p className="text-[12px] font-semibold text-ink">"I filled 12 fields in 20 seconds"</p>
            <p className="text-[11.5px] text-ink-dim">— every person who hates retyping their address</p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}