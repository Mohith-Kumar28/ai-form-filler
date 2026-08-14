import { useQueryClient } from '@tanstack/react-query'
import {
  getGetProfileQueryKey,
  useDeleteSource,
} from '../../generated/endpoints/profile/profile.js'
import type { Profile, ProfileSourcesItem } from '../../generated/model/index.js'
import { IconClose } from './icons.js'

const KIND_LABEL: Record<string, string> = {
  resume: 'Résumé',
  transcript: 'Transcript',
  linkedin: 'LinkedIn',
  github: 'GitHub',
  portfolio: 'Portfolio',
  freeform: 'Notes',
  image: 'Image',
}

/**
 * Sources as ruled entries.
 *
 * Each carries an entry number, because in a notebook the order of record is information.
 * The number sits in a real margin column so the title has a consistent left edge to line
 * up against, rather than floating beside it.
 */
export function SourceList({ sources = [] }: { sources?: Profile['sources'] }) {
  const queryClient = useQueryClient()

  const remove = useDeleteSource({
    mutation: {
      onSuccess: ({ profile }) => {
        queryClient.setQueryData(getGetProfileQueryKey(), profile)
        void queryClient.invalidateQueries({ queryKey: ['account'] })
      },
    },
  })

  if (sources.length === 0) {
    return <EmptyState />
  }

  return (
    <div>
      <h2 className="px-4 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
        Recorded
      </h2>
      {sources.map((source, index) => (
        <Entry
          key={source.id}
          source={source}
          // Newest first in the list, but numbered by order of record — entry 1 is the
          // first thing ever added, which is what a page number means.
          number={sources.length - index}
          onRemove={() => remove.mutate({ id: source.id })}
          removing={remove.isPending && remove.variables?.id === source.id}
        />
      ))}
      {remove.isError && (
        <p className="px-4 py-2 text-[12px] text-annot" role="alert">
          {remove.error.message}
        </p>
      )}
    </div>
  )
}

/**
 * The empty state carries the product's premise.
 *
 * Previously this space was 600px of nothing, which is the single largest region of the
 * panel and was doing no work at all — a new user's first impression was a void.
 */
function EmptyState() {
  return (
    <div className="px-5 py-8">
      <p className="text-[14px] font-medium leading-snug text-ink">Nothing recorded yet.</p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
        Give it something to answer from — a résumé, your site, or a few lines about what you're
        looking for. The more it holds, the fewer fields it leaves blank.
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {[
          ['A résumé or transcript', 'PDF or a photo — it reads scans too'],
          ['Your site or GitHub', 'It loads the page and pulls out the substance'],
          ['Anything else', 'Visa status, notice period, past answers'],
        ].map(([title, note]) => (
          <li key={title} className="flex gap-2.5">
            <span className="mt-[7px] size-1 shrink-0 rounded-full bg-pen" aria-hidden />
            <span className="text-[12px] leading-snug">
              <span className="text-ink">{title}</span>
              <span className="text-faint"> — {note}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Entry({
  source,
  number,
  onRemove,
  removing,
}: {
  source: ProfileSourcesItem
  number: number
  onRemove: () => void
  removing: boolean
}) {
  const failed = source.status === 'failed'
  const pending = source.status === 'pending' || source.status === 'parsing'

  return (
    <article
      className="entry-in group grid grid-cols-[1.75rem_1fr_auto] items-start gap-x-2 border-t border-rule-soft px-4 py-3 transition-colors hover:bg-page"
      style={{ animationDelay: `${Math.min(number, 8) * 30}ms` }}
    >
      <span className="measure pt-px text-[11px] text-faint" aria-hidden>
        {String(number).padStart(2, '0')}
      </span>

      <div className="min-w-0">
        <h3 className="truncate text-[13.5px] font-medium leading-snug text-ink">{source.label}</h3>
        <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-muted">
          <span>{KIND_LABEL[source.kind] ?? source.kind}</span>
          {source.extractedChars !== undefined && (
            <>
              <span className="text-faint" aria-hidden>
                ·
              </span>
              <span className="measure">{source.extractedChars.toLocaleString()}</span>
              <span className="text-faint">chars</span>
            </>
          )}
          {pending && <span className="text-pen">· reading</span>}
        </p>
        {failed && source.error && <p className="mt-1 text-[11.5px] text-annot">{source.error}</p>}
      </div>

      <button
        type="button"
        onClick={onRemove}
        disabled={removing}
        aria-label={`Remove ${source.label}`}
        className="-mr-1 rounded-sharp p-1 text-faint opacity-0 transition-all hover:bg-annot-wash hover:text-annot focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-40"
      >
        <IconClose className="size-3.5" />
      </button>
    </article>
  )
}
