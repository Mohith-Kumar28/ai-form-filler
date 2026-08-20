import { useRef } from 'react'
import { Reveal } from '@/components/Reveal'
import { IconSparkle, Mascot, MascotPattern, useMascotGaze } from '@/components/ui'
import { site } from '@/lib/site'

export function ChromeCTA() {
  const gazeRef = useRef<HTMLDivElement>(null)
  const look = useMascotGaze(gazeRef)

  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <MascotPattern className="absolute inset-0 h-full w-full text-accent" opacity={0.07} />
        <div
          className="absolute top-1/2 left-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.14] blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--accent), transparent 70%)' }}
        />
        <div
          className="absolute top-1/3 left-1/4 h-72 w-72 rounded-full opacity-[0.1] blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--sparkle), transparent 70%)' }}
        />
      </div>

      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <Reveal>
          <div ref={gazeRef} className="mx-auto w-fit">
            <Mascot
              expression="party"
              size={72}
              look={look}
              blink
              className="animate-breathe hover-wobble"
            />
          </div>
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
