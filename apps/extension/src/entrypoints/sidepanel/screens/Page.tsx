import { offerFor, PLAN_LIMITS, PLAN_LONGFORM_LIMITS } from '@aff/shared/constants'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import type { Account, Profile } from '../../../generated/model/index.js'
import { factCount, reconcile, toPatch } from '../../../lib/fact-catalog.js'
import { formatCount, plural } from '../../../lib/format.js'
import {
  buildPreview,
  buildResult,
  type PreviewRow,
  type Result,
  type ResultRow,
} from '../../../lib/ledger.js'
import { sendMessage } from '../../../lib/messaging.js'
import { usePaywallSeen } from '../../../lib/paywall.js'
import { useProfileEditor } from '../../../lib/profile-editor.js'
import { useReviewDraft } from '../../../lib/review-store.js'
import { createStageWalk, type StageWalk, stageIndex } from '../../../lib/stage-walk.js'
import type { ActivePage } from '../../../lib/use-active-page.js'
import type { FillState } from '../../../lib/use-fill.js'
import { useShortcut } from '../../../lib/use-shortcut.js'
import {
  Body,
  Button,
  Card,
  Dot,
  Empty,
  Footer,
  Group,
  Header,
  IconButton,
  Input,
  Kbd,
  Note,
  Row,
  Screen,
  Skeleton,
  Tag,
  UpgradeSheet,
} from '../components.js'
import {
  IconBack,
  IconCheck,
  IconChevronRight,
  IconGear,
  IconLink,
  IconMascot,
  IconSparkle,
  IconUser,
} from '../icons.js'
import { Mascot } from '../mascot.js'
import { useNavigation } from '../navigation.js'

/*
  The page. The one screen the panel opens on, and the only one about the form beside it.

  It is a ledger of the questions on the page and what Fill does to each of them: copied from a
  saved detail, written by the model, or left alone because it already has an answer. After a
  fill the same ledger becomes the receipt — what was a judgement call, what was stated, what
  stayed blank — and the footer walks the judgement calls one at a time on the page.
*/

const STAGES = [
  { key: 'detecting', label: 'Finding the form' },
  { key: 'reading', label: 'Reading the page' },
  { key: 'generating', label: 'Writing answers' },
  { key: 'applying', label: 'Filling the fields' },
] as const

let lastHighlighted: string | null = null
function highlight(fieldId: string): void {
  if (lastHighlighted === fieldId) return
  lastHighlighted = fieldId
  void sendMessage({ type: 'content/highlight', fieldId })
}

function openOnPage(fieldId: string): void {
  void sendMessage({ type: 'review/open', fieldId })
}

function Favicon({ origin }: { origin: string }) {
  const [failed, setFailed] = useState(false)
  const url = `${chrome.runtime.getURL('/_favicon/')}?pageUrl=${encodeURIComponent(`https://${origin}`)}&size=32`
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border-muted bg-surface-muted">
      {failed ? (
        <IconLink className="size-3.5 text-ink-dim" />
      ) : (
        <img src={url} alt="" onError={() => setFailed(true)} className="size-4 rounded-sm" />
      )}
    </span>
  )
}

/** Smooths the fill's stages so a fast one still reads as a sequence, not a flicker. */
function useDisplayedStage(state: FillState): string {
  const [shown, setShown] = useState('detecting')
  const walk = useRef<StageWalk | null>(null)
  useEffect(() => {
    const created = createStageWalk(setShown)
    walk.current = created
    return () => {
      created.stop()
      walk.current = null
    }
  }, [])
  useEffect(() => {
    if (state.stage) walk.current?.report(state.stage)
  }, [state.stage])
  useEffect(() => {
    if (state.status !== 'running') walk.current?.drain()
  }, [state.status])
  return shown
}

const PLAN_BADGE: Record<string, string> = { pro: 'Pro', ultra: 'Ultra' }

export function PageHeader({ plan }: { plan?: string }) {
  const nav = useNavigation()
  const badge = plan ? PLAN_BADGE[plan] : undefined
  return (
    <Header
      left={
        <span className="flex items-center gap-2">
          <Mascot size={18} />
          <span className="font-semibold text-ink text-sm tracking-[-0.01em]">Fillaform</span>
          {/*
            Filled accent rather than the muted Tag used everywhere else: this is the one badge
            on the panel that is meant to feel like something you were given. Free plans show
            nothing at all, so the header stays quiet for anyone who has not paid — and nobody
            who has not met the money is shown a word about plans.
          */}
          {badge && (
            <span className="inline-flex h-4 shrink-0 items-center rounded-[4px] bg-accent px-1.5 font-semibold text-[10px] text-surface-raised uppercase tracking-[0.05em]">
              {badge}
            </span>
          )}
        </span>
      }
      right={
        <>
          <Button variant="ghost" size="sm" onClick={() => nav.push({ name: 'knowledge' })}>
            <IconUser className="size-3.5" />
            Knowledge
          </Button>
          <IconButton label="Settings" onClick={() => nav.push({ name: 'settings' })}>
            <IconGear className="size-4" />
          </IconButton>
        </>
      }
    />
  )
}

export function Page({
  account,
  profile,
  page,
  fill,
  onFill,
  onReset,
}: {
  account: Account
  profile: Profile | undefined
  page: ActivePage
  fill: FillState
  onFill: () => void
  onReset: () => void
}) {
  const { used, limit, longLimit, plan } = account.quota
  const exhausted = used >= limit
  const [offer, setOffer] = useState(false)
  const { seen, markSeen } = usePaywallSeen()
  const showMoney = account.subscription != null || seen || used > 0

  const reason =
    plan === 'free'
      ? exhausted
        ? `It has done ${limit} auto-fills and written ${longLimit} long answers for you. Pro is ${formatCount(PLAN_LIMITS.pro)} form fields and ${PLAN_LONGFORM_LIMITS.pro} long answers a month.`
        : `You have ${Math.max(0, limit - used)} free auto-${plural(Math.max(0, limit - used), 'fill')} left. Pro is ${formatCount(PLAN_LIMITS.pro)} form fields and ${PLAN_LONGFORM_LIMITS.pro} long answers a month.`
      : `You've filled all ${limit} fields your plan covers this month. They reset on the 1st.`

  const ask = () => {
    markSeen()
    setOffer(true)
  }

  const running = fill.status === 'running'
  const done = fill.status === 'done' && fill.plan !== undefined
  const failed = fill.status === 'error'

  return (
    <Screen>
      <PageHeader plan={account.quota.plan} />
      {page.status === 'checking' ? (
        <Body className="px-gutter pt-1">
          <Card className="p-3">
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-7 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-3/5" />
                <Skeleton className="h-2.5 w-2/5" />
              </div>
            </div>
          </Card>
        </Body>
      ) : page.status === 'unavailable' ? (
        <Body>
          <Empty
            mascot="flat"
            title="Nothing to fill here"
            body="This kind of page can't be read. Open a web page with a form and it shows up here."
          />
          <Shortcuts profile={profile} />
        </Body>
      ) : page.fieldCount === 0 && !done ? (
        <Body>
          <Empty
            mascot="think"
            title={`No form on ${page.origin ?? 'this page'}`}
            body="Open a page with a form and it shows up here, with what Fill would do to each question."
          />
          <Shortcuts profile={profile} />
        </Body>
      ) : done && fill.plan ? (
        <Receipt
          page={page}
          fill={fill}
          onReset={onReset}
          onFillAgain={() => {
            onReset()
            if (exhausted) ask()
            else onFill()
          }}
        />
      ) : (
        <Preview
          account={account}
          profile={profile}
          page={page}
          fill={fill}
          running={running}
          failed={failed}
          onFill={exhausted ? ask : onFill}
          onStop={onReset}
          exhaustedNote={
            exhausted && showMoney ? (
              <p className="mt-2 text-xs text-ink-muted">
                {plan === 'free'
                  ? `You've used all ${limit} free auto-fills.`
                  : `You've filled all ${limit} fields your plan covers this month.`}{' '}
                <button
                  type="button"
                  onClick={ask}
                  className="font-medium text-accent hover:underline"
                >
                  {plan === 'free' ? 'Start free trial' : 'See plans'}
                </button>
              </p>
            ) : null
          }
        />
      )}
      {offer && (
        <UpgradeSheet onClose={() => setOffer(false)} mode={offerFor(plan)} reason={reason} />
      )}
    </Screen>
  )
}

/** With no form to talk about, the one useful place to go. */
function Shortcuts({ profile }: { profile: Profile | undefined }) {
  const nav = useNavigation()
  const documents = profile?.sources?.length ?? 0
  const details = profile ? factCount(reconcile(profile)) : 0
  return (
    <Group>
      <Row
        icon={<IconUser className="size-4" />}
        title="Knowledge base"
        detail={
          profile
            ? `${documents} ${plural(documents, 'source')} · ${details} ${plural(details, 'fact')}`
            : undefined
        }
        onClick={() => nav.push({ name: 'knowledge' })}
      />
    </Group>
  )
}

/* ── Before and during a fill ─────────────────────────────────────────────── */

function Preview({
  account,
  profile,
  page,
  fill,
  running,
  failed,
  onFill,
  onStop,
  exhaustedNote,
}: {
  account: Account
  profile: Profile | undefined
  page: ActivePage
  fill: FillState
  running: boolean
  failed: boolean
  onFill: () => void
  onStop: () => void
  exhaustedNote: ReactNode
}) {
  const nav = useNavigation()
  const shortcut = useShortcut()
  const editor = useProfileEditor(profile)
  const facts = profile ? toPatch(editor.draft) : null
  const preview = page.form ? buildPreview(page.form, facts) : null
  const blocked = !account.profileReady
  const displayed = useDisplayedStage(fill)
  const current = Math.max(stageIndex(displayed), 0)

  return (
    <Body className="pb-3">
      <div className="px-gutter pt-1">
        <Card className="p-3">
          <div className="flex items-center gap-2.5">
            {page.origin && <Favicon origin={page.origin} />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{page.origin}</p>
              <p className="tnum truncate text-xs text-ink-dim">
                {running
                  ? (STAGES[current]?.label ?? 'Working') +
                    (fill.stage === 'applying' && fill.stageTotal
                      ? ` · ${fill.stageDone ?? 0} of ${fill.stageTotal}`
                      : '…')
                  : preview
                    ? `${preview.total} ${plural(preview.total, 'question')}${
                        preview.known.length > 0
                          ? ` · ${preview.known.length} from your details`
                          : ''
                      }`
                    : `${page.fieldCount} ${plural(page.fieldCount, 'question')}`}
              </p>
            </div>
          </div>

          {running && (
            <div
              className="mt-3 h-1 overflow-hidden rounded-full bg-surface-muted"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500"
                style={{ width: `${((current + 0.5) / STAGES.length) * 100}%` }}
              />
            </div>
          )}

          <div className="mt-3">
            {blocked ? (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  block
                  onClick={() => nav.push({ name: 'addDocument' })}
                >
                  Add your résumé first
                </Button>
                <p className="mt-2 text-xs leading-snug text-ink-dim">
                  It needs something to answer from. A résumé, a link or a few notes is enough.
                </p>
              </>
            ) : running ? (
              <Button size="lg" block onClick={onStop}>
                Stop
              </Button>
            ) : (
              <>
                <Button variant="primary" size="lg" block onClick={onFill}>
                  <IconMascot className="size-4" />
                  Fill this form
                </Button>
                {exhaustedNote ??
                  (shortcut ? (
                    <p className="mt-2 flex items-center justify-center gap-1.5 text-2xs text-ink-dim">
                      or press <Kbd>{shortcut}</Kbd> on the page
                    </p>
                  ) : null)}
              </>
            )}
          </div>
        </Card>

        {failed && (
          <Note tone="danger" className="mt-2.5">
            {fill.error?.message ?? 'That did not go through. Try again.'}
          </Note>
        )}
      </div>

      {preview && (
        <div
          className={
            running
              ? 'pointer-events-none mt-3 space-y-3 opacity-50 transition-opacity'
              : 'mt-3 space-y-3'
          }
        >
          {preview.known.length > 0 && (
            <Group title="From your details" aside={preview.known.length}>
              {preview.known.map((row) => (
                <Row
                  key={row.fieldId}
                  icon={<Dot tone="positive" />}
                  title={row.label}
                  value={row.value}
                  onClick={() => highlight(row.fieldId)}
                />
              ))}
            </Group>
          )}

          {preview.write.length > 0 && (
            <Group title="It will write" aside={preview.write.length}>
              {preview.write.map((row) => (
                <WriteRow
                  key={row.fieldId}
                  row={row}
                  onSave={(key, value) => {
                    editor.setValue(key, value)
                    editor.commit()
                  }}
                />
              ))}
            </Group>
          )}

          {preview.answered.length > 0 && (
            <Group
              title="Already answered"
              aside={<span>{preview.answered.length} · left alone</span>}
            >
              {preview.answered.map((row) => (
                <Row
                  key={row.fieldId}
                  icon={<Dot tone="dim" />}
                  title={row.label}
                  value={row.value}
                  tone="muted"
                  onClick={() => highlight(row.fieldId)}
                />
              ))}
            </Group>
          )}
        </div>
      )}
    </Body>
  )
}

/**
 * A question the model will answer — with an Add, when it is asking for a detail nothing is
 * saved under. Saving it here is what turns tomorrow's guess into a copy.
 */
function WriteRow({
  row,
  onSave,
}: {
  row: PreviewRow
  onSave: (key: string, value: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const expected = row.expected

  if (editing && expected) {
    const save = () => {
      const trimmed = value.trim()
      setEditing(false)
      if (trimmed) onSave(expected.key, trimmed)
    }
    return (
      <div className="px-3 py-2">
        <p className="mb-1.5 text-xs text-ink-muted">
          {row.label} <span className="text-ink-dim">· saved as {expected.label}</span>
        </p>
        <Input
          autoFocus
          type={expected.type}
          value={value}
          placeholder={expected.placeholder}
          aria-label={expected.label}
          onChange={(event) => setValue(event.currentTarget.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === 'Enter') save()
            if (event.key === 'Escape') setEditing(false)
          }}
        />
      </div>
    )
  }

  return (
    <Row
      icon={<Dot tone="accent" />}
      title={row.label}
      detail={row.kind === 'longtext' ? 'A written answer' : undefined}
      onClick={() => highlight(row.fieldId)}
      trailing={
        expected ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditing(true)}
            className="text-accent"
          >
            Add
          </Button>
        ) : undefined
      }
    />
  )
}

/* ── After a fill ─────────────────────────────────────────────────────────── */

function Receipt({
  page,
  fill,
  onReset,
  onFillAgain,
}: {
  page: ActivePage
  fill: FillState
  onReset: () => void
  onFillAgain: () => void
}) {
  const nav = useNavigation()
  const draft = useReviewDraft(fill.tabId ?? page.tabId)
  const plan = fill.plan
  const result: Result | null = plan ? buildResult(plan, fill.report, draft, page.form) : null
  const [cursor, setCursor] = useState(0)

  if (!result || !plan) return null

  const open = result.open
  const total = page.form?.fields.length ?? result.written + result.blank.length
  const at = Math.min(cursor, Math.max(0, open.length - 1))
  const step = (delta: number) => {
    const next = (at + delta + open.length) % Math.max(1, open.length)
    setCursor(next)
    const row = open[next]
    if (row) highlight(row.fieldId)
  }

  if (plan.fills.length === 0) {
    return (
      <Body>
        <Empty
          mascot="flat"
          title="Nothing was written"
          body="No question here could be answered from what it knows. Add more about yourself and that changes."
          action={
            <div className="flex gap-2">
              <Button onClick={onReset}>Back</Button>
              <Button variant="primary" onClick={() => nav.push({ name: 'knowledge' })}>
                Knowledge base
              </Button>
            </div>
          }
        />
      </Body>
    )
  }

  return (
    <>
      <Body className="pb-3">
        <div className="px-gutter pt-1">
          <Card className="p-3">
            <div className="flex items-center gap-2.5">
              {page.origin && <Favicon origin={page.origin} />}
              <div className="min-w-0 flex-1">
                <p className="tnum truncate text-sm font-medium text-ink">
                  Filled {result.written} of {total} {plural(total, 'question')}
                </p>
                <p className="tnum truncate text-xs text-ink-dim">
                  {open.length > 0
                    ? `${open.length} to check · ${result.stated.length} from your details`
                    : result.check.length > 0
                      ? 'All checked'
                      : `${result.stated.length} from your details`}
                </p>
              </div>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-positive-muted text-positive">
                <IconCheck className="size-4" />
              </span>
            </div>
          </Card>
          {result.refused > 0 && (
            <Note tone="warning" className="mt-2.5">
              {result.refused} {plural(result.refused, 'field')} would not take the value. Nothing
              was written there.
            </Note>
          )}
        </div>

        <div className="mt-3 space-y-3">
          {result.check.length > 0 && (
            <Group title="Check these" aside={open.length > 0 ? `${open.length} to go` : 'done'}>
              {result.check.map((row) => (
                <CheckRow key={row.fieldId} row={row} />
              ))}
            </Group>
          )}

          {result.stated.length > 0 && (
            <Group title="From your details" aside={result.stated.length}>
              {result.stated.map((row) => (
                <Row
                  key={row.fieldId}
                  icon={<Dot tone={row.refused ? 'danger' : 'positive'} />}
                  title={row.label}
                  value={row.refused ? 'not written' : row.value}
                  onClick={() => openOnPage(row.fieldId)}
                  onHover={() => highlight(row.fieldId)}
                />
              ))}
            </Group>
          )}

          {result.blank.length > 0 && (
            <Group title="Left blank" aside={result.blank.length}>
              {result.blank.map((row) => (
                <Row
                  key={row.fieldId}
                  icon={<Dot tone="dim" />}
                  title={row.label}
                  detail={row.reason}
                  tone="muted"
                  onClick={() => highlight(row.fieldId)}
                />
              ))}
            </Group>
          )}
        </div>
      </Body>

      <Footer>
        {open.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <IconButton label="Previous" onClick={() => step(-1)}>
              <IconBack className="size-4" />
            </IconButton>
            <Button
              variant="primary"
              className="min-w-0 flex-1"
              onClick={() => {
                const row = open[at]
                if (row) openOnPage(row.fieldId)
              }}
            >
              <IconSparkle className="size-3.5" />
              Check {at + 1} of {open.length} on the page
            </Button>
            <IconButton label="Next" onClick={() => step(1)}>
              <IconChevronRight className="size-4" />
            </IconButton>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button block onClick={onFillAgain}>
              Fill again
            </Button>
            <Button variant="primary" block onClick={onReset}>
              <IconCheck className="size-4" />
              Done
            </Button>
          </div>
        )}
        <p className="mt-2 text-center text-2xs text-ink-dim">
          Submitting the form is still yours to do.
        </p>
      </Footer>
    </>
  )
}

function CheckRow({ row }: { row: ResultRow }) {
  const settled = row.verdict !== 'open'
  return (
    <Row
      wrap
      icon={<Dot tone={row.refused ? 'danger' : settled ? 'positive' : 'accent'} />}
      title={row.label}
      detail={
        row.refused
          ? 'The page would not take it'
          : row.verdict === 'cleared'
            ? 'You cleared this'
            : row.value
      }
      onClick={() => openOnPage(row.fieldId)}
      onHover={() => highlight(row.fieldId)}
      trailing={
        settled ? (
          <Tag tone="positive">
            <IconCheck className="size-3" />
            done
          </Tag>
        ) : (
          <Tag tone="accent">
            <IconSparkle className="size-3" />
            {row.inferred ? 'I guessed' : 'not sure'}
          </Tag>
        )
      }
    />
  )
}
