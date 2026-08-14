import type { Account } from '../../generated/model/index.js'
import type { FillState } from '../../lib/use-fill.js'
import { STAGE_LABEL } from '../../lib/use-fill.js'
import { IconInferred, IconPen, IconVerified } from './icons.js'

/**
 * The fill action and its progress. Nothing else.
 *
 * Everything about the *result* belongs to `ReviewPanel`, which replaces this surface once a
 * fill finishes. Keeping a second copy of the result here is what produced two competing
 * views of the same answers.
 */
/**
 * Fill state arrives as props; this component owns none of it.
 *
 * It used to call `useFill()` itself, which is plain `useState` per call site — so the panel
 * had **two independent fill states**. Port events reach only the instance that opened the
 * port, so pressing "Fill this page" drove *this* copy to `done` while the one deciding
 * whether to show the review stayed `idle`. The form filled, the button stopped spinning,
 * and nothing else happened: no review, no error, no way back to the answers.
 */
export function FillPanel({
  account,
  state,
  start,
}: {
  account: Account
  state: FillState
  start: (options: { overwriteExisting: boolean }) => void
}) {
  const outOfQuota = account.quota.used >= account.quota.limit
  const disabled = !account.profileReady || outOfQuota || state.status === 'running'

  /**
   * No done state here.
   *
   * A finished fill is handed to `ReviewPanel`, which takes over the whole surface. This
   * component used to render its own summary and its own judgement-call list underneath the
   * profile tabs, so the same answers appeared in two places with different affordances —
   * one read-only, one editable — and neither looked like the primary one.
   */
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => start({ overwriteExisting: false })}
        className="flex w-full items-center justify-center gap-2 rounded-sharp bg-pen py-2.5 text-[13px] font-medium text-page transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {state.status === 'running' ? (
          <>
            <span className="size-1.5 animate-pulse rounded-full bg-page" aria-hidden />
            {STAGE_LABEL[state.stage ?? 'detecting'] ?? 'Working'}
          </>
        ) : (
          <>
            <IconPen className="size-4" />
            Fill this page
          </>
        )}
      </button>

      {state.status === 'error' && (
        <p className="text-[12px] text-annot" role="alert">
          {state.error?.message}
        </p>
      )}

      {!account.profileReady && (
        <p className="text-center text-[11px] text-faint">Record something first</p>
      )}
      {outOfQuota && account.profileReady && (
        <p className="text-center text-[11px] text-annot">
          Out of forms until {new Date(account.quota.resetsAt).toLocaleDateString()}
        </p>
      )}
    </div>
  )
}

function _Group({
  title,
  note,
  tone,
  fills,
}: {
  title: string
  note: string
  tone: 'annot' | 'graphite'
  fills: { fieldId: string; value: string; reasoning?: string }[]
}) {
  const Icon = tone === 'annot' ? IconInferred : IconVerified

  return (
    <section>
      <h3
        className={`flex items-center gap-1.5 text-[12px] font-medium ${
          tone === 'annot' ? 'text-annot' : 'text-muted'
        }`}
      >
        <Icon className="size-3.5" />
        {title}
        <span className="measure text-[11px] font-normal text-faint">{fills.length}</span>
      </h3>
      <p className="mt-0.5 text-[11px] text-faint">{note}</p>

      <ul className="mt-1.5">
        {fills.map((fill) => (
          <li key={fill.fieldId} className="border-t border-rule py-2">
            <p className="text-[12px] leading-snug text-ink">{fill.value}</p>
            {fill.reasoning && (
              <p className="mt-1 text-[11px] italic leading-snug text-faint">{fill.reasoning}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
