import { useState } from 'react'
import type { Account, Profile } from '../../../generated/model/index.js'
import { plural } from '../../../lib/format.js'
import type { ActivePage } from '../../../lib/use-active-page.js'
import {
  Button,
  Card,
  Mascot,
  ProBadge,
  Screen,
  ScreenBody,
  ScreenHeader,
  SkeletonText,
  SUNSET_GRADIENT,
  UpgradeSheet,
} from '../components.js'
import { IconCrown, IconMascot, IconSparkle } from '../icons.js'
import { useNavigation } from '../navigation.js'

function PageEntry({ page }: { page: ActivePage }) {
  if (page.status === 'checking') {
    return (
      <div className="space-y-2.5">
        <SkeletonText className="h-5 w-3/5" />
        <SkeletonText className="h-3.5 w-2/5" />
      </div>
    )
  }

  if (page.status === 'unavailable' || page.fieldCount === 0) {
    return (
      <div>
        <p className="font-display text-[18px] font-bold tracking-[-0.02em] text-ink">
          {page.origin ?? 'Nothing to fill here'}
        </p>
        <p className="mt-1 text-[13px] leading-snug text-ink-muted">
          {page.status === 'unavailable'
            ? 'This kind of page cannot be read. Browser pages and the Web Store are off limits.'
            : 'No form found. Open a page with inputs and it will show up here.'}
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="font-display text-[18px] font-bold tracking-[-0.02em] text-ink">
        {page.origin}
      </p>
      <p className="mt-1 text-[13px] font-medium text-ink-muted">
        {page.fieldCount} {plural(page.fieldCount, 'field')} found
      </p>
    </div>
  )
}

export function Home({
  account,
  profile,
  page,
  hasLastFill,
  onFill,
}: {
  account: Account
  profile: Profile | undefined
  page: ActivePage
  hasLastFill: boolean
  onFill: () => void
}) {
  const nav = useNavigation()
  const sources = profile?.sources ?? []
  const readyCount = sources.filter((source) => source.status === 'ready').length

  const { used, limit, plan } = account.quota
  const left = Math.max(0, limit - used)
  const exhausted = used >= limit
  const [showUpgrade, setShowUpgrade] = useState(false)

  const canFill = page.status === 'ready' && page.fieldCount > 0

  const profileBlocked = !account.profileReady
  const blockedReason = profileBlocked
    ? 'Add something about yourself first: a résumé, a link, whatever.'
    : null

  const handleFill = () => {
    if (exhausted) {
      setShowUpgrade(true)
      return
    }
    onFill()
  }

  return (
    <Screen>
      <ScreenHeader
        title={
          <span className="flex items-center gap-2">
            <Mascot size={18} className="shrink-0" />
            <span>Fillaform</span>
          </span>
        }
        right={plan !== 'free' ? <ProBadge plan={plan} /> : undefined}
      />

      <ScreenBody className="flex flex-col">
        <Card className="mx-4 mb-3 mt-4 px-4 py-4">
          <PageEntry page={page} />

          <div className="mt-4">
            <Button
              variant="primary"
              size="lg"
              block
              onClick={handleFill}
              disabled={!canFill || blockedReason !== null}
            >
              <IconMascot className="size-4" />
              {exhausted ? 'Upgrade to fill' : 'Fill this form'}
            </Button>

            {blockedReason ? (
              <p className="mt-2 text-[12.5px] leading-snug text-ink-muted">{blockedReason}</p>
            ) : exhausted ? (
              <p className="mt-2 text-[12.5px] leading-snug text-ink-muted">
                You've used all {limit} forms this month.{' '}
                <button
                  type="button"
                  onClick={() => setShowUpgrade(true)}
                  className="font-semibold text-accent underline-offset-2 hover:underline"
                >
                  Upgrade to Pro
                </button>{' '}
                to keep going.
              </p>
            ) : (
              <p className="mt-2 text-[12px] leading-snug text-ink-dim">
                {readyCount > 0
                  ? `${readyCount} ${plural(readyCount, 'source')} ready in My info`
                  : 'Add yourself in My info so it has something to answer from'}
                {left <= 3 && left > 0 && ` · ${left} ${plural(left, 'form')} left this month`}
              </p>
            )}
          </div>
        </Card>

        {hasLastFill && (
          <button
            type="button"
            onClick={() => nav.push({ name: 'receipt' })}
            className="mx-4 flex items-center gap-2.5 rounded-2xl border border-border-muted bg-surface-raised px-4 py-3 text-left transition-colors hover:bg-surface-muted"
          >
            <IconSparkle className="size-4 shrink-0 text-accent" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold text-ink">
                Last fill on this page
              </span>
              <span className="block text-[12px] text-ink-dim">
                What it wrote, and what it judged
              </span>
            </span>
          </button>
        )}

        {plan === 'free' && (
          <div className="mx-4 mt-4 mb-4 rounded-2xl border border-border-muted bg-surface-raised px-4 py-4">
            <div className="flex items-center gap-2">
              <IconCrown className="size-4 text-accent" />
              <p className="text-[13px] font-semibold text-ink">Why upgrade?</p>
            </div>
            <div className="mt-2.5 space-y-2">
              {[
                { label: 'Unlimited fills', detail: 'No monthly cap' },
                { label: 'Better AI models', detail: 'Frontier models for complex forms' },
                { label: 'Larger uploads', detail: 'Up to 30 MB per file' },
                { label: 'More sources', detail: 'Store up to 25 documents' },
              ].map((perk) => (
                <div key={perk.label} className="flex items-start gap-2">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-3 text-accent"
                      aria-hidden="true"
                    >
                      <path d="M3.5 8.5 6.5 11.5 12.5 5" />
                    </svg>
                  </span>
                  <div>
                    <span className="text-[12.5px] font-medium text-ink">{perk.label}</span>
                    <span className="ml-1.5 text-[12px] text-ink-dim">{perk.detail}</span>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowUpgrade(true)}
              className="mt-3 w-full rounded-full py-2 text-[13px] font-bold text-white transition-[filter] hover:brightness-110 active:brightness-95"
              style={{
                background: SUNSET_GRADIENT,
              }}
            >
              Upgrade to Pro
            </button>
          </div>
        )}
      </ScreenBody>

      {showUpgrade && (
        <UpgradeSheet
          onClose={() => setShowUpgrade(false)}
          reason={
            exhausted
              ? `You've used all ${limit} free forms this month. Upgrade to Pro for unlimited fills and never hit a wall again.`
              : undefined
          }
        />
      )}
    </Screen>
  )
}
