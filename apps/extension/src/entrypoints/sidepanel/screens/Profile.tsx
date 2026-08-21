import type { DeletionReport, Settings } from '@aff/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { Account } from '../../../generated/model/index.js'
import { openManageSubscription, openTrial, openUpgrade } from '../../../lib/billing.js'
import { plural } from '../../../lib/format.js'
import { sendMessage } from '../../../lib/messaging.js'
import { usePaywallSeen } from '../../../lib/paywall.js'
import {
  Button,
  DeleteAccountSheet,
  Mascot,
  ProBadge,
  SaveState,
  type SaveStatus,
  Screen,
  ScreenBody,
  ScreenHeader,
  SUNSET_GRADIENT,
  Toggle,
  UsageBar,
} from '../components.js'
import { IconCrown, IconSignOut, IconTrash } from '../icons.js'

const PLAN_LABEL: Record<string, string> = { free: 'Free', pro: 'Pro', ultra: 'Ultra' }

/*
 * `Quota` lived here: a bar, a headline and a reset date, byte-identical to `UsageBar` in
 * components.tsx, which nothing imported. Two meters is how a meter starts disagreeing with
 * itself, so this screen uses the shared one and the copy is gone.
 */

/** Days until the trial converts, or null when there is no trial to count down. */
function trialDaysLeft(subscription: Account['subscription'], now = Date.now()): number | null {
  if (subscription?.status !== 'trial' || !subscription.trialEndsAt) return null
  const days = Math.ceil((subscription.trialEndsAt * 1000 - now) / 86_400_000)
  return days > 0 ? days : 0
}

/**
 * What state the subscription is actually in, in the user's words.
 *
 * These states were previously invisible: the server only reported a subscription at all when it
 * was `active`, `trial` or `on_hold`, so a cancelled plan still running out its paid month and a
 * card that failed both rendered as plain "Free plan". Somebody whose payment is broken cannot fix
 * a problem nobody has told them about.
 */
function subscriptionNote(subscription: Account['subscription']): string | null {
  if (!subscription) return null
  switch (subscription.status) {
    case 'on_hold':
      return 'Your last payment did not go through. Update your card to avoid losing access.'
    case 'cancelled':
      return 'Cancelled. You keep everything until the end of the period you have paid for.'
    case 'failed':
      return 'The payment never completed, so the subscription did not start.'
    case 'expired':
      return 'This subscription has ended.'
    case 'pending':
      return 'Setting up your subscription. This usually takes a moment.'
    default:
      return null
  }
}

export function Profile({
  account,
  sourceCount = 0,
  onReplayTour,
  onDeleted,
}: {
  account: Account
  /**
   * How many sources are on the account, for the deletion dialog's itemised list.
   *
   * Passed down rather than queried here: `Stack` already holds the profile, and a second
   * subscription to it would only exist to count an array this screen is handed anyway.
   */
  sourceCount?: number
  /**
   * Runs the first-run flow again.
   *
   * Optional because the state lives in `App`, and because this screen is rendered in the review
   * gallery with no flow behind it. It is here rather than nowhere for the person who pressed
   * "Skip the tour" in their first thirty seconds and later wondered what the thing actually does —
   * the alternative is clearing the extension's storage.
   */
  onReplayTour?: () => void
  /**
   * Hands the deletion receipt up to `App`, which renders it above the signed-in gate.
   *
   * It has to leave this screen to be seen at all: a successful deletion clears the session
   * token, and every context watching that key — see `onSessionEnded` — swaps to the welcome
   * screen, taking this component and its dialog with it. Optional for the same reason
   * `onReplayTour` is: the review gallery renders this screen with no app behind it.
   */
  onDeleted?: (report: DeletionReport) => void
}) {
  const queryClient = useQueryClient()
  const { plan } = account.quota
  const { seen: paywallSeen } = usePaywallSeen()

  /**
   * A paying account always sees its billing; an onboarding one sees none until it asks.
   *
   * Driven off the subscription rather than the plan so the section does not vanish the moment a
   * trial lapses — that is precisely when somebody needs to find the renew button.
   */
  const showBilling = account.subscription != null || paywallSeen
  const daysLeft = trialDaysLeft(account.subscription)
  const note = subscriptionNote(account.subscription)

  const signOut = useMutation({
    mutationFn: async () => {
      const result = await sendMessage({ type: 'auth/signOut' })
      if (!result.ok) throw Object.assign(new Error(result.error.message), result.error)
    },
    onSuccess: () => {
      queryClient.setQueryData(['session'], false)
      queryClient.clear()
    },
  })

  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const deleteAccount = useMutation({
    mutationFn: async (confirmEmail: string) => {
      const result = await sendMessage({ type: 'account/delete', confirmEmail })
      if (!result.ok) throw Object.assign(new Error(result.error.message), result.error)
      return result.value
    },
    onSuccess: (report) => {
      /*
        The sheet closes and the caches go before the receipt is handed up, so nothing repaints
        the deleted account in the frame between the two. The token is already gone by now — the
        service worker cleared storage — so this tree is about to be replaced regardless; doing it
        in this order means it is never replaced by a stale copy of what was just deleted.
      */
      setConfirmingDelete(false)
      queryClient.setQueryData(['session'], false)
      queryClient.clear()
      onDeleted?.(report)
    },
  })

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const result = await sendMessage({ type: 'settings/get' })
      if (!result.ok) throw Object.assign(new Error(result.error.message), result.error)
      return result.value
    },
  })

  const settingsMutation = useMutation({
    mutationFn: async (next: Settings) => {
      const result = await sendMessage({ type: 'settings/set', settings: next })
      if (!result.ok) throw Object.assign(new Error(result.error.message), result.error)
      return next
    },
    onSuccess: (next) => queryClient.setQueryData(['settings'], next),
  })

  const currentSettings = settingsQuery.data ?? { inlineAutofill: true, showLauncher: true }

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  useEffect(() => {
    if (settingsMutation.isPending) return setSaveStatus('saving')
    if (settingsMutation.isError) return setSaveStatus('error')
    if (!settingsMutation.isSuccess) return
    setSaveStatus('saved')
    const timer = setTimeout(() => setSaveStatus('idle'), 1600)
    return () => clearTimeout(timer)
  }, [settingsMutation.isPending, settingsMutation.isError, settingsMutation.isSuccess])

  const toggleSetting = (key: keyof Settings) => {
    settingsMutation.mutate({ ...currentSettings, [key]: !currentSettings[key] })
  }

  return (
    <Screen>
      <ScreenHeader
        title="Account"
        right={
          <div className="flex items-center gap-2">
            <SaveState status={saveStatus} error={settingsMutation.error?.message} />
            {showBilling && plan !== 'free' && <ProBadge plan={plan} />}
          </div>
        }
      />

      <ScreenBody>
        {/* Who you are signed in as. Room to breathe, because it is the answer to one question. */}
        <div className="flex items-center gap-3.5 px-gutter py-5">
          {account.avatarUrl ? (
            <img src={account.avatarUrl} alt="" className="size-14 shrink-0 rounded-full" />
          ) : (
            <Mascot expression="happy" size={56} className="shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            {account.name && (
              <p className="truncate font-display text-lg font-bold tracking-[-0.02em] text-ink">
                {account.name}
              </p>
            )}
            <p className="truncate text-sm text-ink-muted">{account.email}</p>
          </div>
        </div>

        {/*
          Money appears here only once the person has met it.

          Before that they are onboarding — adding a résumé, typing facts — and a meter and a
          price tag are a question they have no basis to answer yet. `showBilling` goes true when
          they first press Fill, and stays true, so anyone who dismissed the offer still has a way
          back to it. See `usePaywallSeen`.
        */}
        {showBilling && (
          <div className="grid grid-cols-1 items-start gap-2.5 px-gutter pb-4 wide:grid-cols-2">
            {account.quota.limit > 0 && <UsageBar {...account.quota} />}

            {/* The plan, in one place. It used to be announced in a header badge, a gradient
                banner and a table row simultaneously — and for a non-paying account it said
                "Free plan" and offered nothing at all. */}
            <div className="rounded-2xl border border-border-muted bg-surface-raised p-4">
              <div className="flex items-center gap-3">
                {plan !== 'free' && (
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-full"
                    style={{ background: SUNSET_GRADIENT }}
                  >
                    <IconCrown className="size-4 text-white" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-ink">
                    {plan === 'free' ? 'No plan yet' : `${PLAN_LABEL[plan] ?? plan} plan`}
                  </p>
                  {daysLeft !== null && (
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {daysLeft === 0
                        ? 'Trial ends today, then $5 a month'
                        : `Free trial · ${daysLeft} ${plural(daysLeft, 'day')} left, then $5 a month`}
                    </p>
                  )}
                </div>
              </div>

              {note && <p className="mt-2.5 text-xs leading-snug text-warning">{note}</p>}

              {plan === 'free' ? (
                <Button variant="primary" block className="mt-3.5" onClick={() => void openTrial()}>
                  <IconCrown className="size-3.5" />
                  Start 14-day free trial
                </Button>
              ) : (
                <div className="mt-3.5 flex flex-col gap-2">
                  <Button variant="secondary" block onClick={() => void openManageSubscription()}>
                    Manage subscription
                  </Button>
                  {plan !== 'ultra' && (
                    <Button variant="ghost" block onClick={() => void openUpgrade()}>
                      Compare plans
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/*
          Two switches, shown rather than disclosed.

          This was a `Section` — a `<details>` with a chevron — which is the right control for the
          six field groups on "Your info", where collapsing is what makes forty facts fit in a
          400px panel. Here it wrapped a grand total of two rows, so the disclosure cost a click
          and a guess to reveal less than it occupied when closed. A dropdown whose contents are
          shorter than the affordance is not organising anything.

          It also sat flush to both edges of the panel while everything above it was a card inset
          by the gutter, so the one collapsed thing on the screen was also the one thing touching
          the sides. Same inset, same radius, same border as the cards it follows.
        */}
        <div className="px-gutter pb-1">
          <p className="mb-2 font-display text-sm font-bold tracking-[-0.01em] text-ink-muted">
            On the page
          </p>
          <div className="overflow-hidden rounded-2xl border border-border-muted bg-surface-raised">
            <Toggle
              checked={currentSettings.inlineAutofill}
              onChange={() => toggleSetting('inlineAutofill')}
              disabled={settingsMutation.isPending}
              label="Inline autofill"
              description="Offer a suggestion when you focus a field it already knows."
            />
            <div className="mx-gutter border-t border-border-muted" />
            <Toggle
              checked={currentSettings.showLauncher}
              onChange={() => toggleSetting('showLauncher')}
              disabled={settingsMutation.isPending}
              label="Floating button"
              description="Show the fill button on the right edge of the page."
            />
          </div>
        </div>

        {onReplayTour && (
          <div className="px-gutter pt-3">
            <button
              type="button"
              onClick={onReplayTour}
              className="flex min-h-row w-full items-center gap-3 rounded-2xl border border-border-muted bg-surface-raised px-4 text-left transition-colors hover:bg-surface-muted"
            >
              <Mascot size={20} className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-base text-ink">Show me around again</span>
                <span className="block text-xs text-ink-dim">
                  The tour, and the setup steps. Nothing you have added is touched.
                </span>
              </span>
            </button>
          </div>
        )}

        <div className="px-gutter py-4">
          <button
            type="button"
            onClick={() => signOut.mutate()}
            className="flex min-h-row w-full items-center gap-3 rounded-2xl border border-border-muted px-4 text-left transition-colors hover:border-danger hover:bg-danger-muted"
          >
            <IconSignOut className="size-4 shrink-0 text-ink-muted" />
            <span className="flex-1 text-base font-medium text-ink">
              {signOut.isPending ? 'Signing out…' : 'Sign out'}
            </span>
          </button>

          {signOut.isError && (
            <p role="alert" className="mt-2 text-sm leading-snug text-danger">
              {signOut.error.message}
            </p>
          )}

          {/*
            Below sign-out, and visibly quieter than it.
            
            Sign-out is the thing almost everybody who opens this section actually wants, and the
            two are one careless click apart. So this one is set off by its own divider and reads
            as a different kind of action rather than the next item in a list — the ordering and the
            gap are the first line of defence, before the three-step dialog is ever reached.
          */}
          <div className="mt-4 border-t border-border-muted pt-4">
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="flex min-h-row w-full items-center gap-3 rounded-2xl px-4 text-left transition-colors hover:bg-danger-muted"
            >
              <IconTrash className="size-4 shrink-0 text-danger" />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium text-danger">Delete account</span>
                <span className="block text-xs text-ink-dim">
                  Erases everything, permanently. This cannot be undone.
                </span>
              </span>
            </button>
          </div>
        </div>
      </ScreenBody>

      {confirmingDelete && (
        <DeleteAccountSheet
          email={account.email}
          sourceCount={sourceCount}
          hasSubscription={account.subscription != null}
          pending={deleteAccount.isPending}
          error={deleteAccount.error?.message}
          onConfirm={(confirmEmail) => deleteAccount.mutate(confirmEmail)}
          onCancel={() => {
            setConfirmingDelete(false)
            deleteAccount.reset()
          }}
        />
      )}
    </Screen>
  )
}
