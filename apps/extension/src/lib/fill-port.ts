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
 * Orchestrates a fill across three contexts: the side panel asks, the content script reads
 * and writes the page, and the Worker does the thinking.
 *
 * A port rather than one-shot `sendMessage` for two reasons: a fill can take ten seconds or
 * more at tier 3, and an MV3 service worker can be killed mid-flight. The port's disconnect
 * event is the only reliable signal that happened.
 */

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
  options: { overwriteExisting: boolean },
  emit: (event: FillPortEvent) => void,
  isCancelled: () => boolean = () => false,
): Promise<void> {
  try {
    emit({ type: 'progress', stage: 'detecting', done: 0, total: 1 })

    const form = await askContentScript<{ type: 'content/detect' }>(tabId, {
      type: 'content/detect',
    })

    if (!form) {
      throw new ApiErrorResponse('INVALID_REQUEST', 'No fillable form found on this page.')
    }
    if (isCancelled()) return

    emit({ type: 'progress', stage: 'generating', done: 0, total: form.fields.length })

    const plan = (await fillForm({
      form,
      overwriteExisting: options.overwriteExisting,
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

    let cancelled = false
    port.onDisconnect.addListener(() => {
      cancelled = true
    })

    const emit = (event: FillPortEvent) => {
      // The panel can close mid-fill, which disconnects the port and makes postMessage
      // throw. That is a normal outcome, not an error worth surfacing.
      try {
        if (!cancelled) port.postMessage(event)
      } catch {
        cancelled = true
      }
    }

    port.onMessage.addListener((request: FillPortRequest) => {
      if (request.type === 'cancel') {
        cancelled = true
        return
      }
      if (request.type !== 'start') return

      void (async () => {
        await runFillFlow(
          request.tabId,
          { overwriteExisting: request.overwriteExisting },
          emit,
          () => cancelled,
        )
        if (!cancelled) port.disconnect()
      })()
    })
  })
}

export type { ApplyReport }
