import type { Account, Profile } from '../../../generated/model/index.js'
import { formatResetDate, plural } from '../../../lib/format.js'
import type { ActivePage } from '../../../lib/use-active-page.js'
import { Button, Row, RowGroup, Screen, ScreenBody, ScreenHeader } from '../components.js'
import { IconSeal } from '../icons.js'
import { useNavigation } from '../navigation.js'

/**
 * The portrait oval.
 *
 * Every credential carries the holder's photograph inside a ruled frame; here that frame is
 * the whole account affordance. It replaces a header band that spent 72 of a 400px panel's
 * pixels on an avatar, a name, an email, a sign-out link, a quota sentence, a plan chip and a
 * progress rule — none of which was the task.
 */
function PortraitButton({ account, onClick }: { account: Account; onClick: () => void }) {
  const initials = (account.name ?? account.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Your document"
      className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ink text-ink transition-opacity hover:opacity-80"
    >
      {account.avatarUrl ? (
        <img src={account.avatarUrl} alt="" className="size-full object-cover" />
      ) : (
        <span className="mrz text-[10px] font-medium">{initials}</span>
      )}
    </button>
  )
}

function PageEntry({ page }: { page: ActivePage }) {
  if (page.status === 'checking') {
    return (
      <div>
        <p className="doc-label">This page</p>
        <div className="awaiting mt-2 h-4 w-2/3 rounded-doc" />
        <div className="awaiting mt-2 h-3 w-1/3 rounded-doc" />
      </div>
    )
  }

  if (page.status === 'unavailable' || page.fieldCount === 0) {
    return (
      <div>
        <p className="doc-label">This page</p>
        <p className="mt-1.5 truncate text-[14px] font-semibold tracking-[-0.01em] text-ink">
          {page.origin ?? 'Nothing to fill here'}
        </p>
        <p className="mt-1 text-[12px] leading-snug text-ink2">
          {page.status === 'unavailable'
            ? 'This kind of page cannot be read — browser pages and the Web Store are off limits.'
            : 'No form found. It will appear here as soon as one does.'}
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="doc-label">This page</p>
      <p className="mt-1.5 truncate text-[14px] font-semibold tracking-[-0.01em] text-ink">
        {page.origin}
      </p>
      <p className="mrz mt-1 text-[12px] text-ink2">
        {page.fieldCount} {plural(page.fieldCount, 'field')}
      </p>
    </div>
  )
}

export function Home({
  account,
  profile,
  page,
  hasLastFill,
  onFill,
}: {
  account: Account
  profile: Profile | undefined
  page: ActivePage
  hasLastFill: boolean
  onFill: () => void
}) {
  const nav = useNavigation()
  const sources = profile?.sources ?? []
  const readyCount = sources.filter((source) => source.status === 'ready').length

  const { used, limit, resetsAt } = account.quota
  const left = Math.max(0, limit - used)
  const exhausted = used >= limit

  const canFill = page.status === 'ready' && page.fieldCount > 0

  const blockedReason = !account.profileReady
    ? 'Add something about yourself first.'
    : exhausted
      ? `Out of forms until ${formatResetDate(resetsAt)}.`
      : null

  return (
    <Screen>
      <ScreenHeader
        title={
          <span className="flex items-center gap-2">
            <IconSeal className="size-4 shrink-0 text-ink" />
            <span>Form Filler</span>
          </span>
        }
        right={<PortraitButton account={account} onClick={() => nav.push({ name: 'profile' })} />}
      />

      <ScreenBody>
        <div className="border-b border-guilloche px-4 py-5">
          <PageEntry page={page} />

          <div className="mt-4">
            <Button
              variant="plate"
              block
              onClick={onFill}
              disabled={!canFill || blockedReason !== null}
            >
              Fill this form
            </Button>

            {/* The reason only. The row below is the action, and repeating it as a link here
                made the same destination appear twice within forty pixels. */}
            {blockedReason && (
              <p className="mt-2 text-[12px] leading-snug text-ink2">{blockedReason}</p>
            )}

            {/*
              Quota is a Profile concern, and it only interrupts here when it is about to stop
              being one. Ten is roughly a week of applying at the pace this audience works at.
            */}
            {!blockedReason && left <= 10 && (
              <p className="mrz mt-2 text-[11.5px] text-ink3">
                {left} {plural(left, 'form')} left until {formatResetDate(resetsAt)}
              </p>
            )}
          </div>
        </div>

        <RowGroup>
          {/*
            One number, not two. A trailing count of 5 beside "3 sources it can answer from"
            asks the reader to work out which of the two matters — and the answer is always the
            ready count, because a source still being read cannot answer anything yet.
          */}
          <Row
            title="What it knows"
            detail={
              sources.length === 0
                ? 'Add a résumé, a link, or a few pasted lines'
                : readyCount === sources.length
                  ? `${readyCount} ${plural(readyCount, 'source')} it can answer from`
                  : `${readyCount} of ${sources.length} ready to answer from`
            }
            onClick={() => nav.push({ name: 'knowledge' })}
          />
          {hasLastFill && (
            <Row
              title="Last fill on this page"
              detail="What it wrote, and what it guessed"
              onClick={() => nav.push({ name: 'review' })}
            />
          )}
        </RowGroup>
      </ScreenBody>
    </Screen>
  )
}
