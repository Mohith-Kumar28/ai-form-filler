import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Account } from '../../../generated/model/index.js'
import { formatResetDate, plural } from '../../../lib/format.js'
import { sendMessage } from '../../../lib/messaging.js'
import { Row, RowGroup, Screen, ScreenBody, ScreenHeader } from '../components.js'
import { IconSignOut } from '../icons.js'

const PLAN_LABEL: Record<string, string> = { free: 'Free', pro: 'Pro', ultra: 'Ultra' }

/**
 * The register entry.
 *
 * A credential's data page is a two-column register — field name in the label register on the
 * left, value on the right — and every fact on this screen is one. It is the same component
 * the identity editor reads back as, which is why the two screens feel like one document.
 */
function Entry({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
      <span className="doc-label shrink-0">{label}</span>
      <span className="min-w-0 truncate text-right text-[13px] text-ink">{children}</span>
    </div>
  )
}

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
      <ScreenHeader title="Your document" />

      <ScreenBody>
        <div className="flex items-center gap-3 border-b border-guilloche px-4 py-4">
          <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ink">
            {account.avatarUrl ? (
              <img src={account.avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="mrz text-[13px] text-ink">
                {(account.name ?? account.email).slice(0, 2).toUpperCase()}
              </span>
            )}
          </span>
          <div className="min-w-0">
            {account.name && (
              <p className="truncate text-[14px] font-semibold tracking-[-0.01em] text-ink">
                {account.name}
              </p>
            )}
            <p className="truncate text-[12px] text-ink2">{account.email}</p>
          </div>
        </div>

        <section className="border-b border-guilloche pb-3.5 pt-4">
          <p className="px-4 text-[15px] text-ink">
            <span className={`mrz font-medium ${exhausted ? 'text-alert' : 'text-ink'}`}>
              {left}
            </span>{' '}
            of <span className="mrz">{limit}</span> {plural(limit, 'form')} left this month
          </p>

          {/*
            No bar. It restated a quantity the register directly beneath it already prints as
            `USED 13 / 50`, which is a soft graphic standing in for a number the document
            spells out twice.
          */}
          <div className="mt-2.5 divide-y divide-guilloche-soft">
            <Entry label="Used">
              <span className="mrz">
                {used} / {limit}
              </span>
            </Entry>
            <Entry label="Resets">{formatResetDate(resetsAt)}</Entry>
            <Entry label="Plan">{PLAN_LABEL[plan] ?? plan}</Entry>
          </div>
        </section>

        <RowGroup>
          {/*
            Not tinted vermilion: signing out is reversible, and the endorsement ink means
            inference, error, or destruction. Spending it here would devalue it where it counts.
          */}
          <Row
            icon={<IconSignOut className="size-4" />}
            title={signOut.isPending ? 'Signing out…' : 'Sign out'}
            onClick={() => signOut.mutate()}
            trailing={<span />}
          />
        </RowGroup>

        {signOut.isError && (
          <p role="alert" className="px-4 py-3 text-[12px] text-alert">
            {signOut.error.message}
          </p>
        )}
      </ScreenBody>
    </Screen>
  )
}
