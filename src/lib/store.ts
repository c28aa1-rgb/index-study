import { supabase } from './supabase'
import type { ProgressMap, StudySet } from './types'

// One API, two backends: Supabase when configured, this browser otherwise.

const LS_SETS = 'di.sets'
const LS_PROG = 'di.progress.'

function checkedSets(value: unknown): StudySet[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (s) =>
        !s ||
        typeof s.id !== 'string' ||
        typeof s.title !== 'string' ||
        typeof s.description !== 'string' ||
        typeof s.author_name !== 'string' ||
        typeof s.created_at !== 'string' ||
        typeof s.updated_at !== 'string' ||
        !['private', 'unlisted', 'public'].includes(s.visibility) ||
        !Array.isArray(s.cards) ||
        s.cards.length > 1000 ||
        s.cards.some(
          (c: Record<string, unknown>) =>
            !c || typeof c.id !== 'string' || typeof c.term !== 'string' || typeof c.definition !== 'string',
        ),
    )
  )
    throw new Error('A saved set has an unreadable format. Restore it from a shared copy or backup.')
  return value as StudySet[]
}

const readLocal = (): StudySet[] => {
  try {
    return checkedSets(JSON.parse(localStorage.getItem(LS_SETS) || '[]'))
  } catch {
    throw new Error(
      'Your saved library couldn’t be read. Keep this browser’s storage intact and restore from a backup.',
    )
  }
}
const writeLocal = (sets: StudySet[]) => localStorage.setItem(LS_SETS, JSON.stringify(sets))

async function uidOrNull() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

export async function mySets(): Promise<StudySet[]> {
  if (!supabase) return readLocal().sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  const me = await uidOrNull()
  if (!me) return []
  const { data, error } = await supabase
    .from('study_sets')
    .select('*')
    .eq('owner_id', me)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return checkedSets(data)
}

export async function publicSets(q = ''): Promise<StudySet[]> {
  if (!supabase) return []
  let query = supabase
    .from('study_sets')
    .select('*')
    .eq('visibility', 'public')
    .order('updated_at', { ascending: false })
    .limit(60)
  if (q.trim()) query = query.ilike('title', `%${q.trim()}%`)
  const { data, error } = await query
  if (error) throw error
  return checkedSets(data)
}

export async function getSet(id: string): Promise<StudySet | null> {
  if (!supabase) return readLocal().find((s) => s.id === id) ?? null
  const { data, error } = await supabase.from('study_sets').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? checkedSets([data])[0] : null
}

export async function saveSet(set: StudySet, expectedUpdatedAt?: string): Promise<StudySet> {
  if (!set.title.trim() || set.title.length > 200)
    throw new Error('Use a title between 1 and 200 characters.')
  if (set.description.length > 5000) throw new Error('Keep the description under 5,000 characters.')
  if (set.cards.length < 2 || set.cards.length > 1000)
    throw new Error('A set needs between 2 and 1,000 cards.')
  if (
    set.cards.some(
      (c) => !c.term.trim() || !c.definition.trim() || c.term.length > 20_000 || c.definition.length > 20_000,
    )
  )
    throw new Error('Add a term and definition to every card. Keep each side under 20,000 characters.')
  const next = { ...set, updated_at: new Date().toISOString() }
  if (!supabase) {
    const all = readLocal().filter((s) => s.id !== set.id)
    writeLocal([next, ...all])
    return next
  }
  const me = await uidOrNull()
  if (!me) throw new Error('Sign in to save sets.')
  const values = { ...next, owner_id: me }
  const query = expectedUpdatedAt
    ? supabase.from('study_sets').update(values).eq('id', set.id).eq('owner_id', me).eq('updated_at', expectedUpdatedAt)
    : supabase.from('study_sets').insert(values)
  const { data, error } = await query.select().maybeSingle()
  if (error) throw error
  if (!data) throw new Error('This set changed while you were editing. Your draft is still here. Open the current set in another tab and compare before saving again.')
  return data as StudySet
}

export async function deleteSet(id: string) {
  if (!supabase) {
    writeLocal(readLocal().filter((s) => s.id !== id))
    localStorage.removeItem(LS_PROG + id)
    localStorage.removeItem(LS_PROG + id + '.updated')
    localStorage.removeItem('di.stars.' + id)
    return
  }
  const { error } = await supabase.from('study_sets').delete().eq('id', id)
  if (error) throw error
  const me = await uidOrNull()
  if (me) {
    const key = LS_PROG + me + '.' + id
    clearTimeout(pending[key])
    delete pending[key]
    localStorage.removeItem(key)
    localStorage.removeItem(key + '.updated')
  }
}

export async function getProgress(setId: string): Promise<ProgressMap> {
  const me = await uidOrNull()
  const key = LS_PROG + (me ? me + '.' : '') + setId
  let cached: ProgressMap = {}
  try {
    cached = JSON.parse(localStorage.getItem(key) || '{}')
  } catch {}
  if (supabase && me) {
    const { data, error } = await supabase
      .from('study_progress')
      .select('data, updated_at')
      .eq('user_id', me)
      .eq('set_id', setId)
      .maybeSingle()
    if (error) throw new Error('Couldn’t load your progress. Check your connection and try again.')
    const localTime = Number(localStorage.getItem(key + '.updated') || '0')
    if (!data || localTime > new Date(data.updated_at).getTime()) return cached
    return (data.data as ProgressMap) ?? {}
  }
  return cached
}

export async function getStars(setId: string): Promise<string[]> {
  if (!supabase) return JSON.parse(localStorage.getItem('di.stars.' + setId) || '[]')
  const me = await uidOrNull()
  if (!me) return []
  const { data, error } = await supabase
    .from('study_stars')
    .select('card_id')
    .eq('user_id', me)
    .eq('set_id', setId)
  if (error) throw new Error('Couldn’t load your starred cards. Check your connection and try again.')
  return data.map((row) => row.card_id as string)
}

export async function saveStar(setId: string, cardId: string, starred: boolean) {
  if (!supabase) {
    const stars = await getStars(setId)
    localStorage.setItem(
      'di.stars.' + setId,
      JSON.stringify(starred ? [...new Set([...stars, cardId])] : stars.filter((id) => id !== cardId)),
    )
    return
  }
  const me = await uidOrNull()
  if (!me) throw new Error('Sign in to star cards.')
  const query = supabase.from('study_stars')
  const { error } = starred
    ? await query.upsert({ user_id: me, set_id: setId, card_id: cardId }, { ignoreDuplicates: true })
    : await query.delete().eq('user_id', me).eq('set_id', setId).eq('card_id', cardId)
  if (error) throw new Error('Couldn’t save this star. Check your connection and try again.')
}

let pending: Record<string, ReturnType<typeof setTimeout>> = {}

// Debounced so rapid answers in Learn don't hammer the DB.
export async function saveProgress(setId: string, map: ProgressMap) {
  const me = await uidOrNull()
  const key = LS_PROG + (me ? me + '.' : '') + setId
  const updatedAt = new Date().toISOString()
  try {
    localStorage.setItem(key, JSON.stringify(map))
    localStorage.setItem(key + '.updated', String(new Date(updatedAt).getTime()))
  } catch {
    throw new Error('Progress couldn’t be saved in this browser. Storage may be full.')
  }
  if (!supabase || !me) return
  clearTimeout(pending[key])
  pending[key] = setTimeout(async () => {
    delete pending[key]
    if ((await uidOrNull()) !== me) return
    const { error } = await supabase!
      .from('study_progress')
      .upsert({ user_id: me, set_id: setId, data: map, updated_at: updatedAt })
    if (error) window.dispatchEvent(new CustomEvent('di.sync-error'))
  }, 800)
}
