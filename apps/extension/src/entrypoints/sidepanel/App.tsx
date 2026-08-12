import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { getGetAccountQueryKey, useGetAccount } from '../../generated/endpoints/account/account.js'
import { useGetProfile } from '../../generated/endpoints/profile/profile.js'
import type { Account } from '../../generated/model/index.js'
import { hasSession } from '../../lib/auth.js'
import { sendMessage } from '../../lib/messaging.js'
import { AddSource } from './AddSource.js'
import { FillPanel } from './FillPanel.js'
import { IdentityEditor } from './IdentityEditor.js'
import { SourceList } from './SourceList.js'

/**
 * Whether a session token exists at all.
 *
 * Checked before `useGetAccount` runs so a signed-out user sees the sign-in screen
 * immediately, instead of a spinner followed by a 401.
 */
function useSignedIn() {
  return useQuery({ queryKey: ['session'], queryFn: hasSession })
}

function QuotaBar({ account }: { account: Account }) {
  const { used, limit, plan } = account.quota
  const pct = limit === 0 ? 0 : Math.min(100, Math.round((used / limit) * 100))
  const exhausted = used >= limit

  return (
    <div className="rounded-lg border border-line bg-surface-raised p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          {plan} plan
        </span>
        <span className="text-xs tabular-nums text-ink-muted">
          {used} / {limit} forms
        </span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label="Monthly form quota"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            exhausted ? 'bg-review' : 'bg-accent'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {exhausted && (
        <p className="mt-2 text-xs text-review">
          You've used this month's forms. Resets{' '}
          {new Date(account.quota.resetsAt).toLocaleDateString()}.
        </p>
      )}
    </div>
  )
}

function SignedOut() {
  const queryClient = useQueryClient()

  // Sign-in must run in the background script: `chrome.identity` is unavailable here, and
  // driving it from the panel would tear the flow down whenever the panel closes.
  const signIn = useMutation({
    mutationFn: async () => {
      const result = await sendMessage({ type: 'auth/signIn' })
      if (!result.ok) throw Object.assign(new Error(result.error.message), result.error)
      return result.value
    },
    onSuccess: (account) => {
      queryClient.setQueryData(['session'], true)
      queryClient.setQueryData(getGetAccountQueryKey(), account)
    },
  })

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div>
        <h1 className="text-base font-semibold">AI Form Filler</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Sign in to build your knowledge base and start filling forms.
        </p>
      </div>
      <button
        type="button"
        onClick={() => signIn.mutate()}
        disabled={signIn.isPending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {signIn.isPending ? 'Opening Google…' : 'Continue with Google'}
      </button>
      {signIn.isError && (
        <p className="text-xs text-review" role="alert">
          {signIn.error.message}
        </p>
      )}
    </div>
  )
}

type Tab = 'sources' | 'details'

function SignedIn() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('sources')
  const account = useGetAccount()
  const profile = useGetProfile()

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

  if (account.isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-ink-muted">Loading…</span>
      </div>
    )
  }

  if (account.isError || !account.data) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-review" role="alert">
          {account.error?.message ?? 'Could not load your account'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 border-b border-line p-3">
        {account.data.avatarUrl && (
          <img src={account.data.avatarUrl} alt="" className="size-7 rounded-full" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{account.data.name ?? account.data.email}</p>
          <p className="truncate text-[11px] text-ink-muted">{account.data.email}</p>
        </div>
        <button
          type="button"
          onClick={() => signOut.mutate()}
          className="text-[11px] text-ink-muted underline-offset-2 hover:underline"
        >
          Sign out
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
        <QuotaBar account={account.data} />

        <div className="flex gap-1 border-b border-line" role="tablist" aria-label="Profile">
          {(
            [
              ['sources', 'Sources'],
              ['details', 'Details'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`-mb-px border-b-2 px-2.5 py-1.5 text-xs transition-colors ${
                tab === value
                  ? 'border-accent font-medium text-accent'
                  : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {profile.isPending && <p className="text-xs text-ink-muted">Loading profile…</p>}
        {profile.isError && (
          <p className="text-xs text-review" role="alert">
            {profile.error.message}
          </p>
        )}

        {profile.data && tab === 'sources' && (
          <>
            <AddSource />
            <SourceList sources={profile.data.sources} />
          </>
        )}

        {profile.data && tab === 'details' && <IdentityEditor profile={profile.data} />}
      </div>

      <footer className="shrink-0 border-t border-line p-3">
        <FillPanel account={account.data} />
      </footer>
    </div>
  )
}

export function App() {
  const session = useSignedIn()

  if (session.isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-ink-muted">Loading…</span>
      </div>
    )
  }

  return session.data ? <SignedIn /> : <SignedOut />
}
