import type { FillPortEvent, FillPortRequest } from '@aff/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The reported bug this file exists for.
 *
 * Filling from the side panel wrote the fields; pressing the launcher on the page did nothing
 * at all. Nothing was wrong with reading or writing the page — the content script does all of
 * that and never needed the panel — the two callers simply reached the service worker by
 * different routes. The panel used a port. The page used a one-shot `sendMessage` whose reply
 * arrives ten seconds later, which is the thing HANDOFF 7.3 exists to warn about: an MV3
 * worker can be torn down mid-request and the sender is never told. The content script sets
 * `filling = true` before asking and clears it only on a terminal event, so one lost reply left
 * the flag stuck and every later click was swallowed by the "already filling" guard.
 *
 * So both callers now open the same port, and these tests pin the two things that makes true:
 * a page-initiated fill targets the sender's own tab, and neither surface is told twice.
 */

const fillForm = vi.fn()
vi.mock('../generated/endpoints/fill/fill.js', () => ({
  fillForm: (...args: unknown[]) => fillForm(...args),
}))

interface FakePort {
  name: string
  sender?: { tab?: { id: number } }
  postMessage: (event: FillPortEvent) => void
  disconnect: () => void
  onMessage: { addListener: (fn: (request: FillPortRequest) => void) => void }
  onDisconnect: { addListener: (fn: () => void) => void }
}

describe('the fill port', () => {
  let connect: ((port: FakePort) => void) | undefined
  let tabMessages: { tabId: number; message: { type: string; event?: FillPortEvent } }[]
  let broadcasts: { type: string; event?: FillPortEvent }[]
  let stored: Record<string, unknown>
  let pageMarkdown: string | null | undefined

  const PLAN = { fills: [{ fieldId: 'f1', value: 'Ada', confidence: 0.9, inferred: false }] }
  const FORM = { origin: 'https://example.com', adapter: 'generic', fields: [{ id: 'f1' }] }
  const MARKDOWN = '# Senior Frontend Engineer\n\nYou will build the things.'

  beforeEach(() => {
    connect = undefined
    tabMessages = []
    broadcasts = []
    stored = {}
    pageMarkdown = MARKDOWN
    fillForm.mockReset()
    fillForm.mockResolvedValue(PLAN)

    vi.stubGlobal('chrome', {
      runtime: {
        onConnect: { addListener: (fn: (port: FakePort) => void) => (connect = fn) },
        sendMessage: async (message: { type: string; event?: FillPortEvent }) => {
          broadcasts.push(message)
        },
      },
      tabs: {
        sendMessage: async (tabId: number, message: { type: string; event?: FillPortEvent }) => {
          tabMessages.push({ tabId, message })
          // The content script's answers, in the order the flow asks for them.
          if (message.type === 'content/detect') return FORM
          if (message.type === 'content/pageContent') return { markdown: pageMarkdown }
          if (message.type === 'content/apply') return { applied: ['f1'], failed: [] }
          return null
        },
      },
      storage: {
        session: {
          set: async (values: Record<string, unknown>) => {
            Object.assign(stored, values)
          },
        },
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  /** Opens a port, runs a fill through it, and returns everything the port was told. */
  async function fill(sender?: { tab?: { id: number } }, request?: Partial<FillPortRequest>) {
    const { registerFillPort } = await import('./fill-port.js')
    registerFillPort()

    const events: FillPortEvent[] = []
    let disconnected = false
    let onMessage: ((request: FillPortRequest) => void) | undefined

    const port: FakePort = {
      name: 'aff:fill',
      ...(sender ? { sender } : {}),
      postMessage: (event) => events.push(event),
      disconnect: () => {
        disconnected = true
      },
      onMessage: { addListener: (fn) => (onMessage = fn) },
      onDisconnect: { addListener: () => undefined },
    }

    connect?.(port)
    onMessage?.({ type: 'start', overwriteExisting: false, ...request } as FillPortRequest)
    // Let the flow's awaits settle: detect, generate, apply.
    await vi.waitFor(() => expect(events.at(-1)?.type).toMatch(/complete|error/))

    return { events, disconnected }
  }

  it('fills the tab the port came from, for a page-initiated fill', async () => {
    const { events } = await fill({ tab: { id: 42 } })

    expect(events.at(-1)?.type).toBe('complete')
    expect(tabMessages.map((entry) => entry.tabId)).toEqual([42, 42, 42])
    expect(tabMessages.map((entry) => entry.message.type)).toEqual([
      'content/detect',
      'content/pageContent',
      'content/apply',
    ])
  })

  it('reads the page once per whole-form fill and sends it to the API', async () => {
    await fill({ tab: { id: 42 } })

    expect(fillForm).toHaveBeenCalledWith(
      expect.objectContaining({
        form: expect.objectContaining({ pageMarkdown: MARKDOWN }),
      }),
    )
  })

  it('completes without page context when the read fails or comes back empty', async () => {
    // The walk can throw (a hostile page), come back empty (an SPA shell), or the message
    // can find no listener. All three are today's behaviour, not an error.
    for (const broken of [undefined, null, '']) {
      pageMarkdown = broken
      const { events } = await fill({ tab: { id: 42 } })

      expect(events.at(-1)?.type).toBe('complete')
      expect(fillForm).toHaveBeenLastCalledWith(
        expect.not.objectContaining({
          form: expect.objectContaining({ pageMarkdown: expect.anything() }),
        }),
      )
    }
  })

  it('does not read the page for a single-field refill', async () => {
    await fill(undefined, { tabId: 7, onlyFieldId: 'f1' })

    expect(tabMessages.some((entry) => entry.message.type === 'content/pageContent')).toBe(false)
    expect(fillForm).toHaveBeenCalledWith(
      expect.not.objectContaining({
        form: expect.objectContaining({ pageMarkdown: expect.anything() }),
      }),
    )
  })

  it('ignores a tab the page asked for, and uses the one it actually came from', async () => {
    // `port.sender.tab` is set by the browser. A page that could name the tab to fill would be
    // a page that could ask us to fill somebody else's.
    await fill({ tab: { id: 42 } }, { tabId: 7 })

    expect(tabMessages.every((entry) => entry.tabId === 42)).toBe(true)
  })

  it('still fills the tab the panel names, since a panel port has no tab of its own', async () => {
    const { events } = await fill(undefined, { tabId: 7 })

    expect(events.at(-1)?.type).toBe('complete')
    expect(tabMessages.every((entry) => entry.tabId === 7)).toBe(true)
  })

  it('refuses a start that names no tab at all', async () => {
    const { events } = await fill()

    expect(events).toEqual([
      { type: 'error', error: { code: 'INVALID_REQUEST', message: 'No tab to fill.' } },
    ])
    expect(tabMessages).toHaveLength(0)
  })

  it('does not also broadcast events to the page that asked for them', async () => {
    /**
     * The duplicate that would misreport a good fill as a broken one. The content script would
     * hear each event once over its port and once as a broadcast, and `tabs.sendMessage` is
     * asynchronous — so the second `complete` could land after the port had disconnected, which
     * the page reads as "the fill was interrupted".
     */
    await fill({ tab: { id: 42 } })

    expect(tabMessages.some((entry) => entry.message.type === 'fill/event')).toBe(false)
    // An open side panel still hears about it.
    expect(broadcasts.filter((message) => message.type === 'fill/event').length).toBeGreaterThan(0)
  })

  it('tells the page about a fill the panel started', async () => {
    // The launcher shows progress for a fill it did not start, which is the mirror of the above.
    await fill(undefined, { tabId: 7 })

    expect(tabMessages.some((entry) => entry.message.type === 'fill/event')).toBe(true)
  })

  it('parks the finished fill whoever asked for it', async () => {
    // Written from the page path only, once — so a fill started in the panel, then closed and
    // reopened, came back to an empty receipt.
    await fill(undefined, { tabId: 7 })

    expect(stored['aff:lastFill']).toMatchObject({ tabId: 7, plan: PLAN })
  })

  it('closes the port when it is finished, which is what tells a dead worker apart', async () => {
    const { disconnected } = await fill({ tab: { id: 42 } })

    expect(disconnected).toBe(true)
  })
})
