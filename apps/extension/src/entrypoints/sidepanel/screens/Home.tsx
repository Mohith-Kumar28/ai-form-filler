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
  UpgradeSheet,
} from '../components.js'
import { IconMascot, IconSparkle } from '../icons.js'
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
        <p className="font-display text-lg font-bold tracking-[-0.02em] text-ink">
          {page.origin ?? 'Nothing to fill here'}
        </p>
        <p className="mt-1 text-sm leading-snug text-ink-muted">
          {page.status === 'unavailable'
            ? 'This kind of page cannot be read. Browser pages and the Web Store are off limits.'
            : 'No form found. Open a page with inputs and it will show up here.'}
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="font-display text-lg font-bold tracking-[-0.02em] text-ink">{page.origin}</p>
      <p className="mt-1 text-sm font-medium text-ink-muted">
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
            <Mascot size={22} className="shrink-0" />
            <span>Fillaform</span>
          </span>
        }
        subtitle={`${left} of ${limit} ${plural(limit, 'form')} left this month`}
        right={plan !== 'free' ? <ProBadge plan={plan} /> : undefined}
      />

      <ScreenBody className="flex flex-col">
        <Card className="mx-gutter mb-2.5 mt-4 p-4">
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
              <p className="mt-2 text-xs leading-snug text-ink-muted">{blockedReason}</p>
            ) : exhausted ? (
              <p className="mt-2 text-xs leading-snug text-ink-muted">
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
              <p className="mt-2 text-xs leading-snug text-ink-dim">
                {readyCount > 0
                  ? `${readyCount} ${plural(readyCount, 'source')} ready in My info`
                  : 'Add yourself in My info so it has something to answer from'}
              </p>
            )}
          </div>
        </Card>

        {hasLastFill && (
          <button
            type="button"
            onClick={() => nav.push({ name: 'receipt' })}
            className="mx-gutter flex min-h-row items-center gap-3 rounded-2xl border border-border-muted bg-surface-raised px-4 text-left transition-colors hover:bg-surface-muted"
          >
            <IconSparkle className="size-4 shrink-0 text-accent" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">Last fill on this page</span>
              <span className="block text-xs text-ink-dim">What it wrote, and what it judged</span>
            </span>
          </button>
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
