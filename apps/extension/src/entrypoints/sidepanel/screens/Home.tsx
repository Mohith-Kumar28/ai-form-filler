import { offerFor } from '@aff/shared/constants'
import { useState } from 'react'
import type { Account, Profile } from '../../../generated/model/index.js'
import { plural } from '../../../lib/format.js'
import { usePaywallSeen } from '../../../lib/paywall.js'
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
  const exhausted = used >= limit
  const [showUpgrade, setShowUpgrade] = useState(false)
  const { seen: paywallSeen, markSeen } = usePaywallSeen()

  /**
   * Whether this screen is allowed to mention money at all.
   *
   * It is not, until the person has tried to fill something. They arrive here having installed an
   * extension, and the honest order is: let them put their résumé in, let them see what it knows,
   * and ask for a card at the moment they ask it to do the work. A line reading "0 of 0 fields
   * left" before any of that is a price tag on a product they have not seen run.
   *
   * Note what this no longer gates: the running count itself. The header used to carry "596 of 600
   * fields left this month" on every open, which is a meter on the one screen whose whole job is a
   * single button — the number is never the reason somebody came here, and a budget quietly
   * counting down above the action is a reason to hesitate before pressing it. The count lives on
   * Account, where a person goes *to* look at it. What survives here is the one case where the
   * number is the answer to a question the user just asked: they pressed Fill and nothing
   * happened.
   */
  const showMoney = account.subscription != null || paywallSeen

  const canFill = page.status === 'ready' && page.fieldCount > 0

  const profileBlocked = !account.profileReady
  const blockedReason = profileBlocked
    ? 'Add something about yourself first: a résumé, a link, whatever.'
    : null

  /**
   * The paywall, at the only moment it earns the interruption.
   *
   * `exhausted` covers both cases with one branch, which is the point of giving an account with no
   * subscription a limit of zero: the person who has never paid and the person who has run out
   * this month meet the same wall, and the sheet chooses its own words from the plan.
   */
  const handleFill = () => {
    if (exhausted) {
      markSeen()
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
              {/*
                The button says what it does, not what it costs.

                It used to read "Upgrade to fill" the moment the allowance ran out, which turns the
                one action on the screen into an advertisement. Pressing Fill still opens the sheet
                — see `handleFill` — so nothing is hidden; the label simply does not pre-empt it.
              */}
              Fill this form
            </Button>

            {blockedReason ? (
              <p className="mt-2 text-xs leading-snug text-ink-muted">{blockedReason}</p>
            ) : exhausted && showMoney ? (
              <p className="mt-2 text-xs leading-snug text-ink-muted">
                {limit === 0
                  ? 'Start your free trial to fill this form.'
                  : `You've filled all ${limit} fields your plan covers this month.`}{' '}
                <button
                  type="button"
                  onClick={() => {
                    markSeen()
                    setShowUpgrade(true)
                  }}
                  className="font-semibold text-accent underline-offset-2 hover:underline"
                >
                  {limit === 0 ? 'Start free trial' : 'See plans'}
                </button>
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
          mode={offerFor(limit)}
          reason={
            limit === 0
              ? // Names what they have already built, because that is the reason to say yes.
                readyCount > 0
                ? `Start the trial and it will answer this form from the ${readyCount} ${plural(readyCount, 'source')} you added.`
                : undefined
              : `You've filled all ${limit} fields your plan covers this month. They reset on the 1st.`
          }
        />
      )}
    </Screen>
  )
}
