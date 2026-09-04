import { offerFor, PLAN_LIMITS, PLAN_LONGFORM_LIMITS } from '@aff/shared/constants'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { Account, Profile } from '../../../generated/model/index.js'
import { factCount, reconcile } from '../../../lib/fact-catalog.js'
import { formatCount, plural } from '../../../lib/format.js'
import { sendMessage } from '../../../lib/messaging.js'
import { usePaywallSeen } from '../../../lib/paywall.js'
import type { ActivePage } from '../../../lib/use-active-page.js'
import {
  Button,
  Card,
  EmptyState,
  Kbd,
  ListCard,
  Mascot,
  ProBadge,
  Row,
  Screen,
  ScreenBody,
  ScreenHeader,
  SkeletonText,
  UpgradeSheet,
} from '../components.js'
import { IconLink, IconList, IconMascot, IconPlus, IconSparkle } from '../icons.js'
import { useNavigation } from '../navigation.js'

/**
 * The key that fires a fill, as the browser reports it.
 *
 * Read rather than assumed: `chrome://extensions/shortcuts` lets anyone rebind or unbind the
 * command, and a panel that advertises `⌥F` to somebody who unbound it is the source of "I
 * pressed it and nothing happened". `null` means no binding, and the hint is simply absent.
 */
function useShortcut(): string | null {
  const query = useQuery({
    queryKey: ['shortcut'],
    queryFn: async () => {
      const result = await sendMessage({ type: 'overlay/shortcut' })
      return result.ok ? (result.value?.label ?? null) : null
    },
    staleTime: 60_000,
  })
  return query.data ?? null
}

/** The site's own mark, from Chrome's favicon cache. Falls back to a link glyph. */
function Favicon({ origin }: { origin: string }) {
  const [failed, setFailed] = useState(false)
  const url = `${chrome.runtime.getURL('/_favicon/')}?pageUrl=${encodeURIComponent(`https://${origin}`)}&size=32`

  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border-muted bg-surface-muted">
      {failed ? (
        <IconLink className="size-3.5 text-ink-dim" />
      ) : (
        <img src={url} alt="" onError={() => setFailed(true)} className="size-4 rounded-sm" />
      )}
    </span>
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
  const shortcut = useShortcut()
  const sources = profile?.sources ?? []
  const readyCount = sources.filter((source) => source.status === 'ready').length
  const facts = profile ? factCount(reconcile(profile)) : 0

  const { used, limit, longLimit, plan } = account.quota
  const exhausted = used >= limit
  const [showUpgrade, setShowUpgrade] = useState(false)
  const { seen: paywallSeen, markSeen } = usePaywallSeen()

  /**
   * Whether this screen is allowed to mention money at all.
   *
   * Not until the person has tried to fill something. `used > 0` is the proof a fill has been
   * attempted on the free grant, and `paywallSeen` is sticky once they have met the offer.
   * The header's Upgrade button is gated on this too — it used to show on every free account,
   * which put a price on the one screen the user opens most before they had seen the product run.
   */
  const showMoney = account.subscription != null || paywallSeen || used > 0

  const upgradeReason =
    plan === 'free'
      ? used >= limit
        ? `It has done ${limit} auto-fills and written ${longLimit} long answers for you. Pro is ${formatCount(PLAN_LIMITS.pro)} form fields and ${PLAN_LONGFORM_LIMITS.pro} long answers a month.`
        : `You have ${Math.max(0, limit - used)} free auto-${plural(Math.max(0, limit - used), 'fill')} left. Pro is ${formatCount(PLAN_LIMITS.pro)} form fields and ${PLAN_LONGFORM_LIMITS.pro} long answers every month.`
      : `You've filled all ${limit} fields your plan covers this month. They reset on the 1st.`

  const checking = page.status === 'checking'
  /** No form, or a page we are not allowed to read. Either way there is nothing to press. */
  const nothingToFill = !checking && (page.status === 'unavailable' || page.fieldCount === 0)
  const profileBlocked = !account.profileReady

  /** The paywall, at the only moment it earns the interruption. */
  const handleFill = () => {
    if (exhausted) {
      markSeen()
      setShowUpgrade(true)
      return
    }
    onFill()
  }

  /**
   * Where to go from here, as rows. For somebody with nothing on file the useful screen is the
   * adding screen; once there is something, the profile is a fact worth being able to check.
   */
  const links = (
    <ListCard>
      {hasLastFill && (
        <Row
          icon={<IconSparkle className="size-4" />}
          title="Last fill on this page"
          detail="What it wrote, and what it guessed"
          onClick={() => nav.push({ name: 'receipt' })}
        />
      )}
      {readyCount > 0 || facts > 0 ? (
        <Row
          icon={<IconList className="size-4" />}
          title="Profile"
          detail={`${readyCount} ${plural(readyCount, 'source')} · ${facts} ${plural(facts, 'fact')}`}
          onClick={() => nav.goToTab('yourInfo')}
        />
      ) : (
        <Row
          icon={<IconPlus className="size-4" />}
          title="Add your info"
          detail="A résumé or a link is enough to start"
          onClick={() => nav.push({ name: 'addInfo' })}
        />
      )}
    </ListCard>
  )

  return (
    <Screen>
      <ScreenHeader
        title={
          <span className="flex items-center gap-2">
            <Mascot size={18} className="shrink-0" />
            <span>Fillaform</span>
          </span>
        }
        right={
          plan !== 'free' ? (
            <ProBadge plan={plan} />
          ) : showMoney ? (
            <Button variant="ghost" size="sm" onClick={() => setShowUpgrade(true)}>
              Upgrade
            </Button>
          ) : undefined
        }
      />

      {nothingToFill ? (
        <ScreenBody className="flex flex-col px-gutter py-3">
          <EmptyState
            mascot={page.status === 'unavailable' ? 'flat' : 'think'}
            title={page.status === 'unavailable' ? 'Nothing to fill here' : 'No form on this page'}
            body={
              page.status === 'unavailable'
                ? 'This kind of page cannot be read.'
                : `Nothing to fill on ${page.origin ?? 'this page'}. Open a page with a form and it shows up here.`
            }
            action={<div className="w-full">{links}</div>}
          />
        </ScreenBody>
      ) : (
        <ScreenBody className="flex flex-col gap-3 px-gutter py-3">
          <Card className="p-3.5">
            {checking ? (
              <div className="flex items-center gap-2.5">
                <SkeletonText className="size-7 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <SkeletonText className="h-3 w-3/5" />
                  <SkeletonText className="h-2.5 w-2/5" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                {page.origin && <Favicon origin={page.origin} />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{page.origin}</p>
                  <p className="tnum text-xs text-ink-dim">
                    {page.fieldCount} {plural(page.fieldCount, 'field')} found
                  </p>
                </div>
              </div>
            )}

            {/* Nothing to press while we are still looking. */}
            {!checking && (
              <div className="mt-3.5">
                {profileBlocked ? (
                  <>
                    <Button
                      variant="primary"
                      size="lg"
                      block
                      onClick={() => nav.push({ name: 'addInfo' })}
                    >
                      <IconPlus className="size-4" />
                      Add your info
                    </Button>
                    <p className="mt-2 text-xs text-ink-dim">
                      It needs something to answer from: a résumé, a link, a few notes.
                    </p>
                  </>
                ) : (
                  <>
                    <Button variant="primary" size="lg" block onClick={handleFill}>
                      <IconMascot className="size-4" />
                      Fill this form
                    </Button>

                    {exhausted && showMoney ? (
                      <p className="mt-2 text-xs text-ink-muted">
                        {plan === 'free'
                          ? `You've used all ${limit} free auto-fills.`
                          : `You've filled all ${limit} fields your plan covers this month.`}{' '}
                        <button
                          type="button"
                          onClick={() => {
                            markSeen()
                            setShowUpgrade(true)
                          }}
                          className="font-medium text-accent hover:underline"
                        >
                          {plan === 'free' ? 'Start free trial' : 'See plans'}
                        </button>
                      </p>
                    ) : shortcut ? (
                      <p className="mt-2 flex items-center gap-1.5 text-2xs text-ink-dim">
                        Or press <Kbd>{shortcut}</Kbd> on the page
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            )}
          </Card>

          {!profileBlocked && links}
        </ScreenBody>
      )}

      {showUpgrade && (
        <UpgradeSheet
          onClose={() => setShowUpgrade(false)}
          mode={offerFor(plan)}
          reason={upgradeReason}
        />
      )}
    </Screen>
  )
}
