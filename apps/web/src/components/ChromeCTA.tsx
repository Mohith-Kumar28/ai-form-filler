import { Reveal } from '@/components/Reveal'
import { IconSparkle, Mascot } from '@/components/ui'
import { site } from '@/lib/site'

export function ChromeCTA() {
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.04]"
        aria-hidden
      >
        <Mascot expression="party" size={720} />
      </div>

      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <Reveal>
          <Mascot expression="party" size={64} className="mx-auto animate-bounce" />
          <h2 className="display mt-6 text-[34px] leading-tight text-ink md:text-[52px]">
            Stop retyping.
            <br />
            <span className="sunset-text">Start filling.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-[46ch] text-[15px] leading-relaxed text-ink-muted">
            Add Fillaform to Chrome, feed it once, and never fill the same information twice. Five
            forms a month on us — no card required.
          </p>
          <div className="mt-9 flex justify-center">
            <a
              href={site.chromeWebStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-semibold text-white no-underline shadow-glow transition-[filter] duration-150 hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, var(--sparkle), var(--accent))' }}
            >
              <IconSparkle className="size-4.5" />
              Add to Chrome — it's free
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
