import type { Settings } from '@aff/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { Account } from '../../../generated/model/index.js'
import { openManageSubscription, openUpgrade } from '../../../lib/billing.js'
import { formatResetDate, plural } from '../../../lib/format.js'
import { sendMessage } from '../../../lib/messaging.js'
import {
  Button,
  Mascot,
  ProBadge,
  SaveState,
  type SaveStatus,
  Screen,
  ScreenBody,
  ScreenHeader,
  Section,
  SUNSET_GRADIENT,
  Toggle,
} from '../components.js'
import { IconCrown, IconSignOut } from '../icons.js'

const PLAN_LABEL: Record<string, string> = { free: 'Free', pro: 'Pro', ultra: 'Ultra' }

/**
 * The month's quota, said once.
 *
 * It used to be said three times on this screen — a bar in the header, a headline, and a
 * Used/Resets/Plan table restating the headline as three key-value rows. One number, one bar,
 * one date.
 */
function Quota({ used, limit, plan, resetsAt }: Account['quota']) {
  const left = Math.max(0, limit - used)
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const exhausted = used >= limit
  const warning = pct >= 80 && !exhausted

  return (
    <div className="rounded-2xl border border-border-muted bg-surface-raised p-4">
      <p className="font-display text-xl font-bold tracking-[-0.02em] text-ink">
        <span className={exhausted ? 'text-danger' : ''}>{left}</span>
        <span className="text-ink-dim"> of {limit}</span>
      </p>
      <p className="mt-0.5 text-sm text-ink-muted">{plural(limit, 'form')} left this month</p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            exhausted ? 'bg-danger' : warning ? 'bg-warning' : ''
          }`}
          style={{
            width: `${pct}%`,
            ...(exhausted || warning
              ? {}
              : {
                  background: 'linear-gradient(90deg, var(--color-sparkle), var(--color-accent))',
                }),
          }}
        />
      </div>

      <p className="mt-2 text-xs text-ink-dim">
        {exhausted
          ? `Resets ${formatResetDate(resetsAt)}. Upgrade to keep going now.`
          : `Resets ${formatResetDate(resetsAt)}`}
      </p>

      {plan === 'free' && (
        <Button variant="primary" block className="mt-3.5" onClick={() => void openUpgrade()}>
          <IconCrown className="size-3.5" />
          Upgrade to Pro
        </Button>
      )}
    </div>
  )
}

export function Profile({ account }: { account: Account }) {
  const queryClient = useQueryClient()
  const { plan } = account.quota

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

  const [settingsOpen, setSettingsOpen] = useState(true)

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
            {plan !== 'free' && <ProBadge plan={plan} />}
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

        {/* Quota and plan sit side by side once there is room; stacked below `wide`. */}
        <div className="grid grid-cols-1 items-start gap-2.5 px-gutter pb-4 wide:grid-cols-2">
          <Quota {...account.quota} />

          {/* The plan, in one place. It used to be announced in a header badge, a gradient
              banner and a table row simultaneously. */}
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
                <p className="text-base font-semibold text-ink">{PLAN_LABEL[plan] ?? plan} plan</p>
              </div>
            </div>

            {plan !== 'free' && (
              <Button
                variant="secondary"
                block
                className="mt-3.5"
                onClick={() => void openManageSubscription()}
              >
                Manage subscription
              </Button>
            )}
          </div>
        </div>

        <Section title="On the page" open={settingsOpen} onToggle={setSettingsOpen}>
          <div className="col-span-full -mx-gutter">
            <Toggle
              checked={currentSettings.inlineAutofill}
              onChange={() => toggleSetting('inlineAutofill')}
              disabled={settingsMutation.isPending}
              label="Inline autofill"
              description="Offer a suggestion when you focus a field it already knows."
            />
            <Toggle
              checked={currentSettings.showLauncher}
              onChange={() => toggleSetting('showLauncher')}
              disabled={settingsMutation.isPending}
              label="Floating button"
              description="Show the fill button on the right edge of the page."
            />
          </div>
        </Section>

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
        </div>
      </ScreenBody>
    </Screen>
  )
}
