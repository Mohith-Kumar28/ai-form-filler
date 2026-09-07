import { useEffect, useMemo, useRef } from 'react'
import { useGetProfile } from '../../../generated/endpoints/profile/profile.js'
import type { Account, Profile } from '../../../generated/model/index.js'
import { CATALOG, type CatalogField, reconcile } from '../../../lib/fact-catalog.js'
import { plural } from '../../../lib/format.js'
import { useProfileEditor } from '../../../lib/profile-editor.js'
import {
  Body,
  Button,
  Footer,
  Group,
  Header,
  IconButton,
  Screen,
  Spinner,
  Tag,
} from '../components.js'
import { IconBack, IconPlus } from '../icons.js'
import { Mascot } from '../mascot.js'
import { DetailRow } from '../screens/detail-row.js'
import { DocumentForm } from '../screens/document-form.js'
import { DocumentTile, documentMeta, isBusy } from '../screens/documents.js'

/*
  First run, in two steps. Both are the real screens' own parts, not a tour.

  1. Add your résumé — the one document that answers most of a job form. A link or a note works
     too. Skippable, because a gate with no bypass is a trap.
  2. Check the basics — the five details every form asks, seeded from the Google account.

  Nothing here mentions money: the panel says nothing about plans or prices until the first fill
  is attempted, and this flow ends one button short of that moment.
*/

export const SETUP_STEP_COUNT = 2

const BASICS = ['fullName', 'email', 'phone', 'location', 'linkedin']

function Progress({ step }: { step: number }) {
  return (
    <span className="tnum text-xs text-ink-dim">
      {step + 1} of {SETUP_STEP_COUNT}
    </span>
  )
}

function Intro({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-gutter pt-1 pb-3">
      <div className="flex items-start gap-3">
        <Mascot expression="happy" size={32} blink className="shrink-0" />
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-[-0.01em] text-ink">{title}</h1>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">{body}</p>
        </div>
      </div>
    </div>
  )
}

export function Setup({
  account,
  profile,
  step,
  onStep,
  onFinish,
}: {
  account: Account
  profile: Profile | undefined
  step: number
  onStep: (step: number) => void
  onFinish: () => void
}) {
  const index = Math.min(Math.max(0, step), SETUP_STEP_COUNT - 1)

  // Keep the document list live while something is being read.
  useGetProfile({
    query: {
      refetchInterval: (query) => ((query.state.data?.sources ?? []).some(isBusy) ? 2000 : false),
    },
  })

  if (index === 0) {
    return <AddResume profile={profile} onNext={() => onStep(1)} onSkip={() => onStep(1)} />
  }
  return <Basics account={account} profile={profile} onBack={() => onStep(0)} onFinish={onFinish} />
}

function AddResume({
  profile,
  onNext,
  onSkip,
}: {
  profile: Profile | undefined
  onNext: () => void
  onSkip: () => void
}) {
  const sources = profile?.sources ?? []
  const added = sources.length > 0

  return (
    <Screen>
      <Header
        left={<Progress step={0} />}
        right={
          !added && (
            <Button variant="ghost" size="sm" onClick={onSkip}>
              Skip for now
            </Button>
          )
        }
      />
      <Intro
        title="Add your résumé"
        body="It reads it once and answers from it. A link to your site or a few pasted notes work too."
      />
      {added ? (
        <>
          <Body className="pb-3">
            <Group title="Added">
              {sources.map((source) => (
                <div key={source.id}>
                  <div className="flex items-center gap-2.5 px-3 py-2">
                    <DocumentTile source={source} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm text-ink">{source.label}</span>
                        {isBusy(source) ? (
                          <Tag tone="accent">
                            <Spinner className="size-2.5" />
                            Reading
                          </Tag>
                        ) : source.status === 'failed' ? (
                          <Tag tone="danger">Couldn't read</Tag>
                        ) : (
                          <Tag tone="positive">Read</Tag>
                        )}
                      </span>
                      <span className="block truncate text-xs text-ink-dim">
                        {documentMeta(source)}
                      </span>
                    </span>
                  </div>
                  {isBusy(source) && <div className="awaiting h-0.5 w-full" aria-hidden="true" />}
                  {source.status === 'failed' && source.error && (
                    <p className="border-t border-border-muted px-3 py-2 text-xs text-danger">
                      {source.error}
                    </p>
                  )}
                </div>
              ))}
            </Group>
            <div className="px-gutter pt-3">
              <AddAnother />
            </div>
          </Body>
          <Footer>
            <Button variant="primary" size="lg" block onClick={onNext}>
              Next: check the basics
            </Button>
          </Footer>
        </>
      ) : (
        <DocumentForm
          onSaved={() => undefined}
          note="Nothing here is shared. Delete it later and its contents go with it."
        />
      )}
    </Screen>
  )
}

/** After the first document, adding another is a fold-out rather than the whole form again. */
function AddAnother() {
  return (
    <details className="group">
      <summary className="flex h-8 cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-accent [&::-webkit-details-marker]:hidden">
        <IconPlus className="size-3.5" />
        Add another
      </summary>
      <div className="mt-2 flex min-h-[340px] flex-col overflow-hidden rounded-lg border border-border">
        <DocumentForm onSaved={() => undefined} />
      </div>
    </details>
  )
}

function Basics({
  account,
  profile,
  onBack,
  onFinish,
}: {
  account: Account
  profile: Profile | undefined
  onBack: () => void
  onFinish: () => void
}) {
  const editor = useProfileEditor(profile)
  const { draft } = editor
  const fields = useMemo(
    () =>
      BASICS.map((key) => CATALOG.find((field) => field.key === key)).filter(
        Boolean,
      ) as CatalogField[],
    [],
  )

  /*
    Seed name and email from the Google sign-in, once. Two of the five are then already
    answered, and the person sees a list that is mostly done rather than empty. Checked against
    the stored profile, not the draft, which has not hydrated yet in the tick this runs.
  */
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current || !profile) return
    seeded.current = true
    const stored = reconcile(profile).values
    if ((stored.fullName ?? '').trim() === '' && account.name)
      editor.setValue('fullName', account.name)
    if ((stored.email ?? '').trim() === '') editor.setValue('email', account.email)
  }, [profile, account, editor])

  const filled = fields.filter((field) => (draft.values[field.key] ?? '').trim() !== '').length

  return (
    <Screen>
      <Header
        left={
          <span className="flex items-center gap-1">
            <IconButton label="Back" onClick={onBack} className="-ml-1">
              <IconBack className="size-4" />
            </IconButton>
            <Progress step={1} />
          </span>
        }
      />
      <Intro
        title="Check the basics"
        body="The questions every form asks. These are copied in exactly, every time, for free."
      />
      <Body className="pb-3">
        <Group title="Details" aside={`${filled} of ${fields.length}`}>
          {fields.map((field, position) => (
            <DetailRow
              key={field.key}
              autoFocus={position === 0 && filled === 0}
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
        </Group>
        <p className="px-gutter pt-2 text-2xs leading-relaxed text-ink-dim">
          Saved as you go. Everything else a form might ask — address, IDs, work history — can be
          added later in the knowledge base, or the moment a form asks for it.
        </p>
        {editor.status === 'error' && (
          <p className="px-gutter pt-2 text-xs text-danger" role="alert">
            {editor.error}
          </p>
        )}
      </Body>
      <Footer>
        <Button variant="primary" size="lg" block onClick={onFinish}>
          {filled > 0 ? `Done, ${filled} ${plural(filled, 'detail')} saved` : 'Done'}
        </Button>
      </Footer>
    </Screen>
  )
}
