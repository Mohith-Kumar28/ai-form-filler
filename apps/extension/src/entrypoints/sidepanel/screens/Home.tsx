import { offerFor } from '@aff/shared/constants'
import { type ReactNode, useState } from 'react'
import type { Account, Profile } from '../../../generated/model/index.js'
import { plural } from '../../../lib/format.js'
import { usePaywallSeen } from '../../../lib/paywall.js'
import type { ActivePage } from '../../../lib/use-active-page.js'
import {
  Button,
  Card,
  EmptyState,
  Mascot,
  ProBadge,
  Screen,
  ScreenBody,
  ScreenHeader,
  SkeletonText,
  SUNSET_GRADIENT,
  UpgradeSheet,
} from '../components.js'
import { IconChevronRight, IconList, IconMascot, IconPlus, IconSparkle } from '../icons.js'
import { useNavigation } from '../navigation.js'

/**
 * A destination, as a row.
 *
 * The last-fill link was already exactly this shape, written inline; a second and third one
 * made it a component. The chevron is the part worth naming — these rows all *go somewhere*,
 * and without it a row of text on a card reads as a statement about the world rather than a
 * thing to press.
 */
function ActionRow({
  icon,
  label,
  detail,
  onClick,
}: {
  icon: ReactNode
  label: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-row w-full items-center gap-3 rounded-2xl border border-border-muted bg-surface-raised px-4 text-left transition-colors hover:bg-surface-muted"
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="block text-xs leading-snug text-ink-dim">{detail}</span>
      </span>
      <IconChevronRight className="size-4 shrink-0 text-ink-dim" />
    </button>
  )
}

/**
 * What is on the page, for the states where there *is* something.
 *
 * The "nothing here" case used to live in this function too, which is why it read as a
 * variation on a heading — a hostname where a headline goes, and the reason the page could not
 * be filled squeezed underneath it. Nothing to fill is its own situation and now gets its own
 * layout; see `Home`.
 */
function PageEntry({ page }: { page: ActivePage }) {
  if (page.status === 'checking') {
    return (
      <div className="space-y-2.5">
        <SkeletonText className="h-5 w-3/5" />
        <SkeletonText className="h-3.5 w-2/5" />
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

  const checking = page.status === 'checking'
  /** No form, or a page we are not allowed to read. Either way there is nothing to press. */
  const nothingToFill = !checking && (page.status === 'unavailable' || page.fieldCount === 0)
  const profileBlocked = !account.profileReady

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

  /**
   * The one thing worth doing when this page is not the thing to do.
   *
   * It changes destination with the state of the profile rather than always pointing at the tab,
   * because for somebody with nothing on file the useful screen is the *adding* screen, and
   * making them find the button there themselves is a step for no reason. Once there is
   * something on file the row stops being a chore and becomes a fact worth being able to check.
   */
  const infoRow =
    readyCount > 0
      ? {
          icon: <IconList className="size-4 shrink-0 text-accent" />,
          label: 'My info',
          detail: `${readyCount} ${plural(readyCount, 'source')} ready to answer from`,
          onClick: () => nav.goToTab('yourInfo'),
        }
      : {
          icon: <IconPlus className="size-4 shrink-0 text-accent" />,
          label: 'Add your info',
          detail: 'A résumé or a link is enough to start',
          onClick: () => nav.push({ name: 'addInfo' }),
        }

  const lastFillRow = hasLastFill ? (
    <ActionRow
      icon={<IconSparkle className="size-4 shrink-0 text-accent" />}
      label="Last fill on this page"
      detail="What it wrote, and what it judged"
      onClick={() => nav.push({ name: 'receipt' })}
    />
  ) : null

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

      {/*
        Three shapes, one per situation, rather than one card that dims parts of itself.

        The screen used to be a single card in every state, and in the two states where nothing
        can be filled that card's largest element was a full-strength gradient button that did
        nothing. The most emphatic thing on the screen was the one thing that could not be
        pressed, under a sentence explaining that it could not — and below it, six hundred pixels
        of nothing. A disabled primary action is not a smaller version of an action; it is a dead
        end wearing the clothes of the way out.

        So: when there is a form, a card and the button. When there is not, no button at all, and
        the space gets used deliberately instead of left over.
      */}
      {nothingToFill ? (
        <ScreenBody className="relative flex flex-col">
          {/*
            One soft aura behind the whole composition, and the only decoration on the screen.

            Not onboarding's `BlobBackdrop`: its lozenges are positioned from the top of their
            container, so on a panel this tall they gathered in a band across the header and left
            the mascot sitting on flat background below them — colour where nothing was happening,
            none where something was. A single field centred on the content is the thing that was
            actually wanted, which is depth behind the character rather than weather above it.
          */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 size-80 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl"
            style={{ background: SUNSET_GRADIENT }}
          />

          {/*
            The rows go in the `action` slot rather than pinned to the bottom of the panel.

            Bottom-pinned was the first attempt and it split the screen in three: message in the
            optical centre, rows on the floor, and three hundred pixels of nothing holding them
            apart — which is the complaint that started this, reproduced at a smaller scale. One
            block reads as composed; two blocks read as a gap.
          */}
          {/*
            `relative` on the content, not just `absolute` on the aura.

            Both are children of the same stacking context, and a positioned box paints above a
            static one whatever the source order says — so the aura was laid over the mascot and
            the copy, veiling the one thing it was drawn to flatter. Positioning the content too
            puts DOM order back in charge, and the content comes second.
          */}
          <div className="relative flex flex-1 flex-col">
            <EmptyState
              mascot={page.status === 'unavailable' ? 'flat' : 'think'}
              title={
                page.status === 'unavailable' ? 'Nothing to fill here' : 'No form on this page'
              }
              body={
                page.status === 'unavailable'
                  ? 'This kind of page cannot be read.'
                  : `Nothing to fill on ${page.origin ?? 'this page'}. Open a form and it shows up here.`
              }
              action={
                <div className="w-full space-y-2">
                  {lastFillRow}
                  <ActionRow {...infoRow} />
                </div>
              }
            />
          </div>
        </ScreenBody>
      ) : (
        <ScreenBody className="flex flex-col gap-2.5 px-gutter pb-4 pt-4">
          <Card className="p-4">
            <PageEntry page={page} />

            {/*
              Nothing to press while we are still looking. A gradient button that goes live a
              moment later is a button somebody has already tried to press.
            */}
            {!checking && (
              <div className="mt-4">
                {profileBlocked ? (
                  <>
                    {/*
                      The form is there; what is missing is us. So the action is the one that
                      fixes that, instead of a dead Fill button beside a sentence telling the
                      user to go and do something the screen would not take them to.
                    */}
                    <Button
                      variant="primary"
                      size="lg"
                      block
                      onClick={() => nav.push({ name: 'addInfo' })}
                    >
                      <IconPlus className="size-4" />
                      Add your info
                    </Button>
                    <p className="mt-2 text-xs leading-snug text-ink-muted">
                      It needs something to answer from: a résumé, a link, whatever.
                    </p>
                  </>
                ) : (
                  <>
                    <Button variant="primary" size="lg" block onClick={handleFill}>
                      <IconMascot className="size-4" />
                      {/*
                        The button says what it does, not what it costs.

                        It used to read "Upgrade to fill" the moment the allowance ran out, which
                        turns the one action on the screen into an advertisement. Pressing Fill
                        still opens the sheet — see `handleFill` — so nothing is hidden; the label
                        simply does not pre-empt it.
                      */}
                      Fill this form
                    </Button>

                    {exhausted && showMoney && (
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
                    )}
                  </>
                )}
              </div>
            )}
          </Card>

          {lastFillRow}
          {/*
            The source count used to be a line of grey text under the button, which named a
            destination — "2 sources ready in My info" — without being one. Same fact, now
            pressable.
          */}
          {!profileBlocked && <ActionRow {...infoRow} />}
        </ScreenBody>
      )}

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
