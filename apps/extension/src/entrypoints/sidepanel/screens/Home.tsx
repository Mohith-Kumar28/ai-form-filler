import type { Account, Profile } from '../../../generated/model/index.js'
import { formatResetDate, plural } from '../../../lib/format.js'
import type { ActivePage } from '../../../lib/use-active-page.js'
import { Button, Card, Screen, ScreenBody, ScreenHeader, SkeletonText } from '../components.js'
import { IconSparkle } from '../icons.js'
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
            ? 'This kind of page cannot be read — browser pages and the Web Store are off limits.'
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

  const { used, limit, resetsAt } = account.quota
  const left = Math.max(0, limit - used)
  const exhausted = used >= limit

  const canFill = page.status === 'ready' && page.fieldCount > 0

  const blockedReason = !account.profileReady
    ? 'Add something about yourself first — a résumé, a link, whatever.'
    : exhausted
      ? `Out of forms until ${formatResetDate(resetsAt)}. Upgrade to keep going.`
      : null

  return (
    <Screen>
      <ScreenHeader
        title={
          <span className="flex items-center gap-2">
            <IconSparkle className="size-4 shrink-0 text-accent" />
            <span>Fillaform</span>
          </span>
        }
      />

      <ScreenBody className="flex flex-col">
        {/* The form in front of you. */}
        <Card className="mx-4 mb-3 mt-4 px-4 py-4">
          <PageEntry page={page} />

          <div className="mt-4">
            <Button
              variant="primary"
              size="lg"
              block
              onClick={onFill}
              disabled={!canFill || blockedReason !== null}
            >
              <IconSparkle className="size-4" />
              Fill this form
            </Button>

            {blockedReason ? (
              <p className="mt-2 text-[12.5px] leading-snug text-ink-muted">{blockedReason}</p>
            ) : (
              <p className="mt-2 text-[12px] leading-snug text-ink-dim">
                {readyCount > 0
                  ? `${readyCount} ${plural(readyCount, 'source')} ready in My info`
                  : 'Add yourself in My info so it has something to answer from'}
                {left <= 3 && ` · ${left} ${plural(left, 'form')} left this month`}
              </p>
            )}
          </div>
        </Card>

        {hasLastFill && (
          <button
            type="button"
            onClick={() => nav.push({ name: 'review' })}
            className="mx-4 flex items-center gap-2.5 rounded-2xl border border-border-muted bg-surface-raised px-4 py-3 text-left transition-colors hover:bg-surface-muted"
          >
            <IconSparkle className="size-4 shrink-0 text-accent" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold text-ink">
                Last fill on this page
              </span>
              <span className="block text-[12px] text-ink-dim">
                What it wrote, and what needs a look
              </span>
            </span>
          </button>
        )}
      </ScreenBody>
    </Screen>
  )
}
