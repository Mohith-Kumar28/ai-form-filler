import type { DeletionReport, Settings as SettingsShape } from '@aff/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { Account } from '../../../generated/model/index.js'
import { openManageSubscription } from '../../../lib/billing.js'
import { plural } from '../../../lib/format.js'
import { sendMessage } from '../../../lib/messaging.js'
import { usePaywallSeen } from '../../../lib/paywall.js'
import {
  Button,
  DeleteAccountSheet,
  Kbd,
  ListCard,
  Mascot,
  ProBadge,
  Row,
  SaveState,
  type SaveStatus,
  Screen,
  ScreenBody,
  ScreenHeader,
  SectionLabel,
  Toggle,
  UpgradeSheet,
  UsageBar,
} from '../components.js'
import { IconArrowUpRight, IconCrown, IconKeyboard, IconTrash } from '../icons.js'

const PLAN_LABEL: Record<string, string> = { free: 'Free', pro: 'Pro', ultra: 'Ultra' }

/** Days until the trial converts, or null when there is no trial to count down. */
function trialDaysLeft(subscription: Account['subscription'], now = Date.now()): number | null {
  if (subscription?.status !== 'trial' || !subscription.trialEndsAt) return null
  const days = Math.ceil((subscription.trialEndsAt * 1000 - now) / 86_400_000)
  return days > 0 ? days : 0
}

/** What state the subscription is actually in, in the user's words. */
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

/** The key that fires a fill, as the browser reports it. `null` when unbound. */
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

/**
 * Settings: who you are signed in as, what the plan is, what happens on the page.
 *
 * Grouped lists with small headings. The one rule about order: sign-out is easy to reach and
 * delete is at the bottom, alone, in red — the two used to sit a careless click apart.
 */
export function Settings({
  account,
  sourceCount = 0,
  onReplayTour,
  onDeleted,
}: {
  account: Account
  /** How many sources are on the account, for the deletion dialog's itemised list. */
  sourceCount?: number
  /** Runs the first-run flow again. Optional: the review gallery renders this with no flow. */
  onReplayTour?: () => void
  /** Hands the deletion receipt up to `App`, which renders it above the signed-in gate. */
  onDeleted?: (report: DeletionReport) => void
}) {
  const queryClient = useQueryClient()
  const { plan } = account.quota
  const { seen: paywallSeen } = usePaywallSeen()
  const shortcut = useShortcut()

  /**
   * A paying account always sees its billing; an onboarding one sees none until it asks.
   *
   * `used > 0` matches `Home`: a free account spends a real grant before it meets a paywall,
   * and the screen a person visits *to* check what is left cannot hide it until it is gone.
   */
  const showBilling = account.subscription != null || paywallSeen || account.quota.used > 0
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
  const [showUpgrade, setShowUpgrade] = useState(false)

  const deleteAccount = useMutation({
    mutationFn: async (confirmEmail: string) => {
      const result = await sendMessage({ type: 'account/delete', confirmEmail })
      if (!result.ok) throw Object.assign(new Error(result.error.message), result.error)
      return result.value
    },
    onSuccess: (report) => {
      // The sheet closes and the caches go before the receipt is handed up, so nothing repaints
      // the deleted account in the frame between the two.
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
    mutationFn: async (next: SettingsShape) => {
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

  const toggleSetting = (key: keyof SettingsShape) => {
    settingsMutation.mutate({ ...currentSettings, [key]: !currentSettings[key] })
  }

  return (
    <Screen>
      <ScreenHeader
        title="Settings"
        right={<SaveState status={saveStatus} error={settingsMutation.error?.message} />}
      />

      <ScreenBody className="pb-4">
        <SectionLabel>Account</SectionLabel>
        <div className="px-gutter">
          <ListCard>
            <div className="flex items-center gap-2.5 p-3">
              {account.avatarUrl ? (
                <img src={account.avatarUrl} alt="" className="size-9 shrink-0 rounded-full" />
              ) : (
                <Mascot expression="happy" size={36} className="shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                {account.name && (
                  <p className="truncate text-sm font-medium text-ink">{account.name}</p>
                )}
                <p className="truncate text-xs text-ink-dim">{account.email}</p>
              </div>
              {showBilling && plan !== 'free' && <ProBadge plan={plan} />}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => signOut.mutate()}
                loading={signOut.isPending}
              >
                Sign out
              </Button>
            </div>
            {signOut.isError && (
              <p role="alert" className="px-3 py-2 text-xs text-danger">
                {signOut.error.message}
              </p>
            )}
          </ListCard>
        </div>

        {/*
          Money appears here only once the person has met it. Before that they are onboarding,
          and a meter and a price tag are a question they have no basis to answer yet.
        */}
        {showBilling && (
          <>
            <SectionLabel>Plan</SectionLabel>
            <div className="flex flex-col gap-2 px-gutter">
              {account.quota.limit > 0 && (
                <UsageBar
                  {...account.quota}
                  footer={
                    plan === 'free' ? (
                      /* Opens the sheet, not a checkout: the comparison lives there. */
                      <Button variant="primary" block onClick={() => setShowUpgrade(true)}>
                        Start 14-day free trial
                      </Button>
                    ) : undefined
                  }
                />
              )}

              {plan !== 'free' && (
                <ListCard>
                  <div className="flex items-center gap-2.5 p-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-muted">
                      <IconCrown className="size-4 text-accent" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">
                        {`${PLAN_LABEL[plan] ?? plan} plan`}
                      </p>
                      {daysLeft !== null && (
                        <p className="text-xs text-ink-dim">
                          {daysLeft === 0
                            ? 'Trial ends today, then $5 a month'
                            : `Free trial · ${daysLeft} ${plural(daysLeft, 'day')} left, then $5 a month`}
                        </p>
                      )}
                    </div>
                  </div>
                  {note && <p className="px-3 py-2 text-xs text-warning">{note}</p>}
                  <Row
                    icon={<IconArrowUpRight className="size-4" />}
                    title="Manage subscription"
                    detail="Change plan, update your card, or cancel"
                    onClick={() => void openManageSubscription()}
                  />
                  {plan !== 'ultra' && (
                    <Row title="Compare plans" onClick={() => setShowUpgrade(true)} />
                  )}
                </ListCard>
              )}
            </div>
          </>
        )}

        <SectionLabel>On the page</SectionLabel>
        <div className="px-gutter">
          <ListCard>
            <Toggle
              checked={currentSettings.inlineAutofill}
              onChange={() => toggleSetting('inlineAutofill')}
              disabled={settingsMutation.isPending}
              label="Inline suggestions"
              description="Offer a saved answer when you focus a field it knows."
            />
            <Toggle
              checked={currentSettings.showLauncher}
              onChange={() => toggleSetting('showLauncher')}
              disabled={settingsMutation.isPending}
              label="Floating button"
              description="Show the fill button on the right edge of pages with a form."
            />
            <Row
              icon={<IconKeyboard className="size-4" />}
              title="Keyboard shortcut"
              detail={shortcut ? 'Fills the form on the page' : 'Not set — press to choose one'}
              value={shortcut ? <Kbd>{shortcut}</Kbd> : undefined}
              onClick={() => void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}
            />
          </ListCard>
        </div>

        {onReplayTour && (
          <>
            <SectionLabel>Help</SectionLabel>
            <div className="px-gutter">
              <ListCard>
                <Row
                  icon={<Mascot size={16} />}
                  title="Show me around again"
                  detail="The tour and the setup steps. Nothing you added is touched."
                  onClick={onReplayTour}
                />
              </ListCard>
            </div>
          </>
        )}

        {/* Alone, at the bottom, red. Sign-out is at the top, where it is wanted. */}
        <div className="mt-6 px-gutter">
          <ListCard>
            <Row
              icon={<IconTrash className="size-4" />}
              tone="danger"
              title="Delete account"
              detail="Erases everything, permanently."
              onClick={() => setConfirmingDelete(true)}
            />
          </ListCard>
        </div>
      </ScreenBody>

      {showUpgrade && (
        <UpgradeSheet
          mode={plan === 'free' ? 'trial' : 'compare'}
          onClose={() => setShowUpgrade(false)}
        />
      )}

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
