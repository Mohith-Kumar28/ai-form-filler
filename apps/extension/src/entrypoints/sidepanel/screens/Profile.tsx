import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Account } from '../../../generated/model/index.js'
import { formatResetDate, plural } from '../../../lib/format.js'
import { sendMessage } from '../../../lib/messaging.js'
import { Card, Mascot, Screen, ScreenBody, ScreenHeader } from '../components.js'
import { IconSignOut } from '../icons.js'

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

  return (
    <Screen>
      <ScreenHeader title="Settings" />

      <ScreenBody>
        <div className="flex items-center gap-3 px-4 py-5">
          {account.avatarUrl ? (
            <img src={account.avatarUrl} alt="" className="size-12 shrink-0 rounded-full" />
          ) : (
            <Mascot expression="happy" size={48} className="shrink-0" />
          )}
          <div className="min-w-0">
            {account.name && (
              <p className="truncate font-display text-[16px] font-bold text-ink">{account.name}</p>
            )}
            <p className="truncate text-[12.5px] text-ink-muted">{account.email}</p>
          </div>
        </div>

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
        </Card>

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
