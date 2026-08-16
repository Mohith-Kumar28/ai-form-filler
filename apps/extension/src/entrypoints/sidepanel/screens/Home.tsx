import type { Account, Profile } from '../../../generated/model/index.js'
import { openManageSubscription, openUpgrade } from '../../../lib/billing.js'
import { formatResetDate, plural } from '../../../lib/format.js'
import type { ActivePage } from '../../../lib/use-active-page.js'
import {
  Button,
  Card,
  Row,
  RowGroup,
  Screen,
  ScreenBody,
  ScreenHeader,
  SkeletonText,
} from '../components.js'
import { IconGear, IconSparkle } from '../icons.js'
import { useNavigation } from '../navigation.js'

const PLAN_NAMES: Record<string, string> = { free: 'Free', pro: 'Pro', ultra: 'Ultra' }

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
            : 'No form found. Try a page with inputs, and it will show up here.'}
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
            <span>you fill</span>
          </span>
        }
        right={
          <button
            type="button"
            onClick={() => nav.push({ name: 'settings' })}
            aria-label="Settings"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <IconGear className="size-4" />
          </button>
        }
      />

      <ScreenBody className="flex flex-col">
        {/* The form you're looking at. */}
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

            {blockedReason && (
              <p className="mt-2 text-[12.5px] leading-snug text-ink-muted">{blockedReason}</p>
            )}

            {!blockedReason && left <= 3 && (
              <p className="mt-2 text-[12.5px] leading-snug text-ink-muted">
                {left === 0
                  ? 'That was your last one this month!'
                  : `${left} ${plural(left, 'form')} left this month.`}{' '}
                {account.quota.plan === 'free' && (
                  <button
                    type="button"
                    onClick={() => void openUpgrade()}
                    className="font-semibold text-accent underline underline-offset-2 hover:no-underline"
                  >
                    Upgrade
                  </button>
                )}
              </p>
            )}
          </div>
        </Card>

        <RowGroup>
          <Row
            icon={<IconSparkle className="size-4" />}
            title="What it knows"
            detail={
              sources.length === 0
                ? 'Add a résumé, a link, or a few facts'
                : readyCount === sources.length
                  ? `${readyCount} ${plural(readyCount, 'source')} it can answer from`
                  : `${readyCount} of ${sources.length} ready`
            }
            onClick={() => nav.push({ name: 'sources' })}
          />
          {hasLastFill && (
            <Row
              title="Last fill on this page"
              detail="What it wrote, and what it guessed"
              onClick={() => nav.push({ name: 'review' })}
            />
          )}
          <Row
            title="Plan"
            detail={
              account.subscription?.status === 'trial'
                ? `${PLAN_NAMES[account.quota.plan]} trial · ${left} ${plural(left, 'form')} left`
                : `${PLAN_NAMES[account.quota.plan]} · ${used}/${limit} this month`
            }
            value={account.quota.plan === 'free' ? 'Upgrade' : 'Manage'}
            onClick={() =>
              account.quota.plan === 'free' ? void openUpgrade() : void openManageSubscription()
            }
          />
        </RowGroup>
      </ScreenBody>
    </Screen>
  )
}
