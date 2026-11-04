import { useSyncExternalStore } from 'react'

export type Sound = 'flip' | 'correct' | 'wrong' | 'match' | 'complete' | 'tap'
const KEY = 'index.sounds'
let enabled = true
try {
  enabled = localStorage.getItem(KEY) !== 'off'
} catch {}
const listeners = new Set<() => void>()
let context: AudioContext | null = null
let output: GainNode | null = null
let lastPlayed = 0

export function useSounds() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => enabled,
  )
}

export function setSounds(value: boolean) {
  enabled = value
  try {
    localStorage.setItem(KEY, value ? 'on' : 'off')
  } catch {}
  if (context && output) output.gain.setValueAtTime(value ? 0.18 : 0, context.currentTime)
  listeners.forEach((listener) => listener())
}

export function unlockAudio() {
  if (!enabled) return
  try {
    if (!context || context.state === 'closed') {
      context = new AudioContext()
      output = context.createGain()
      output.gain.value = 0.18
      output.connect(context.destination)
    }
    if (context.state === 'suspended') void context.resume().catch(() => {})
  } catch {
    /* Audio is optional when the browser or device blocks it. */
  }
}

export function installAudio() {
  document.addEventListener('pointerdown', unlockAudio, { passive: true })
  document.addEventListener('keydown', unlockAudio)
  window.addEventListener('storage', (event) => {
    if (event.key === KEY) {
      enabled = event.newValue !== 'off'
      if (context && output) output.gain.setValueAtTime(enabled ? 0.18 : 0, context.currentTime)
      listeners.forEach((listener) => listener())
    }
  })
}

function note(
  ctx: AudioContext,
  frequency: number,
  offset: number,
  duration = 0.16,
  type: OscillatorType = 'sine',
) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  const start = ctx.currentTime + offset
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(0.32, start + 0.006)
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
  oscillator.connect(gain)
  gain.connect(output!)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.01)
  oscillator.onended = () => {
    oscillator.disconnect()
    gain.disconnect()
  }
}

function paper(ctx: AudioContext) {
  const duration = 0.055
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
  const source = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  source.buffer = buffer
  filter.type = 'bandpass'
  filter.frequency.value = 1700
  filter.Q.value = 0.6
  gain.gain.value = 0.35
  source.connect(filter)
  filter.connect(gain)
  gain.connect(output!)
  source.start()
  source.onended = () => {
    source.disconnect()
    filter.disconnect()
    gain.disconnect()
  }
}

export function playSound(sound: Sound) {
  if (!enabled || document.visibilityState === 'hidden') return
  unlockAudio()
  if (!context || !output || context.state !== 'running') return
  const now = performance.now()
  if (now - lastPlayed < 45) return
  lastPlayed = now
  try {
    if (sound === 'flip') paper(context)
    else if (sound === 'tap') note(context, 640, 0, 0.055)
    else if (sound === 'wrong') {
      note(context, 196, 0, 0.12, 'triangle')
      note(context, 164.81, 0.07, 0.14, 'triangle')
    } else {
      const frequencies =
        sound === 'complete'
          ? [523.25, 659.25, 783.99, 1046.5]
          : sound === 'match'
            ? [783.99, 1046.5]
            : [659.25, 880]
      frequencies.forEach((frequency, i) =>
        note(context!, frequency, i * 0.065, sound === 'complete' ? 0.28 : 0.18),
      )
    }
  } catch {
    /* A sound must never interrupt studying. */
  }
}
