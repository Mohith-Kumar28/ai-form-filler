import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { Settings } from '@aff/shared'
import type { Account } from '../../../generated/model/index.js'
import { openManageSubscription, openUpgrade } from '../../../lib/billing.js'
import { formatResetDate, plural } from '../../../lib/format.js'
import { sendMessage } from '../../../lib/messaging.js'
import { Button, Card, Mascot, ProBadge, Screen, ScreenBody, ScreenHeader, SUNSET_GRADIENT, Toggle } from '../components.js'
import { IconCheck, IconCrown, IconSignOut } from '../icons.js'

const PLAN_LABEL: Record<string, string> = { free: 'Free', pro: 'Pro', ultra: 'Ultra' }

export function Profile({ account }: { account: Account }) {
  const queryClient = useQueryClient()

  const { used, limit, plan, resetsAt } = account.quota
  const left = Math.max(0, limit - used)
  const exhausted = used >= limit

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
    onSuccess: (next) => {
      queryClient.setQueryData(['settings'], next)
    },
  })

  const currentSettings = settingsQuery.data ?? { inlineAutofill: true, showLauncher: true }

  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settingsMutation.isSuccess) {
      setSaved(true)
      const timer = setTimeout(() => setSaved(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [settingsMutation.isSuccess])

  const toggleSetting = (key: keyof Settings) => {
    settingsMutation.mutate({ ...currentSettings, [key]: !currentSettings[key] })
  }

  return (
    <Screen>
      <ScreenHeader
        title="Account"
        usage={{ used, limit, plan }}
        right={plan !== 'free' ? <ProBadge plan={plan} /> : undefined}
      />

      <ScreenBody>
        <div className="flex items-center gap-3 px-4 py-5">
          {account.avatarUrl ? (
            <img src={account.avatarUrl} alt="" className="size-12 shrink-0 rounded-full" />
          ) : (
            <Mascot expression="happy" size={48} className="shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            {account.name && (
              <p className="truncate font-display text-[16px] font-bold text-ink">{account.name}</p>
            )}
            <p className="truncate text-[12.5px] text-ink-muted">{account.email}</p>
          </div>
        </div>

        {plan !== 'free' && (
          <div
            className="mx-4 mb-3 flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{
              background:
                'linear-gradient(135deg, color-mix(in oklch, var(--color-sparkle) 12%, transparent), color-mix(in oklch, var(--color-accent) 8%, transparent))',
              border: '1px solid color-mix(in oklch, var(--color-accent) 20%, transparent)',
            }}
          >
            <span
              className="flex size-8 items-center justify-center rounded-full"
              style={{
                background: SUNSET_GRADIENT,
              }}
            >
              <IconCrown className="size-4 text-white" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-ink">
                {plan === 'ultra' ? 'Ultra' : 'Pro'} plan
              </p>
              <p className="text-[11.5px] text-ink-muted">
                {plan === 'ultra'
                  ? 'Unlimited fills, priority models, everything unlocked'
                  : 'Unlimited fills and priority AI models'}
              </p>
            </div>
          </div>
        )}

        <Card className="mx-4 px-4 py-4">
          <p className="text-[15px] font-semibold text-ink">
            <span className={`font-bold ${exhausted ? 'text-danger' : 'text-ink'}`}>{left}</span> of{' '}
            {limit} {plural(limit, 'form')} left this month
          </p>

          <div className="mt-3 space-y-1 text-[13px]">
            <div className="flex justify-between">
              <span className="text-ink-muted">Used</span>
              <span className="font-medium text-ink">
                {used} / {limit}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Resets</span>
              <span className="font-medium text-ink">{formatResetDate(resetsAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Plan</span>
              <span className="font-medium text-ink">{PLAN_LABEL[plan] ?? plan}</span>
            </div>
          </div>

          <Button
            variant={plan === 'free' ? 'primary' : 'secondary'}
            block
            className="mt-4"
            onClick={() => (plan === 'free' ? void openUpgrade() : void openManageSubscription())}
          >
            {plan === 'free' ? (
              <>
                <IconCrown className="size-3.5" />
                Upgrade to Pro
              </>
            ) : (
              'Manage subscription'
            )}
          </Button>
        </Card>

        <div className="mx-4 mt-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-[12px] font-semibold text-ink-muted">Appearance</p>
            {saved && (
              <span className="animate-fade-in flex items-center gap-1 text-[11px] font-medium text-positive">
                <IconCheck className="size-3" />
                Saved
              </span>
            )}
          </div>
          <Card className="mt-2 divide-y divide-border-muted">
            <Toggle
              checked={currentSettings.inlineAutofill}
              onChange={() => toggleSetting('inlineAutofill')}
              disabled={settingsMutation.isPending}
              label="Inline autofill"
              description="Show autofill suggestions when you focus a field"
            />
            <Toggle
              checked={currentSettings.showLauncher}
              onChange={() => toggleSetting('showLauncher')}
              disabled={settingsMutation.isPending}
              label="Floating button"
              description="Show the action button on the right side of the page"
            />
          </Card>
        </div>

        <div className="mx-4 mt-3">
          <button
            type="button"
            onClick={() => signOut.mutate()}
            className="flex w-full items-center gap-2.5 rounded-2xl border border-border-muted bg-surface-raised px-4 py-3 text-left transition-colors hover:bg-danger-muted"
          >
            <IconSignOut className="size-4 text-ink-muted" />
            <span className="flex-1 text-[14px] font-medium text-ink">
              {signOut.isPending ? 'Signing out…' : 'Sign out'}
            </span>
          </button>
        </div>

        {signOut.isError && (
          <p role="alert" className="px-4 py-3 text-[13px] text-danger">
            {signOut.error.message}
          </p>
        )}
      </ScreenBody>
    </Screen>
  )
}
