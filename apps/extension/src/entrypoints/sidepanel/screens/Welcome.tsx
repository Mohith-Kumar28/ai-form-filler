import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getGetAccountQueryKey } from '../../../generated/endpoints/account/account.js'
import { sendMessage } from '../../../lib/messaging.js'
import { guillocheDataUri } from '../../../lib/tokens.js'
import { Button } from '../components.js'
import { IconSeal } from '../icons.js'

/**
 * One purpose, one action.
 *
 * The old first run listed what the tool does in a paragraph nobody signed in to read. What a
 * person needs here is the shape of the bargain — you give it material about you, it answers
 * forms from that and tells you when it guessed — and a button.
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
    <div className="relative flex h-full flex-col justify-center overflow-hidden bg-stock px-6">
      {/* The unissued document: security ground printed, nothing filled in yet. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: guillocheDataUri('currentColor'),
          backgroundRepeat: 'repeat',
          color: 'var(--color-engine)',
          // Held to the upper right, clear of the headline and the paragraph beneath it.
          maskImage: 'radial-gradient(95% 52% at 88% 10%, black, transparent 72%)',
        }}
      />

      <div className="relative">
        <span className="flex size-9 items-center justify-center rounded-full border border-ink text-ink">
          <IconSeal className="size-5" />
        </span>

        <h1 className="mt-5 text-[21px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
          Everything you have
          <br />
          already written down.
        </h1>

        <p className="mt-3 max-w-[33ch] text-[13px] leading-relaxed text-ink2">
          Give it your résumé, your site, a few pasted notes. It answers any form from that — and
          marks every answer it concluded rather than read, so you know which ones to check.
        </p>

        <Button
          variant="plate"
          onClick={() => signIn.mutate()}
          loading={signIn.isPending}
          className="mt-6"
        >
          {signIn.isPending ? 'Opening Google…' : 'Continue with Google'}
        </Button>

        {signIn.isError && (
          <p className="mt-2.5 text-[12px] leading-snug text-alert" role="alert">
            {signIn.error.message}
          </p>
        )}

        <p className="mt-6 max-w-[34ch] text-[11.5px] leading-relaxed text-ink3">
          Nothing is read from a page until you ask it to fill one.
        </p>
      </div>
    </div>
  )
}
