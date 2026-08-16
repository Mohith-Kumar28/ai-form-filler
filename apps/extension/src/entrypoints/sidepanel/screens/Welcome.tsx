import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getGetAccountQueryKey } from '../../../generated/endpoints/account/account.js'
import { sendMessage } from '../../../lib/messaging.js'
import { Button, Mascot } from '../components.js'

/**
 * One purpose, one action, said cheerfully.
 *
 * What a person needs here is the shape of the bargain — you give it material about you, it
 * answers forms from that and tells you when it guessed — and one button. The mascot and the
 * gradient do the persuading; a wall of copy never did.
 */
export function Welcome() {
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
    <div className="relative flex h-full flex-col overflow-hidden bg-surface">
      {/* The signature gradient bleeds in from the top — the one place it can be loud. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56"
        style={{ background: 'linear-gradient(180deg, var(--color-accent-muted), transparent)' }}
      />

      <div className="relative flex flex-1 flex-col justify-center px-7">
        <div className="flex items-center gap-3">
          <Mascot expression="excited" size={56} className="bounce" />
          <div>
            <p className="sunset-text font-display text-[20px] font-bold leading-none">you fill</p>
            <p className="mt-1 text-[12px] font-semibold text-ink-muted">
              the hype friend for forms
            </p>
          </div>
        </div>

        <h1 className="mt-6 font-display text-[26px] font-bold leading-[1.1] tracking-[-0.02em] text-ink">
          forms suck.
          <br />
          <span className="sunset-text">let's make 'em not.</span>
        </h1>

        <p className="mt-3 max-w-[34ch] text-[14px] leading-relaxed text-ink-muted">
          Give it your résumé, your site, a few pasted notes. It fills any form from that — and
          marks what the AI wrote, so you know what to check.
        </p>

        <Button
          variant="primary"
          size="lg"
          onClick={() => signIn.mutate()}
          loading={signIn.isPending}
          className="mt-7"
        >
          {signIn.isPending ? 'Opening Google…' : 'Continue with Google'}
        </Button>

        {signIn.isError && (
          <p className="mt-3 text-[12.5px] leading-snug text-danger" role="alert">
            {signIn.error.message}
          </p>
        )}

        <p className="mt-6 text-[11.5px] leading-relaxed text-ink-dim">
          Nothing is read from a page until you ask it to fill one.
        </p>
      </div>
    </div>
  )
}
