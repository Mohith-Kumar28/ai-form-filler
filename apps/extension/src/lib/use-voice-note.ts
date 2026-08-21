import { useEffect, useMemo, useRef, useState } from 'react'

export type MicPermission = 'unknown' | 'granted' | 'denied'

export interface VoiceNote {
  recording: boolean
  /** Elapsed seconds of the take in progress, or of the take just finished. */
  seconds: number
  blob: Blob | null
  /** An object URL for `blob`, revoked for you. `null` when there is nothing to play. */
  playbackUrl: string | null
  /** What to tell the user, when recording could not start. */
  denied: string | null
  permission: MicPermission
  start: () => Promise<void>
  stop: () => void
  /** Opens the extension page where Chrome will actually show the microphone prompt. */
  requestPermission: () => void
  toFile: (label: string) => File | null
}

/**
 * Recording a voice note, once, for both places that offer it.
 *
 * The panel's "Add a source" screen and the first-run flow both take a voice note, and the awkward
 * part is not the UI — it is everything around `MediaRecorder`: a timer that has to be cleared, a
 * stream whose tracks leak if they are not stopped, an object URL that has to be revoked, and the
 * side-panel permission trap below. Two copies of that is two chances to leave a microphone light
 * on after the panel closes.
 */
export function useVoiceNote(): VoiceNote {
  const [recording, setRecording] = useState(false)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [denied, setDenied] = useState<string | null>(null)
  const [permission, setPermission] = useState<MicPermission>('unknown')

  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])

  useEffect(() => {
    if (!recording) return
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [recording])

  // The stream outlives React unless something stops it: a panel closed mid-recording leaves the
  // tab's microphone indicator on, which is alarming and entirely our fault.
  useEffect(
    () => () => {
      for (const track of recorder.current?.stream.getTracks() ?? []) track.stop()
    },
    [],
  )

  useEffect(() => {
    if (!navigator.permissions?.query) return
    navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((result) => {
        setPermission(result.state as 'granted' | 'denied')
        // `onchange` is what lets the panel notice a grant made in the permission tab without
        // being closed and reopened.
        result.onchange = () => setPermission(result.state as 'granted' | 'denied')
      })
      .catch(() => undefined)
  }, [])

  const playbackUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(() => {
    if (!playbackUrl) return
    return () => URL.revokeObjectURL(playbackUrl)
  }, [playbackUrl])

  return {
    recording,
    seconds,
    blob,
    playbackUrl,
    denied,
    permission,

    async start() {
      setDenied(null)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        setPermission('granted')
        const media = new MediaRecorder(stream)
        chunks.current = []
        media.ondataavailable = (event) => chunks.current.push(event.data)
        media.onstop = () => {
          setBlob(new Blob(chunks.current, { type: 'audio/webm' }))
          for (const track of stream.getTracks()) track.stop()
        }
        media.start()
        recorder.current = media
        setSeconds(0)
        setBlob(null)
        setRecording(true)
      } catch (error) {
        // Worth telling apart: "no microphone" is not something a permission tab can fix.
        const name = (error as { name?: string } | null)?.name
        setPermission('denied')
        setDenied(
          name === 'NotFoundError' || name === 'DevicesNotFoundError'
            ? 'Chrome cannot find a microphone. Connect one and try again.'
            : 'Chrome will not let the side panel ask for your microphone. Grant it once here.',
        )
      }
    },

    stop() {
      recorder.current?.stop()
      setRecording(false)
    },

    /**
     * The side panel cannot show the microphone prompt, so the asking happens in a tab.
     *
     * `getUserMedia` in a side panel rejects with `NotAllowedError` and never prompts — which is
     * exactly the reported symptom: it says permission is missing and then offers no way to give
     * it. "Allow microphone" used to call `start()` again, so it asked Chrome the same question
     * Chrome had already declined to put to the user, and failed identically.
     *
     * `microphone.html` is an ordinary top-level extension page, where the prompt does appear. The
     * grant is scoped to the extension's origin, which the panel shares, so recording works here
     * the moment that tab is done.
     */
    requestPermission() {
      void chrome.tabs.create({ url: chrome.runtime.getURL('microphone.html') })
    },

    toFile(label) {
      if (!blob) return null
      return new File([blob], `${label.trim() || 'Voice note'}.webm`, { type: 'audio/webm' })
    },
  }
}
