import { PLAN_FACT_LIMITS, PLAN_SOURCE_LIMITS } from '@aff/shared'
import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import {
  getGetAccountQueryKey,
  useGetAccount,
} from '../../../generated/endpoints/account/account.js'
import {
  getGetProfileQueryKey,
  useDeleteSource,
  useRenameSource,
  useReprocessSource,
} from '../../../generated/endpoints/profile/profile.js'
import type { Profile, ProfileSourcesItem } from '../../../generated/model/index.js'
import { openTrial, openUpgrade } from '../../../lib/billing.js'
import {
  type CatalogField,
  customFactCount,
  type FactSection,
  FIELDS_BY_SECTION,
  fieldFor,
  SECTIONS,
  sectionProgress,
} from '../../../lib/fact-catalog.js'
import { plural } from '../../../lib/format.js'
import { usePaywallSeen } from '../../../lib/paywall.js'
import { useProfileEditor } from '../../../lib/profile-editor.js'
import { openSourceInTab } from '../../../lib/source-file.js'
import {
  Body,
  Button,
  ConfirmSheet,
  Field,
  Group,
  Header,
  Input,
  Menu,
  Note,
  SaveState,
  Screen,
  Sheet,
  SheetTitle,
  SkeletonRows,
  Spinner,
  Tag,
} from '../components.js'
import { IconChevronRight, IconPlus, IconSearch } from '../icons.js'
import { useNavigation } from '../navigation.js'
import { DetailRow } from './detail-row.js'
import { DocumentTile, documentMeta, isBusy } from './documents.js'

/*
  The knowledge base: everything the product can answer a form from, in two halves.

  **Sources** are what it reads — a résumé, a link, a pasted note, a voice recording. They sit
  first because they are what makes the answers good, and because a person arriving here for the
  first time needs to add one before anything else matters.

  **Facts** are the short answers it copies into a field exactly. They are laid out as the whole
  catalogue — About, Address, IDs, Work, Links — rather than a list of only what happens to be
  filled: seeing the empty boxes is how you learn what a form can ask for without waiting to be
  asked. Every section starts shut, with its filled-of-total count on the header, so the screen
  opens as six lines rather than thirty-eight rows. Your own fields go in Extra at the end.
*/

type View = 'sources' | 'facts'

const TABS: { key: View; label: string }[] = [
  { key: 'sources', label: 'Sources' },
  { key: 'facts', label: 'Facts' },
]

function linkLabel(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1)
}

export function Knowledge({
  profile,
  initialView = 'sources',
}: {
  profile: Profile | undefined
  initialView?: View
}) {
  const nav = useNavigation()
  const editor = useProfileEditor(profile)
  const [view, setView] = useState<View>(initialView)

  return (
    <Screen>
      <Header
        title="Knowledge base"
        onBack={nav.back}
        right={<SaveState status={editor.status} error={editor.error} onRetry={editor.retry} />}
      />
      <div className="border-border-muted border-b px-gutter">
        <div role="tablist" aria-label="What to show" className="-mb-px flex gap-4">
          {TABS.map((tab) => {
            const selected = tab.key === view
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setView(tab.key)}
                className={`-mb-px relative h-9 border-b-2 font-medium text-xs transition-colors ${
                  selected
                    ? 'border-accent text-ink'
                    : 'border-transparent text-ink-dim hover:text-ink'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>
      <Body className="space-y-4 pt-3 pb-4">
        {profile === undefined ? (
          <Group>
            <SkeletonRows />
          </Group>
        ) : view === 'sources' ? (
          <Documents profile={profile} />
        ) : (
          <Facts editor={editor} />
        )}
      </Body>
    </Screen>
  )
}

/* ── Facts ────────────────────────────────────────────────────────────────── */

type Editor = ReturnType<typeof useProfileEditor>

/** A collapsible group of the catalogue, with how much of it is filled. */
function Section({
  title,
  filled,
  total,
  open,
  onToggle,
  children,
}: {
  title: string
  filled: number
  total: number
  open: boolean
  onToggle: (open: boolean) => void
  children: ReactNode
}) {
  return (
    <section className="px-gutter">
      <button
        type="button"
        onClick={() => onToggle(!open)}
        aria-expanded={open}
        className="flex h-9 w-full items-center gap-1.5 pl-0.5 text-left"
      >
        <IconChevronRight
          className={`size-3.5 shrink-0 text-ink-dim transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <span className="flex-1 truncate font-medium text-ink text-xs">{title}</span>
        <span className="tnum shrink-0 text-2xs text-ink-dim">
          {filled} of {total}
        </span>
      </button>
      {open && (
        <div className="divide-y divide-border-muted overflow-hidden rounded-lg border border-border bg-surface-raised">
          {children}
        </div>
      )}
    </section>
  )
}

function Facts({ editor }: { editor: Editor }) {
  const account = useGetAccount()
  const plan = (account.data?.quota.plan ?? 'free') as keyof typeof PLAN_FACT_LIMITS
  const factLimit = PLAN_FACT_LIMITS[plan]
  const { markSeen } = usePaywallSeen()
  const { draft } = editor

  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [opened, setOpened] = useState<Partial<Record<string, boolean>>>({})
  const q = query.trim().toLowerCase()

  const matches = (label: string, field?: CatalogField) =>
    !q ||
    label.toLowerCase().includes(q) ||
    (field?.aliases?.some((alias) => alias.includes(q)) ?? false)

  const extraLinkKeys = Object.keys(draft.extraLinks).filter((key) => matches(linkLabel(key)))
  const extraKeys = Object.keys(draft.extras).filter((key) => matches(key))

  const usedFacts = customFactCount(draft)
  const atLimit = usedFacts >= factLimit

  /*
    Collapsed until asked for. Six open sections is a 38-row scroll, and the count on each
    shut header already says where the gaps are. Searching opens whatever it hits.
  */
  const isOpen = (section: string, hasMatches: boolean) =>
    q ? hasMatches : opened[section] === true

  const sections = SECTIONS.filter((meta) => meta.section !== 'extra').map((meta) => {
    const fields = (FIELDS_BY_SECTION[meta.section] ?? []).filter((field) =>
      matches(field.label, field),
    )
    const links = meta.section === 'links' ? extraLinkKeys : []
    return { meta, fields, links }
  })

  const nothingMatches =
    q &&
    extraKeys.length === 0 &&
    sections.every((section) => section.fields.length === 0 && section.links.length === 0)

  return (
    <>
      <div className="px-gutter">
        <div className="relative">
          <IconSearch className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 size-3.5 text-ink-dim" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search all fields"
            aria-label="Search fields"
            className="pl-8"
          />
        </div>
        <p className="mt-2 pl-0.5 text-2xs text-ink-dim leading-relaxed">
          Copied into a field exactly, whenever a form asks. Free, every time.
        </p>
      </div>

      {sections.map(({ meta, fields, links }) => {
        const hasMatches = fields.length > 0 || links.length > 0
        if (q && !hasMatches) return null
        const progress = sectionProgress(meta.section as FactSection, draft)
        return (
          <Section
            key={meta.section}
            title={meta.title}
            filled={progress.filled}
            total={progress.total}
            open={isOpen(meta.section, hasMatches)}
            onToggle={(open) => setOpened((current) => ({ ...current, [meta.section]: open }))}
          >
            {fields.map((field) => (
              <DetailRow
                key={field.key}
                entry={{
                  id: field.key,
                  label: field.label,
                  value: draft.values[field.key] ?? '',
                  field,
                  onChange: (next) => editor.setValue(field.key, next),
                }}
                onCommit={editor.commit}
              />
            ))}
            {/* Platforms the ingest pass invented. Editable, so they can be cleared. */}
            {links.map((key) => (
              <DetailRow
                key={key}
                entry={{
                  id: `link:${key}`,
                  label: linkLabel(key),
                  value: draft.extraLinks[key] ?? '',
                  onChange: (next) => editor.setExtraLink(key, next),
                }}
                onCommit={editor.commit}
                onRemove={() => editor.setExtraLink(key, '')}
              />
            ))}
          </Section>
        )
      })}

      {(!q || extraKeys.length > 0) && (
        <Section
          title="Extra fields"
          filled={extraKeys.filter((key) => (draft.extras[key] ?? '').trim() !== '').length}
          total={extraKeys.length}
          open={isOpen('extra', extraKeys.length > 0)}
          onToggle={(open) => setOpened((current) => ({ ...current, extra: open }))}
        >
          {extraKeys.map((key) => (
            <DetailRow
              key={key}
              entry={{
                id: `extra:${key}`,
                label: key,
                value: draft.extras[key] ?? '',
                onChange: (next) => editor.setExtra(key, next),
              }}
              onCommit={editor.commit}
              onRename={() => setRenaming(key)}
              onRemove={() => editor.removeExtra(key)}
            />
          ))}
          {extraKeys.length === 0 && (
            <p className="px-3 py-2.5 text-ink-dim text-xs">
              Anything a form asks that the list above does not cover goes here.
            </p>
          )}
          <div className="px-3 py-2">
            <Button size="sm" variant="ghost" disabled={atLimit} onClick={() => setAdding(true)}>
              <IconPlus className="size-3.5" />
              Add your own field
            </Button>
          </div>
        </Section>
      )}

      {nothingMatches && (
        <p className="py-8 text-center text-ink-muted text-sm">
          Nothing matches “{query.trim()}”. Add it as your own field.
        </p>
      )}

      {atLimit && (
        <div className="px-gutter">
          <Note tone="accent">
            {usedFacts} of {factLimit} custom fields used.{' '}
            {plan === 'free'
              ? `The free trial raises this to ${PLAN_FACT_LIMITS.pro}.`
              : 'Remove one to add another.'}{' '}
            <button
              type="button"
              className="font-medium underline-offset-2 hover:underline"
              onClick={() => {
                markSeen()
                void (plan === 'free' ? openTrial() : openUpgrade())
              }}
            >
              {plan === 'free' ? 'Start free trial' : 'Compare plans'}
            </button>
          </Note>
        </div>
      )}

      {renaming !== null && (
        <RenameFieldSheet
          current={renaming}
          taken={Object.keys(draft.extras)}
          onClose={() => setRenaming(null)}
          onRename={(next) => {
            editor.renameExtra(renaming, next)
            setRenaming(null)
          }}
        />
      )}

      {adding && (
        <AddFieldSheet
          taken={Object.keys(draft.extras)}
          onClose={() => setAdding(false)}
          onAdd={(name, value) => {
            editor.setExtra(name, value)
            setAdding(false)
          }}
        />
      )}
    </>
  )
}

/** Rename one of your own fields. The value goes with it. */
function RenameFieldSheet({
  current,
  taken,
  onClose,
  onRename,
}: {
  current: string
  taken: string[]
  onClose: () => void
  onRename: (name: string) => void
}) {
  const [name, setName] = useState(current)
  const trimmed = name.trim()
  const clash = taken.some(
    (key) => key !== current && key.trim().toLowerCase() === trimmed.toLowerCase(),
  )
  const ready = trimmed !== '' && !clash
  const submit = () => {
    if (!ready) return
    if (trimmed === current) onClose()
    else onRename(trimmed)
  }

  return (
    <Sheet label="Rename field" onClose={onClose}>
      <SheetTitle title="Rename field" subtitle="Name it the way the form asks for it." />
      <Field label="Name" error={clash ? 'You already have a field called that.' : undefined}>
        {(ids) => (
          <Input
            id={ids.id}
            aria-describedby={ids.describedBy}
            autoFocus
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit()
            }}
          />
        )}
      </Field>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button block onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" block disabled={!ready} onClick={submit}>
          Save
        </Button>
      </div>
    </Sheet>
  )
}

/** Your own field: a name and a value, for anything the catalogue does not cover. */
function AddFieldSheet({
  taken,
  onClose,
  onAdd,
}: {
  taken: string[]
  onClose: () => void
  onAdd: (name: string, value: string) => void
}) {
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const trimmed = name.trim()
  const known = trimmed ? fieldFor(trimmed) : undefined
  const clash = taken.some((key) => key.trim().toLowerCase() === trimmed.toLowerCase())
  const ready = trimmed !== '' && value.trim() !== '' && !clash && !known
  const submit = () => {
    if (ready) onAdd(trimmed, value.trim())
  }

  return (
    <Sheet label="Add your own field" onClose={onClose}>
      <SheetTitle
        title="Add your own field"
        subtitle="Name it the way the form asks for it, and give it the answer to copy in."
      />
      <div className="space-y-3">
        <Field
          label="Name"
          error={
            known
              ? `That is “${known.label}” in the list above.`
              : clash
                ? 'You already have a field called that.'
                : undefined
          }
        >
          {(ids) => (
            <Input
              id={ids.id}
              aria-describedby={ids.describedBy}
              autoFocus
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              placeholder="T-shirt size"
            />
          )}
        </Field>
        <Field label="Value">
          {(ids) => (
            <Input
              id={ids.id}
              aria-describedby={ids.describedBy}
              value={value}
              placeholder="What it should write"
              onChange={(event) => setValue(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit()
              }}
            />
          )}
        </Field>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button block onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" block disabled={!ready} onClick={submit}>
          Add
        </Button>
      </div>
    </Sheet>
  )
}

/* ── Documents ────────────────────────────────────────────────────────────── */

function Documents({ profile }: { profile: Profile }) {
  const nav = useNavigation()
  const queryClient = useQueryClient()
  const account = useGetAccount()
  const plan = (account.data?.quota.plan ?? 'free') as keyof typeof PLAN_SOURCE_LIMITS
  const limit = PLAN_SOURCE_LIMITS[plan]
  const { markSeen } = usePaywallSeen()
  const sources = profile.sources ?? []
  const atLimit = sources.length >= limit

  const [removing, setRemoving] = useState<ProfileSourcesItem | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [rereading, setRereading] = useState<string | null>(null)
  const [rereadError, setRereadError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<ProfileSourcesItem | null>(null)

  const rename = useRenameSource({
    mutation: {
      onSuccess: (updated) => queryClient.setQueryData(getGetProfileQueryKey(), updated.profile),
    },
  })
  const reprocess = useReprocessSource({
    mutation: {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetProfileQueryKey(), updated.profile)
        void queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() })
        setRereadError(null)
      },
      onError: (error) => setRereadError(error.message),
      onSettled: () => setRereading(null),
    },
  })
  const remove = useDeleteSource({
    mutation: {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetProfileQueryKey(), updated.profile)
        void queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() })
        setRemoving(null)
        setRemoveError(null)
      },
      onError: (error) => setRemoveError(error.message),
    },
  })

  return (
    <>
      <Group
        title="Documents"
        aside={
          <Button
            size="sm"
            variant="ghost"
            disabled={atLimit}
            onClick={() => nav.push({ name: 'addDocument' })}
          >
            <IconPlus className="size-3.5" />
            Add
          </Button>
        }
      >
        {sources.length === 0 ? (
          <div className="px-3 py-4">
            <p className="text-sm text-ink">Nothing to read yet</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-dim">
              A résumé is the best start. Links, notes and voice recordings work too.
            </p>
            <Button
              variant="primary"
              size="sm"
              className="mt-3"
              onClick={() => nav.push({ name: 'addDocument' })}
            >
              <IconPlus className="size-3.5" />
              Add a résumé
            </Button>
          </div>
        ) : (
          sources.map((source) => {
            const busy = isBusy(source) || rereading === source.id
            const items = [
              { label: 'Rename', onSelect: () => setRenaming(source) },
              ...(source.kind === 'link'
                ? [{ label: 'Open link', onSelect: () => void openSourceInTab(source) }]
                : [
                    {
                      label: 'Preview',
                      onSelect: () => nav.push({ name: 'document', id: source.id }),
                    },
                  ]),
              ...(busy
                ? []
                : [
                    {
                      label: 'Read again',
                      onSelect: () => {
                        setRereadError(null)
                        setRereading(source.id)
                        reprocess.mutate({ id: source.id })
                      },
                    },
                  ]),
              {
                label: 'Remove',
                onSelect: () => {
                  setRemoveError(null)
                  setRemoving(source)
                },
                tone: 'danger' as const,
              },
            ]
            return (
              <div key={source.id}>
                <div className="flex items-center gap-2.5 py-2 pr-1.5 pl-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={
                      source.kind === 'link'
                        ? () => void openSourceInTab(source)
                        : () => nav.push({ name: 'document', id: source.id })
                    }
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <DocumentTile source={source} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm text-ink">{source.label}</span>
                        {busy ? (
                          <Tag tone="accent">
                            <Spinner className="size-2.5" />
                            {rereading === source.id ? 'Reading again' : 'Reading'}
                          </Tag>
                        ) : source.status === 'failed' ? (
                          <Tag tone="danger">Couldn't read</Tag>
                        ) : null}
                      </span>
                      <span className="block truncate text-xs text-ink-dim">
                        {documentMeta(source)}
                      </span>
                    </span>
                  </button>
                  <Menu items={items} label={`Options for ${source.label}`} />
                </div>
                {busy && <div className="awaiting h-0.5 w-full" aria-hidden="true" />}
                {source.status === 'failed' && !busy && (
                  <div className="border-t border-border-muted px-3 py-2">
                    {source.error && (
                      <p className="text-xs leading-snug text-danger">{source.error}</p>
                    )}
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        setRereadError(null)
                        setRereading(source.id)
                        reprocess.mutate({ id: source.id })
                      }}
                    >
                      Read it again
                    </Button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </Group>
      {rereadError && (
        <div className="px-gutter pt-3">
          <Note tone="danger">{rereadError}</Note>
        </div>
      )}

      {atLimit && (
        <div className="px-gutter pt-3">
          <Note tone="accent">
            All {limit} document {plural(limit, 'slot')} are full.{' '}
            {plan === 'free'
              ? `The free trial makes room for ${PLAN_SOURCE_LIMITS.pro}.`
              : 'Remove one to add another.'}{' '}
            <button
              type="button"
              className="font-medium underline-offset-2 hover:underline"
              onClick={() => {
                markSeen()
                void (plan === 'free' ? openTrial() : openUpgrade())
              }}
            >
              {plan === 'free' ? 'Start free trial' : 'Compare plans'}
            </button>
          </Note>
        </div>
      )}

      {renaming && (
        <RenameSheet
          source={renaming}
          onClose={() => setRenaming(null)}
          onRename={(label) => {
            rename.mutate({ id: renaming.id, data: { label } })
            setRenaming(null)
          }}
        />
      )}

      {removing && (
        <ConfirmSheet
          title={`Remove ${removing.label}?`}
          body="This deletes the stored copy and everything learned from it. Answers already written stay where they are. This cannot be undone."
          confirmLabel="Remove"
          pending={remove.isPending}
          error={removeError ?? undefined}
          onConfirm={() => remove.mutate({ id: removing.id })}
          onCancel={() => {
            setRemoving(null)
            setRemoveError(null)
          }}
        />
      )}
    </>
  )
}

function RenameSheet({
  source,
  onClose,
  onRename,
}: {
  source: ProfileSourcesItem
  onClose: () => void
  onRename: (label: string) => void
}) {
  const [draft, setDraft] = useState(source.label)
  const commit = () => {
    const next = draft.trim()
    if (next && next !== source.label) onRename(next)
    else onClose()
  }
  return (
    <Sheet label="Rename" onClose={onClose}>
      <SheetTitle title="Rename" />
      <Input
        autoFocus
        aria-label="Name"
        value={draft}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
        }}
      />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button block onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" block onClick={commit} disabled={draft.trim() === ''}>
          Save
        </Button>
      </div>
    </Sheet>
  )
}
