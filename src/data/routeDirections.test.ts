/// <reference types="node" />

import assert from 'node:assert/strict'
import test from 'node:test'
import { selectableLocations } from './locationOptions'
import { findDirections, formatSeconds, routableLocationIds } from './routeDirections'

// No connections are recorded for the courtyard yet (see schoolGraph.json dataIssues).
const KNOWN_ISOLATED = new Set(['correen-hester-courtyard'])

test('at least three different routes produce generated directions', () => {
  for (const [from, to] of [
    ['farmer-gym', 'cafeteria'],
    ['w-304', 'main-entrance'],
    ['learning-commons', 'mellon-library'],
  ]) {
    const directions = findDirections(from, to)
    assert.equal(directions.status, 'found', `${from} -> ${to}`)
    if (directions.status !== 'found') continue
    assert.equal(directions.source, 'graph')
    assert.ok(directions.steps.length > 0)
    assert.ok(directions.totalSeconds! > 0)
  }
})

test('every selectable mapped location can reach every other one', () => {
  const routable = selectableLocations
    .map(({ id }) => id)
    .filter((id) => routableLocationIds.has(id) && !KNOWN_ISOLATED.has(id))
  assert.ok(routable.length > 3)
  const missing = routable.flatMap((from) => routable
    .filter((to) => to !== from && findDirections(from, to).status !== 'found')
    .map((to) => `${from} -> ${to}`))
  assert.deepEqual(missing, [])
})

test('the hand-written route keeps its wording; its reverse is generated', () => {
  const written = findDirections('w-301', 'w-302')
  assert.ok(written.status === 'found' && written.source === 'written')
  assert.match(written.steps[0], /^Leave W-301/)
  const reverse = findDirections('w-302', 'w-301')
  assert.ok(reverse.status === 'found' && reverse.source === 'graph')
})

test('unmapped, isolated, identical and unknown locations explain why there is no route', () => {
  assert.deepEqual(findDirections('r-301', 'w-302'), { status: 'not-mapped', locationIds: ['r-301'] })
  assert.deepEqual(findDirections('library', 'farmer-gym'), { status: 'not-mapped', locationIds: ['library'] })
  assert.deepEqual(findDirections('correen-hester-courtyard', 'farmer-gym'), { status: 'no-route' })
  assert.deepEqual(findDirections('w-301', 'w-301'), { status: 'same-place' })
  assert.deepEqual(findDirections('', 'w-301'), { status: 'unknown-location' })
})

test('times are formatted like the Java planner', () => {
  assert.equal(formatSeconds(12.4), '12s')
  assert.equal(formatSeconds(65), '1m 05s')
})
