import { describe, expect, it, vi } from 'vitest'
import { handler, ISSUER, METADATA, RESOURCE, TOOLS, type Backend, type Identity } from '../supabase/functions/index-mcp/core'

const identity: Identity = { sub: '00000000-0000-4000-a000-000000000001', client_id: '00000000-0000-4000-a000-000000000002', session_id: '00000000-0000-4000-a000-000000000003', aud: ['authenticated', RESOURCE], iss: ISSUER, exp: Math.floor(Date.now() / 1000) + 300 }
const create = { request_id: '00000000-0000-4000-a000-000000000005', title: 'Biology', cards: [{ term: 'Cell', definition: 'Basic unit of life' }, { term: 'Nucleus', definition: 'Holds DNA' }] }
function fixture(claims: Identity | null = identity) {
  const backend: Backend = { authenticate: vi.fn(async () => claims), execute: vi.fn(async () => ({ id: 'new-set', visibility: 'private' })) }
  const serve = handler(backend)
  const call = (name: string, args: unknown, token: string | null = 'test-token') => serve(new Request(RESOURCE, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) }))
  return { backend, serve, call }
}
describe('Index MCP transport and authorization', () => {
  it('advertises OAuth discovery and all four real tool schemas without exposing data', async () => {
    const { serve, backend } = fixture()
    const discovery = await serve(new Request(METADATA))
    expect(await discovery.json()).toMatchObject({ resource: RESOURCE, authorization_servers: [ISSUER] })
    const response = await serve(new Request(RESOURCE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) }))
    expect((await response.json()).result.tools.map((t: any) => t.name)).toEqual(TOOLS.map(t => t.name))
    expect(backend.execute).not.toHaveBeenCalled()
  })
  it('requires OAuth and returns a discoverable challenge', async () => {
    const { call, backend } = fixture()
    const response = await call('find_study_sets', {}, null)
    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toContain(METADATA)
    expect(backend.execute).not.toHaveBeenCalled()
  })
  it.each([
    ['expired', { ...identity, exp: 1 }], ['wrong issuer', { ...identity, iss: 'https://evil.invalid' }],
    ['wrong resource', { ...identity, aud: ['authenticated'] }], ['regular app session', { ...identity, client_id: '' }],
    ['missing session', { ...identity, session_id: '' }], ['invalid token', null],
  ])('rejects %s before database access', async (_, claims) => {
    const { call, backend } = fixture(claims)
    expect((await call('find_study_sets', {})).status).toBe(401)
    expect(backend.execute).not.toHaveBeenCalled()
  })
  it('forwards validated arguments under the user token only', async () => {
    const { call, backend } = fixture()
    const response = await call('create_study_set', create)
    expect((await response.json()).result.structuredContent).toMatchObject({ visibility: 'private' })
    expect(backend.execute).toHaveBeenCalledWith('test-token', 'create_study_set', create)
  })
  it.each([
    ['unknown tool', 'delete_set', {}], ['owner spoof', 'create_study_set', { ...create, owner_id: identity.sub }],
    ['public creation', 'create_study_set', { ...create, visibility: 'public' }], ['empty term', 'create_study_set', { ...create, cards: [{ term: ' ', definition: 'x' }, create.cards[1]] }],
    ['too few cards', 'create_study_set', { ...create, cards: [create.cards[0]] }], ['missing retry key', 'create_study_set', { title: 'Test', cards: create.cards }],
    ['negative page', 'get_study_set', { set_id: identity.sub, offset: -1 }], ['huge page', 'get_study_set', { set_id: identity.sub, limit: 101 }],
    ['no revision', 'edit_study_cards', { request_id: identity.sub, set_id: identity.sub, add: create.cards }],
    ['duplicate removal', 'edit_study_cards', { request_id: identity.sub, set_id: identity.sub, expected_updated_at: '2026-11-05T01:00:00Z', remove_card_ids: ['a','a'] }],
  ])('rejects %s without a mutation', async (_, name, args) => {
    const { call, backend } = fixture()
    expect((await (await call(name, args)).json()).error.code).toBe(-32602)
    expect(backend.execute).not.toHaveBeenCalled()
  })
  it('caps request bodies before parsing or authentication', async () => {
    const { serve, backend } = fixture()
    const response = await serve(new Request(RESOURCE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'a'.repeat(1_048_577) }))
    expect(response.status).toBe(400)
    expect(backend.authenticate).not.toHaveBeenCalled()
  })
  it('does not leak internal database error details', async () => {
    const { call, backend } = fixture()
    vi.mocked(backend.execute).mockRejectedValueOnce(new Error('secret db details'))
    const response = await call('find_study_sets', {})
    expect(await response.text()).not.toContain('secret db details')
  })
})
