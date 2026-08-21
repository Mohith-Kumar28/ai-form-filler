import '../../assets/tailwind.css'

/**
 * The microphone grant, asked for from a place Chrome is willing to ask from.
 *
 * A side panel is not such a place. `navigator.mediaDevices.getUserMedia` there rejects with
 * `NotAllowedError` and no prompt is ever shown, which is why "Allow microphone" in the panel
 * could only ever fail: the button asked again, got the same silent refusal, and reported a
 * denial the user had never been given the chance to make.
 *
 * A top-level extension tab is an ordinary browsing context. The prompt appears, and what it
 * grants is scoped to the extension's origin — the same origin the side panel runs on — so once
 * this page has been through it the panel can record without asking again.
 *
 * The stream is stopped the instant it arrives. The recording happens in the panel; all this
 * page wants is the permission, and holding an open microphone to prove it would light the
 * recording indicator on a page that is not recording anything.
 */

const root = document.getElementById('root')
if (!root) throw new Error('microphone page root element is missing')
const mount: HTMLElement = root

type State = 'idle' | 'asking' | 'granted' | 'blocked' | 'missing'

function render(state: State) {
  const body: Record<State, { title: string; detail: string; action: string | null }> = {
    idle: {
      title: 'Let Fillaform use your microphone',
      detail:
        'Chrome cannot ask for this from the side panel, so it asks here instead. You only have to do this once.',
      action: 'Allow microphone',
    },
    asking: {
      title: 'Waiting for Chrome',
      detail: 'Choose "Allow" in the prompt at the top of the window.',
      action: null,
    },
    granted: {
      title: 'Microphone allowed',
      detail: 'Closing this tab — your voice note is waiting in the side panel.',
      action: null,
    },
    blocked: {
      title: 'Microphone is blocked',
      detail:
        'Chrome is refusing without asking, which means it was blocked here before. Click the icon at the left of the address bar, set Microphone to Allow, then reload this page.',
      action: 'Try again',
    },
    missing: {
      title: 'No microphone found',
      detail: 'Chrome cannot see a recording device. Connect one and try again.',
      action: 'Try again',
    },
  }

  const { title, detail, action } = body[state]

  // The grant is the only thing this page exists to collect, so once it has it the tab is
  // litter. See `dismiss`.
  if (state === 'granted') dismiss()

  mount.innerHTML = ''
  mount.className = 'flex min-h-screen items-center justify-center bg-surface px-6 py-16'

  const card = document.createElement('div')
  card.className =
    'w-full max-w-md rounded-2xl border border-border-muted bg-surface-raised p-8 text-center'

  const heading = document.createElement('h1')
  heading.className = `font-display text-2xl font-bold tracking-[-0.02em] ${
    state === 'granted' ? 'text-positive' : 'text-ink'
  }`
  heading.textContent = title

  const copy = document.createElement('p')
  copy.className = 'mt-3 text-sm leading-relaxed text-ink-muted'
  copy.textContent = detail

  card.append(heading, copy)

  if (action) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className =
      'mt-6 min-h-control rounded-full px-6 text-sm font-bold text-white transition-[filter] hover:brightness-110'
    button.style.background = 'linear-gradient(135deg, var(--color-sparkle), var(--color-accent))'
    button.textContent = action
    button.addEventListener('click', () => void request())
    card.append(button)
  }

  mount.append(card)
}

/** Set once the tab is on its way out, so a second `render('granted')` cannot queue a second timer. */
let closing = false

/**
 * Closes this tab once the permission is in hand.
 *
 * Nothing here needs to report back: the panel watches `PermissionStatus.onchange`, so it has
 * already noticed the grant by the time this runs. Leaving the tab open made the user close a
 * page whose entire job was done, having read a sentence telling them to do it.
 *
 * A beat's delay rather than closing on the spot — a tab that vanishes the instant Chrome's
 * prompt disappears reads as a crash, and the confirmation is worth the glimpse.
 *
 * `chrome.tabs.remove` rather than `window.close()` alone: `window.close()` is only reliable on
 * a window script opened, and this tab was opened by the side panel, not by this page.
 */
function dismiss() {
  if (closing) return
  closing = true

  setTimeout(() => {
    chrome.tabs?.getCurrent((tab) => {
      if (tab?.id !== undefined) chrome.tabs.remove(tab.id)
      else window.close()
    })
  }, 900)
}

async function request() {
  render('asking')
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    // The grant is the whole point; the recording belongs to the panel.
    for (const track of stream.getTracks()) track.stop()
    render('granted')
  } catch (error) {
    const name = (error as { name?: string } | null)?.name
    render(name === 'NotFoundError' || name === 'DevicesNotFoundError' ? 'missing' : 'blocked')
  }
}

/*
  Already granted, so there is nothing to ask. Somebody who reopens this page after allowing
  once should be told they are done, not shown a button that appears to have achieved nothing.
*/
void navigator.permissions
  ?.query({ name: 'microphone' as PermissionName })
  .then((result) => render(result.state === 'granted' ? 'granted' : 'idle'))
  .catch(() => render('idle'))

render('idle')
