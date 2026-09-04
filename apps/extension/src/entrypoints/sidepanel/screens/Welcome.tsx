import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getGetAccountQueryKey } from '../../../generated/endpoints/account/account.js'
import { sendMessage } from '../../../lib/messaging.js'
import { Button, Mascot } from '../components.js'
import { IconGoogle } from '../icons.js'

/**
 * One purpose, one action, said plainly.
 *
 * What a person needs here is the shape of the bargain — you give it material about you, it
 * answers forms from that and tells you when it guessed — and one button. Nothing decorative:
 * the mark, the name, three sentences, the button.
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
    <div className="flex h-full flex-col bg-surface">
      <div className="flex flex-1 flex-col justify-center px-6">
        <Mascot expression="happy" size={44} blink />

        <h1 className="display mt-5 text-xl text-ink">Fillaform</h1>
        <p className="mt-2 max-w-[34ch] text-sm text-ink-muted">
          Fills job applications and other forms from your résumé, links and notes — in your own
          words, and marks anything it had to guess.
        </p>

        <Button
          variant="secondary"
          size="lg"
          onClick={() => signIn.mutate()}
          loading={signIn.isPending}
          className="mt-6 w-full"
        >
          <IconGoogle className="size-4" />
          {signIn.isPending ? 'Opening Google…' : 'Continue with Google'}
        </Button>

        {signIn.isError && (
          <p className="mt-3 text-xs leading-snug text-danger" role="alert">
            {signIn.error.message}
          </p>
        )}
      </div>

      <p className="px-6 pb-5 text-2xs text-ink-dim">
        Nothing on a page is read until you ask it to fill one.
      </p>
    </div>
  )
}
