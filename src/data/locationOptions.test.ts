/// <reference types="node" />

import assert from 'node:assert/strict'
import test from 'node:test'
import { getLocationLabel, landmarkOptions, podOptions, selectableLocations } from './locationOptions'
import { schoolLocations, unresolvedLocations } from './schoolLocations'
import { findWrittenRoute, resolveRoomId } from './writtenRoutes'

test('the menu retains every selectable database destination exactly once', () => {
  const options = [...landmarkOptions, ...podOptions.flatMap((pod) => pod.locations)]
  const expectedIds = new Set([
    ...schoolLocations.filter((location) => !location.isWaypoint),
    ...unresolvedLocations,
  ].map(({ id }) => id))
  assert.deepEqual(new Set(options.map(({ id }) => id)), expectedIds)
  assert.equal(options.length, expectedIds.size)
  assert.ok(schoolLocations.filter((location) => location.isWaypoint).every(
    (waypoint) => !options.some(({ id }) => id === waypoint.id),
  ))
})

test('common landmarks remain directly available and classrooms are grouped by pod', () => {
  for (const id of ['library', 'cafeteria', 'school-center', 'farmer-gym', 'learning-commons']) {
    assert.ok(landmarkOptions.some((location) => location.id === id))
  }
  for (const [podId, prefix] of [['red', 'R-'], ['orange', 'O-'], ['white', 'W-']]) {
    const pod = podOptions.find(({ id }) => id === podId)!
    const rooms = schoolLocations.filter((location) => location.roomNumber?.startsWith(prefix))
    assert.ok(rooms.length > 0)
    assert.ok(rooms.every((room) => pod.locations.includes(room)))
    assert.ok(pod.locations.every((location) => !('roomNumber' in location) || location.roomNumber?.startsWith(prefix)))
  }
  assert.ok(podOptions.find(({ id }) => id === 'yellow')?.locations.some(({ id }) => id === 'middle-school-languages'))
  assert.ok(podOptions.find(({ id }) => id === 'unassigned')?.locations.some(({ id }) => id === 'grade-1'))
})

test('named classrooms display their room number and retain routing IDs', () => {
  const whitePod = podOptions.find(({ id }) => id === 'white')!
  assert.equal(getLocationLabel(whitePod.locations.find(({ id }) => id === 'w-304')!), 'W-304 — Computer Science Room')
  const from = whitePod.locations.find(({ id }) => id === 'w-301')!.id
  const to = whitePod.locations.find(({ id }) => id === 'w-302')!.id
  assert.ok(findWrittenRoute(from, to))
  assert.equal(resolveRoomId(' W-301 '), from)
  assert.equal(resolveRoomId('w-302'), to)
  assert.equal(findWrittenRoute(to, from), null)
  assert.equal(findWrittenRoute('r-301', to), null)
  assert.equal(selectableLocations.find(({ id }) => id === 'school-center')?.displayName, 'School Center')
})
