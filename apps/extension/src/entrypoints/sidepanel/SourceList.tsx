import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteSource, getGetProfileQueryKey } from '../../generated/endpoints/profile/profile.js'
import type { ProfileSourcesItem as ProfileSource } from '../../generated/model/index.js'
import { API_URL, STORAGE_KEYS } from '../../lib/config.js'
import { readLocal } from '../../lib/storage.js'

/**
 * What the notebook has been given.
 *
 * Every row is openable: a source you cannot look at again is one you cannot verify, and the
 * most common question about a stored file is "which resume is that". Files open in a tab,
 * links open where they point, and pasted text has nothing to open — so it says so rather
 * than offering a dead affordance.
 */

const KIND_LABEL: Record<string, string> = {
  document: 'Document',
  link: 'Link',
  text: 'Text',
  image: 'Image',
  audio: 'Voice',
}

function KindIcon({ kind }: { kind: string }) {
  const paths: Record<string, string> = {
    document: 'M4 2h5l3 3v9H4V2Z M9 2v3h3',
    link: 'M6.5 9.5a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5l-.8.8 M9.5 6.5a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 7.5 12l.8-.8',
    text: 'M3.5 4h9 M3.5 8h9 M3.5 12h5',
    image: 'M2.5 3.5h11v9h-11z M2.5 10l3-3 3 3 2-2 3 3',
    audio: 'M8 2.5v11 M5 5.5v5 M11 5.5v5 M2.5 7.5v1 M13.5 7.5v1',
  }

  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
      aria-hidden="true"
    >
      <path d={paths[kind] ?? paths.document} />
    </svg>
  )
}

function formatSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Opens a stored original.
 *
 * The file endpoint needs the session token, and a plain `<a href>` cannot carry one — so
 * the bytes are fetched, wrapped in a blob URL, and opened. That also means the token never
 * lands in a URL, where it would end up in history and in any tab-sharing surface.
 */
async function openSourceFile(source: ProfileSource): Promise<void> {
  if (source.kind === 'link' && source.url) {
    await chrome.tabs.create({ url: source.url })
    return
  }
  if (!source.hasFile) return

  const token = await readLocal<string>(STORAGE_KEYS.sessionToken)
  const response = await fetch(`${API_URL}/v1/profile/sources/${source.id}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) return

  const url = URL.createObjectURL(await response.blob())
  await chrome.tabs.create({ url })
  // The tab holds its own reference once loaded; releasing later avoids leaking the blob for
  // the lifetime of the panel.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function SourceList({ sources, onAdd }: { sources: ProfileSource[]; onAdd: () => void }) {
  const queryClient = useQueryClient()

  const remove = useMutation({
    mutationFn: (id: string) => deleteSource(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() }),
  })

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {sources.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[13px] text-ink">Nothing recorded yet</p>
            <p className="mx-auto mt-1 max-w-[26ch] text-[11.5px] leading-snug text-muted">
              Add a resume, a link, or just talk about yourself. One is enough to start.
            </p>
          </div>
        ) : (
          <ul>
            {sources.map((source) => {
              const openable = source.hasFile || (source.kind === 'link' && !!source.url)
              return (
                <li key={source.id} className="border-b border-rule-soft">
                  <div className="flex items-center gap-2.5 px-4 py-2.5">
                    <span className="text-faint">
                      <KindIcon kind={source.kind} />
                    </span>

                    <button
                      type="button"
                      disabled={!openable}
                      onClick={() => void openSourceFile(source)}
                      className="min-w-0 flex-1 text-left disabled:cursor-default"
                    >
                      <span
                        className={`block truncate text-[12.5px] leading-snug ${
                          openable ? 'text-ink hover:text-pen' : 'text-ink'
                        }`}
                      >
                        {source.label}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-faint">
                        {[
                          KIND_LABEL[source.kind] ?? source.kind,
                          formatSize(source.sizeBytes),
                          source.status === 'failed' ? 'Failed' : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => remove.mutate(source.id)}
                      disabled={remove.isPending}
                      aria-label={`Remove ${source.label}`}
                      className="shrink-0 text-[11px] text-faint transition-colors hover:text-annot disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>

                  {source.error && (
                    <p className="px-4 pb-2 text-[11px] text-annot">{source.error}</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* The primary action, given the weight it deserves rather than tucked under a list. */}
      <div className="shrink-0 border-t border-rule bg-page p-3">
        <button
          type="button"
          onClick={onAdd}
          className="w-full rounded-sharp bg-pen py-2 text-[13px] font-medium text-page transition-opacity hover:opacity-90"
        >
          Add a source
        </button>
      </div>
    </div>
  )
}
