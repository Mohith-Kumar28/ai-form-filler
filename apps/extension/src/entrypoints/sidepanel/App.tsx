import { isAuthError } from '@aff/shared/constants'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { getGetAccountQueryKey, useGetAccount } from '../../generated/endpoints/account/account.js'
import { useGetProfile } from '../../generated/endpoints/profile/profile.js'
import type { Account } from '../../generated/model/index.js'
import { hasSession } from '../../lib/auth.js'
import { sendMessage } from '../../lib/messaging.js'
import { onSessionEnded } from '../../lib/session.js'
import { useFill } from '../../lib/use-fill.js'
import { AddSource } from './AddSource.js'
import { FillPanel } from './FillPanel.js'
import { IdentityEditor } from './IdentityEditor.js'
import { ReviewPanel } from './ReviewPanel.js'
import { SourceList } from './SourceList.js'

function useSignedIn() {
  const queryClient = useQueryClient()

  /**
   * The session can end during a request the panel never made — a fill running in the
   * background, or a page dock press. Without this the panel keeps rendering the signed-in
   * view and shows whatever the failed request threw, which is how "Missing bearer token"
   * reached the user in the first place.
   */
  useEffect(
    () =>
      onSessionEnded(() => {
        queryClient.setQueryData(['session'], false)
        // Drop the cached account and profile: they belong to a session that is over.
        queryClient.clear()
      }),
    [queryClient],
  )

  return useQuery({ queryKey: ['session'], queryFn: hasSession })
}

/**
 * Quota as a measured rule rather than a progress pill.
 *
 * A notebook records how much of the page is used by where the writing reaches, so the
 * remaining span is drawn as unused rule. Ticks mark quarters, which is what makes the
 * measure readable at 400px without a percentage label.
 */
function Quota({ account }: { account: Account }) {
  const { used, limit, plan } = account.quota
  const left = Math.max(0, limit - used)
  const ratio = limit === 0 ? 0 : Math.min(1, used / limit)
  const exhausted = used >= limit

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        {/*
          "FREE · FORMS  3/50" said nothing a person could parse. A sentence with the
          number that actually matters — how many are left — reads at a glance.
        */}
        <p className="text-[12px] text-muted">
          <span className={`measure font-medium ${exhausted ? 'text-annot' : 'text-ink'}`}>
            {left}
          </span>{' '}
          {left === 1 ? 'form' : 'forms'} left this month
        </p>
        <span className="text-[11px] uppercase tracking-[0.08em] text-faint">{plan}</span>
      </div>
      <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-rule-soft">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${
            exhausted ? 'bg-annot' : 'bg-pen'
          }`}
          style={{ width: `${Math.max(ratio * 100, used > 0 ? 4 : 0)}%` }}
        />
      </div>
    </div>
  )
}

function SignedOut() {
  const queryClient = useQueryClient()

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
    <div className="flex h-full flex-col justify-center px-6">
      <div>
        <h1 className="text-[19px] font-semibold leading-tight tracking-[-0.01em] text-ink">
          A notebook that fills
          <br />
          forms for you.
        </h1>
        <p className="mt-2.5 max-w-[32ch] text-[12.5px] leading-relaxed text-muted">
          Record what you want it to know — a résumé, your site, a few lines. It answers any form
          from that, and tells you which answers it concluded rather than read.
        </p>
        <button
          type="button"
          onClick={() => signIn.mutate()}
          disabled={signIn.isPending}
          className="mt-4 rounded-sharp bg-pen px-4 py-2 text-[13px] font-medium text-page transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {signIn.isPending ? 'Opening Google…' : 'Continue with Google'}
        </button>
        {signIn.isError && (
          <p className="mt-2 text-[12px] text-annot" role="alert">
            {signIn.error.message}
          </p>
        )}
      </div>
    </div>
  )
}

type Tab = 'sources' | 'details'

function SignedIn() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('sources')
  // Adding a source takes the whole panel — see AddSource for why it is not an inline widget.
  const [adding, setAdding] = useState(false)
  const account = useGetAccount()
  const profile = useGetProfile()

  /**
   * The panel is shared with the page dock: `useFill` adopts a fill started there, so a
   * result appears here whether the user pressed Fill in the panel or on the page.
   */
  const fill = useFill()

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
        <span className="measure text-[11px] uppercase tracking-wide text-faint">Opening</span>
      </div>
    )
  }

  /**
   * An auth failure renders nothing at all.
   *
   * `onSessionEnded` is already swapping the whole panel to the signed-out view, so showing
   * an error here would flash a red message for one frame on the way to a sign-in button
   * the user is about to see anyway.
   */
  if (isAuthError((account.error as { code?: string } | null)?.code)) {
    return null
  }

  if (account.isError || !account.data) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <p className="text-[12px] text-annot" role="alert">
          {account.error?.message ?? 'Could not load your account'}
        </p>
      </div>
    )
  }

  const sourceCount = profile.data?.sources?.length ?? 0

  /**
   * A finished fill takes over the whole panel.
   *
   * Showing it as a strip under the profile tabs is what made Review a dead end — the user
   * arrived somewhere that looked identical to where they started. The profile is one click
   * away, and returning to it is the explicit end of the review.
   */
  if (fill.state.status === 'done' && fill.state.plan) {
    return <ReviewPanel plan={fill.state.plan} onBack={fill.reset} />
  }

  if (adding) {
    return <AddSource onDone={() => setAdding(false)} />
  }

  return (
    <div className="flex h-full flex-col bg-ground">
      <header className="shrink-0 border-b border-rule bg-page px-4 pb-3 pt-3">
        <div className="flex items-center gap-2.5">
          {account.data.avatarUrl && (
            <img src={account.data.avatarUrl} alt="" className="size-7 rounded-full" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-ink">
              {account.data.name ?? account.data.email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => signOut.mutate()}
            className="shrink-0 text-[11.5px] text-faint transition-colors hover:text-annot"
          >
            Sign out
          </button>
        </div>
        <div className="mt-3">
          <Quota account={account.data} />
        </div>
      </header>

      <nav className="flex shrink-0 border-b border-rule bg-page" aria-label="Notebook">
        {(
          [
            ['sources', 'Entries', sourceCount],
            ['details', 'Details', null],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            aria-current={tab === value ? 'page' : undefined}
            onClick={() => setTab(value)}
            className={`relative flex items-baseline gap-1.5 px-4 py-2.5 text-[12.5px] font-medium transition-colors ${
              tab === value ? 'text-ink' : 'text-faint hover:text-muted'
            }`}
          >
            {label}
            {count !== null && count > 0 && (
              <span className="measure text-[10.5px] text-faint">{count}</span>
            )}
            {tab === value && (
              <span
                className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-pen"
                aria-hidden
              />
            )}
          </button>
        ))}
      </nav>

      <div className="flex min-h-0 flex-1 flex-col">
        {profile.isPending && (
          <p className="measure px-4 py-4 text-[11px] uppercase tracking-wide text-faint">
            Reading
          </p>
        )}
        {profile.isError && (
          <p className="px-4 py-4 text-[12px] text-annot" role="alert">
            {profile.error.message}
          </p>
        )}

        {profile.data && tab === 'sources' && (
          <SourceList sources={profile.data.sources ?? []} onAdd={() => setAdding(true)} />
        )}

        {profile.data && tab === 'details' && (
          <div className="flex-1 overflow-y-auto">
            <IdentityEditor profile={profile.data} />
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-rule bg-page px-4 py-3">
        <FillPanel account={account.data} />
      </footer>
    </div>
  )
}

export function App() {
  const session = useSignedIn()

  if (session.isPending) {
    return <div className="h-full bg-ground" />
  }

  return session.data ? <SignedIn /> : <SignedOut />
}
