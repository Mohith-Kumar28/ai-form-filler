import {
  ApiErrorResponse,
  type ApplyReport,
  type ContentRequest,
  type ContentResponseFor,
  type FillPlan,
  type FillPortEvent,
  type FillPortRequest,
} from '@aff/shared'
import { fillForm } from '../generated/endpoints/fill/fill.js'

/**
 * Orchestrates a fill across three contexts: something asks, the content script reads and
 * writes the page, and the Worker does the thinking.
 *
 * A port rather than one-shot `sendMessage` for two reasons: a fill can take ten seconds or
 * more at tier 3, and an MV3 service worker can be killed mid-flight. The port's disconnect
 * event is the only reliable signal that happened.
 *
 * **Both** callers use it now. The page's launcher used to send a one-shot
 * `overlay/requestFill` instead, and it failed in precisely the way this comment warned about:
 * the worker died mid-fill, nothing reached the page, and the content script — which sets
 * `filling = true` before sending — then treated every later click as "a fill is already
 * running". The launcher went permanently inert while the panel's port fill kept working, which
 * is indistinguishable from the page being unable to fill without the panel open.
 */

/**
 * Where a finished fill is parked, so a panel opened *after* it has something to show.
 *
 * Lives here rather than in `background.ts` because this is the only place that knows a fill
 * has completed. It used to be written from the page path only, so a fill started in the panel,
 * then closed and reopened, came back empty.
 */
export const LAST_FILL_KEY = 'aff:lastFill'

async function askContentScript<R extends ContentRequest>(
  tabId: number,
  request: R,
): Promise<ContentResponseFor<R>> {
  try {
    return (await chrome.tabs.sendMessage(tabId, request)) as ContentResponseFor<R>
  } catch {
    // Thrown when no content script is listening: a chrome:// page, the Web Store, a PDF
    // viewer, or a tab that loaded before the extension was installed.
    throw new ApiErrorResponse(
      'INVALID_REQUEST',
      'This page cannot be filled. Try reloading it, or open a normal web page.',
    )
  }
}

/**
 * The fill flow itself, independent of how it was triggered.
 *
 * Shared by the side panel's port and the overlay launcher's one-click path so there is
 * exactly one implementation — two copies of a three-context orchestration would drift.
 */
export async function runFillFlow(
  tabId: number,
  options: { overwriteExisting: boolean; onlyFieldId?: string },
  emit: (event: FillPortEvent) => void,
  isCancelled: () => boolean = () => false,
): Promise<void> {
  try {
    emit({ type: 'progress', stage: 'detecting', done: 0, total: 1 })

    const detected = await askContentScript<{ type: 'content/detect' }>(tabId, {
      type: 'content/detect',
    })

    if (!detected) {
      throw new ApiErrorResponse('INVALID_REQUEST', 'No fillable form found on this page.')
    }
    if (isCancelled()) return

    /**
     * A single field still carries the whole page's context.
     *
     * `pageContext` and the surrounding field labels are what let the model tell "Name" on a
     * conference signup from "Name" on a reference form, so narrowing to one field means
     * narrowing `fields`, never the schema around it.
     */
    const form = options.onlyFieldId
      ? {
          ...detected,
          fields: detected.fields.filter((field) => field.id === options.onlyFieldId),
        }
      : detected

    if (form.fields.length === 0) {
      throw new ApiErrorResponse('INVALID_REQUEST', 'That field is no longer on the page.')
    }

    emit({ type: 'progress', stage: 'generating', done: 0, total: form.fields.length })

    const plan = (await fillForm({
      form,
      overwriteExisting: options.overwriteExisting,
      /*
       * Scope is about what to detect, not what to charge.
       *
       * It used to carry a billing meaning too — the server exempted `field` from the quota
       * entirely, because the allowance was denominated in whole forms and spending one of fifty on
       * a single input would have been absurd. Now that a field costs a field, the exemption is
       * gone and this is purely a statement about which elements to look at.
       */
      scope: options.onlyFieldId ? 'field' : 'form',
    })) as FillPlan

    if (isCancelled()) return

    emit({
      type: 'progress',
      stage: 'applying',
      done: plan.fills.length,
      total: form.fields.length,
    })

    const report = await askContentScript<{ type: 'content/apply'; plan: FillPlan }>(tabId, {
      type: 'content/apply',
      plan,
    })

    emit({ type: 'complete', plan, report })
  } catch (cause) {
    emit({
      type: 'error',
      error:
        cause instanceof ApiErrorResponse
          ? cause.toJSON()
          : { code: 'INTERNAL', message: cause instanceof Error ? cause.message : 'Fill failed' },
    })
  }
}

export function registerFillPort(): void {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'aff:fill') return

    /**
     * A port opened by a content script names its own tab, and is trusted to name only that.
     *
     * `port.sender.tab` is set by the browser, not by the page, so this cannot be spoofed into
     * filling a different tab. The panel has no `sender.tab` and says which tab it is looking
     * at instead.
     */
    const senderTabId = port.sender?.tab?.id
    const fromPage = senderTabId !== undefined

    let cancelled = false
    port.onDisconnect.addListener(() => {
      cancelled = true
    })

    port.onMessage.addListener((request: FillPortRequest) => {
      if (request.type === 'cancel') {
        cancelled = true
        return
      }
      if (request.type !== 'start') return

      const tabId = senderTabId ?? request.tabId
      if (tabId === undefined) {
        try {
          port.postMessage({
            type: 'error',
            error: { code: 'INVALID_REQUEST', message: 'No tab to fill.' },
          } satisfies FillPortEvent)
        } catch {
          // The asker has already gone. Nothing to report to.
        }
        return
      }

      /**
       * The port's owner hears everything; the *other* surface is told too, if it is listening.
       *
       * Which surface that is depends on who asked. A panel-initiated fill has to reach the page
       * so the launcher can show progress; a page-initiated one has to reach the panel for the
       * same reason. Sending to the port's own owner twice is what would go wrong here: the
       * content script would receive each event once over the port and once as a broadcast, and
       * `tabs.sendMessage` is asynchronous, so the duplicate `complete` could arrive after the
       * port had already disconnected — reported to the user as an interrupted fill.
       */
      const emit = (event: FillPortEvent) => {
        try {
          if (!cancelled) port.postMessage(event)
        } catch {
          cancelled = true
        }

        if (fromPage) {
          // Reaches an open side panel. Nobody listening is the ordinary case.
          void chrome.runtime.sendMessage({ type: 'fill/event', event }).catch(() => undefined)
        } else {
          void chrome.tabs.sendMessage(tabId, { type: 'fill/event', event }).catch(() => undefined)
        }

        if (event.type === 'complete') {
          void chrome.storage.session
            .set({ [LAST_FILL_KEY]: { tabId, plan: event.plan, report: event.report } })
            .catch(() => undefined)
        }
      }

      void (async () => {
        await runFillFlow(
          tabId,
          {
            overwriteExisting: request.overwriteExisting,
            ...(request.onlyFieldId ? { onlyFieldId: request.onlyFieldId } : {}),
          },
          emit,
          () => cancelled,
        )
        if (!cancelled) port.disconnect()
      })()
    })
  })
}

export type { ApplyReport }
