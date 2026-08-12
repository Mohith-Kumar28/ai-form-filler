import { useQueryClient } from '@tanstack/react-query'
import {
  getGetProfileQueryKey,
  useDeleteSource,
} from '../../generated/endpoints/profile/profile.js'
import type { Profile, ProfileSourcesItem } from '../../generated/model/index.js'

const KIND_LABEL: Record<string, string> = {
  resume: 'Resume',
  transcript: 'Transcript',
  linkedin: 'LinkedIn',
  github: 'GitHub',
  portfolio: 'Portfolio',
  freeform: 'Notes',
  image: 'Image',
}

function StatusDot({ status }: { status: ProfileSourcesItem['status'] }) {
  const tone =
    status === 'ready' ? 'bg-ok' : status === 'failed' ? 'bg-review' : 'bg-ink-muted animate-pulse'
  return <span className={`size-1.5 shrink-0 rounded-full ${tone}`} aria-hidden />
}

/**
 * `sources` is optional in the generated type because the Zod schema declares `.default([])`,
 * which OpenAPI renders as "may be omitted on input". Responses always carry it, but the
 * type is right to make us say so rather than assume.
 */
export function SourceList({ sources = [] }: { sources?: Profile['sources'] }) {
  const queryClient = useQueryClient()

  const remove = useDeleteSource({
    mutation: {
      onSuccess: ({ profile }) => {
        queryClient.setQueryData(getGetProfileQueryKey(), profile)
        // Deleting the last source flips profileReady, which lives on the account.
        void queryClient.invalidateQueries({ queryKey: ['account'] })
      },
    },
  })

  if (sources.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line p-4 text-xs text-ink-muted">
        No sources yet. Add a resume or paste some text — nothing can be filled until there's
        something to fill from.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {sources.map((source) => (
        <li
          key={source.id}
          className="flex items-center gap-2 rounded-md border border-line bg-surface-raised px-3 py-2"
        >
          <StatusDot status={source.status} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{source.label}</p>
            <p className="truncate text-[11px] text-ink-muted">
              {KIND_LABEL[source.kind] ?? source.kind}
              {source.extractedChars !== undefined &&
                ` · ${source.extractedChars.toLocaleString()} chars`}
              {source.error && ` · ${source.error}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => remove.mutate({ id: source.id })}
            disabled={remove.isPending && remove.variables?.id === source.id}
            aria-label={`Remove ${source.label}`}
            className="shrink-0 rounded p-1 text-ink-muted transition-colors hover:bg-line hover:text-ink disabled:opacity-40"
          >
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor">
              <title>Remove</title>
              <path d="M4 4l8 8M12 4l-8 8" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </li>
      ))}
      {remove.isError && (
        <li className="text-xs text-review" role="alert">
          {remove.error.message}
        </li>
      )}
    </ul>
  )
}
