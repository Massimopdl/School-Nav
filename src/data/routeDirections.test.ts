/// <reference types="node" />
import assert from 'node:assert/strict'
import test from 'node:test'
import { findDirections, formatSeconds } from './routeDirections'
import { findWrittenRoute, writtenConnections } from './writtenRoutes'
import type { WrittenConnection } from './writtenRoutes'
import { findRoute } from './schoolLocations'

// Synthetic approval exercises mechanics; real records remain pending.
const fixtures: readonly WrittenConnection[] = writtenConnections.map((c, i) => ({
  ...c, kind: 'hallway', direction: `Fixture instruction ${i + 1}`,
  connectivityReviewed: true, instructionReviewed: true,
}))

test('W-301 to W-303 is an ordered proposal, unavailable as approved navigation', () => {
  assert.deepEqual(findDirections('w-301', 'w-303'), { status: 'no-route' })
  const result = findDirections('w-301', 'w-303', { allowProposed: true })
  assert.ok(result.status === 'found' && result.verification === 'proposed')
  assert.deepEqual(result.connectionIds, ['w-301-to-w-302', 'w-302-to-w-303'])
  assert.deepEqual(result.steps, writtenConnections.map(c => c.direction))
  assert.equal(result.totalSeconds, undefined)
  assert.ok(result.steps.every(step => !step.includes('Enter W-302')))
})

test('approved records route in travel order, not input order', () => {
  const result = findDirections('w-301', 'w-303', { connections: [...fixtures].reverse() })
  assert.ok(result.status === 'found' && result.verification === 'approved')
  assert.deepEqual(result.steps, ['Fixture instruction 1', 'Fixture instruction 2'])
  const route = findWrittenRoute('w-301', 'w-303', { connections: fixtures })!
  assert.deepEqual(route.path, ['w-301', 'w-302', 'w-303'])
  assert.equal(route.connections[0], fixtures[0])
})

test('removing either segment removes the route; no old fixed-pair fallback survives', () => {
  for (const removed of fixtures) {
    assert.deepEqual(findDirections('w-301', 'w-303', {
      connections: fixtures.filter(c => c.id !== removed.id),
    }), { status: 'no-route' })
  }
  assert.deepEqual(findDirections('w-301', 'w-302', { connections: [] }), { status: 'no-route' })
})

test('additional connection data supplies an alternative path without routing changes', () => {
  const alternative = { ...fixtures[0], id: 'fixture-alternative', to: 'w-303', direction: 'Alternative fixture' }
  const result = findDirections('w-301', 'w-303', { connections: [...fixtures, alternative] })
  assert.ok(result.status === 'found')
  assert.deepEqual(result.connectionIds, ['fixture-alternative'])
})

test('reverse travel requires separate directed records', () => {
  assert.equal(findDirections('w-303', 'w-301', { connections: fixtures, allowProposed: true }).status, 'no-route')
  const reverse = fixtures.map(c => ({ ...c, id: `${c.id}-reverse`, from: c.to, to: c.from }))
  assert.equal(findDirections('w-303', 'w-301', { connections: reverse }).status, 'found')
})

test('pending, invalid and duplicate records cannot become approved directions', () => {
  for (const bad of [
    { ...fixtures[0], connectivityReviewed: false },
    { ...fixtures[0], direction: '' },
    { ...fixtures[0], durationSeconds: -1 },
  ]) assert.equal(findDirections('w-301', 'w-303', { connections: [bad, fixtures[1]] }).status, 'no-route')
  assert.equal(findDirections('w-301', 'w-303', {
    connections: [fixtures[0], fixtures[0], fixtures[1]], allowProposed: true,
  }).status, 'no-route')
})

test('preview rejects missing instructions, invalid measurements and invented adjacency', () => {
  for (const bad of [
    { ...writtenConnections[0], direction: '' },
    { ...writtenConnections[0], durationSeconds: NaN },
    { ...writtenConnections[0], from: 'r-301', to: 'w-302' },
  ]) assert.notEqual(findDirections(bad.from, 'w-303', {
    connections: [bad, writtenConnections[1]], allowProposed: true,
  }).status, 'found')
})

test('unknown IDs are checked before same-place and unmapped classifications', () => {
  for (const pair of [['unknown', 'unknown'], ['unknown', 'w-301'], ['', 'w-301']]) {
    assert.deepEqual(findDirections(pair[0], pair[1]), { status: 'unknown-location' })
  }
  assert.equal(findRoute('unknown', 'unknown'), null)
  assert.deepEqual(findDirections('w-301', 'w-301'), { status: 'same-place' })
  assert.deepEqual(findDirections('library', 'w-301'), { status: 'not-mapped', locationIds: ['library'] })
  assert.equal(findDirections('correen-hester-courtyard', 'w-301').status, 'no-route')
})

test('unfinished or unknown floor transitions are excluded even from preview', () => {
  for (const kind of [undefined, 'hallway', 'stairs'] as const) {
    assert.notEqual(findDirections('w-301', 'mellon-library', {
      connections: [{ ...writtenConnections[0], to: 'mellon-library', kind }], allowProposed: true,
    }).status, 'found')
  }
  assert.equal(findDirections('w-301', 'mellon-library', {
    connections: [{ ...fixtures[0], to: 'mellon-library' }],
  }).status, 'no-route')
  assert.equal(findDirections('w-301', 'main-entrance', {
    connections: [{ ...fixtures[0], to: 'main-entrance' }],
  }).status, 'no-route')
  assert.equal(findDirections('w-301', 'mellon-library', {
    connections: [{ ...fixtures[0], to: 'mellon-library', kind: 'stairs', direction: 'Fixture: descend to floor 2.' }],
  }).status, 'found')
})

test('reviewed data can extend to a known destination without a legacy numeric node', () => {
  const extra = { ...fixtures[1], id: 'fixture-extra', from: 'w-303', to: 'w-310' }
  assert.equal(findDirections('w-301', 'w-310', { connections: [...fixtures, extra] }).status, 'found')
})

test('preview prefers a longer approved path over an eligible pending shortcut', () => {
  const approved = [
    { ...fixtures[0], id: 'fixture-detour-a', to: 'w-304' },
    { ...fixtures[0], id: 'fixture-detour-b', from: 'w-304' },
    fixtures[1],
  ]
  const result = findDirections('w-301', 'w-303', {
    connections: [...approved, writtenConnections[0]], allowProposed: true,
  })
  assert.ok(result.status === 'found' && result.verification === 'approved')
  assert.deepEqual(result.connectionIds, approved.map(c => c.id))
})

test('only complete supplied durations are displayed, never the internal search cost', () => {
  const timed = fixtures.map(c => ({ ...c, durationSeconds: 7 }))
  const result = findDirections('w-301', 'w-303', { connections: timed })
  assert.ok(result.status === 'found')
  assert.equal(result.totalSeconds, 14)
  const partial = findDirections('w-301', 'w-303', { connections: [timed[0], fixtures[1]] })
  assert.ok(partial.status === 'found')
  assert.equal(partial.totalSeconds, undefined)
  assert.equal(formatSeconds(65), '1m 05s')
})

test('legacy graph routing retains its classroom path and placeholder weights', () => {
  const route = findRoute('w-301', 'w-303')!
  assert.deepEqual(route.path, ['w-301', 'w-302', 'w-303'])
  assert.equal(route.totalSeconds, 10)
})
