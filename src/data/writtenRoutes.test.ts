/// <reference types="node" />

import assert from 'node:assert/strict'
import test from 'node:test'
import type { SchoolLocation } from './schoolLocations'
import { firstWrittenRoute, validateWrittenConnections } from './writtenRoutes'
import type { WrittenConnection } from './writtenRoutes'

// Synthetic fixtures only; these do not describe routes in the school.
const roomStart: SchoolLocation = {
  id: 'fixture-room-start',
  nodeNumber: 9001,
  displayName: 'Fixture starting room',
  type: 'room',
  buildingId: 'main-school',
  floor: 1,
}

const doorwayDestination: SchoolLocation = {
  id: 'fixture-doorway-destination',
  nodeNumber: 9002,
  displayName: 'Fixture destination doorway',
  type: 'doorway',
  buildingId: 'main-school',
  floor: 1,
}

const lowerLanding: SchoolLocation = {
  id: 'fixture-lower-landing',
  nodeNumber: 9003,
  displayName: 'Fixture lower landing',
  type: 'staircase-landing',
  buildingId: 'main-school',
  floor: 0,
  isWaypoint: true,
}

const upperLanding: SchoolLocation = {
  id: 'fixture-upper-landing',
  nodeNumber: 9004,
  displayName: 'Fixture upper landing',
  type: 'staircase-landing',
  buildingId: 'main-school',
  floor: 1,
  isWaypoint: true,
}

const sameFloorConnection: WrittenConnection = {
  id: 'fixture-room-to-doorway',
  from: roomStart.id,
  to: doorwayDestination.id,
  kind: 'doorway',
  direction: 'Synthetic instruction for a same-floor fixture.',
}

const stairsConnection: WrittenConnection = {
  id: 'fixture-lower-to-upper-landing',
  from: lowerLanding.id,
  to: upperLanding.id,
  kind: 'stairs',
  direction: 'Synthetic instruction between fixture landings.',
}

const measuredConnection: WrittenConnection = {
  id: 'fixture-measured-hallway',
  from: roomStart.id,
  to: doorwayDestination.id,
  kind: 'hallway',
  direction: 'Synthetic instruction for a measured fixture.',
  distanceMeters: 12.5,
  durationSeconds: 8.2,
  connectivityReviewed: true,
  instructionReviewed: true,
}

const pendingConnection: WrittenConnection = {
  id: 'fixture-pending-entrance',
  from: roomStart.id,
  to: doorwayDestination.id,
  kind: 'entrance',
  connectivityReviewed: false,
  instructionReviewed: false,
  sourceReference: 'Synthetic test fixture',
  reviewNote: 'Instruction and connectivity have not been reviewed.',
}

test('a same-floor written connection retains its ID and directed endpoints', () => {
  assert.equal(sameFloorConnection.id, 'fixture-room-to-doorway')
  assert.equal(sameFloorConnection.from, roomStart.id)
  assert.equal(sameFloorConnection.to, doorwayDestination.id)
  assert.equal(sameFloorConnection.kind, 'doorway')
  assert.equal(roomStart.floor, doorwayDestination.floor)
})

test('stairs retain the building and level of each waypoint endpoint', () => {
  assert.equal(stairsConnection.from, lowerLanding.id)
  assert.equal(stairsConnection.to, upperLanding.id)
  assert.equal(stairsConnection.kind, 'stairs')
  assert.equal(lowerLanding.buildingId, 'main-school')
  assert.equal(upperLanding.buildingId, 'main-school')
  assert.equal(lowerLanding.floor, 0)
  assert.equal(upperLanding.floor, 1)
  assert.equal(lowerLanding.isWaypoint, true)
  assert.equal(upperLanding.isWaypoint, true)
  assert.equal(Object.hasOwn(stairsConnection, 'floor'), false)
})

test('unknown measurements remain absent from written connections', () => {
  for (const connection of [sameFloorConnection, stairsConnection, pendingConnection]) {
    assert.equal(connection.distanceMeters, undefined)
    assert.equal(connection.durationSeconds, undefined)
    assert.equal(Object.hasOwn(connection, 'distanceMeters'), false)
    assert.equal(Object.hasOwn(connection, 'durationSeconds'), false)
  }
})

test('confirmed fixture distance and duration use separate unit-specific fields', () => {
  assert.equal(measuredConnection.kind, 'hallway')
  assert.equal(measuredConnection.distanceMeters, 12.5)
  assert.equal(measuredConnection.durationSeconds, 8.2)
})

test('an unreviewed entrance connection can omit its written instruction', () => {
  assert.equal(pendingConnection.kind, 'entrance')
  assert.equal(pendingConnection.direction, undefined)
  assert.equal(Object.hasOwn(pendingConnection, 'direction'), false)
  assert.equal(pendingConnection.connectivityReviewed, false)
  assert.equal(pendingConnection.instructionReviewed, false)
  assert.equal(pendingConnection.sourceReference, 'Synthetic test fixture')
  assert.equal(pendingConnection.reviewNote, 'Instruction and connectivity have not been reviewed.')
})

const fixtureLocations: readonly SchoolLocation[] = [
  roomStart, doorwayDestination, lowerLanding, upperLanding,
]

function reviewedConnection(overrides: Partial<WrittenConnection> = {}): WrittenConnection {
  return {
    ...sameFloorConnection,
    connectivityReviewed: true,
    instructionReviewed: true,
    ...overrides,
  }
}

// Deliberately malformed runtime records stay confined to these tests.
function malformedConnection(overrides: Record<string, unknown>): WrittenConnection {
  return { ...reviewedConnection(), ...overrides } as unknown as WrittenConnection
}

test('reviewed connections are ready without requiring measurements', () => {
  const connection = reviewedConnection()
  const [result] = validateWrittenConnections([connection], fixtureLocations)
  assert.equal(result.status, 'ready')
  assert.deepEqual(result.errors, [])
  assert.deepEqual(result.pendingReasons, [])
  assert.equal(connection.distanceMeters, undefined)
  assert.equal(connection.durationSeconds, undefined)
})

test('all supported passage kinds can be ready, including stairs between waypoint levels', () => {
  const kinds = ['hallway', 'doorway', 'stairs', 'outdoor', 'ramp', 'entrance'] as const
  for (const kind of kinds) {
    const connection = reviewedConnection({
      kind,
      ...(kind === 'stairs' ? { from: lowerLanding.id, to: upperLanding.id } : {}),
    })
    const [result] = validateWrittenConnections([connection], fixtureLocations)
    assert.equal(result.status, 'ready', kind)
  }
})

test('missing or false review flags keep otherwise valid connections pending', () => {
  for (const connectivityReviewed of [undefined, false, true]) {
    for (const instructionReviewed of [undefined, false, true]) {
      if (connectivityReviewed === true && instructionReviewed === true) continue
      const [result] = validateWrittenConnections([
        reviewedConnection({ connectivityReviewed, instructionReviewed }),
      ], fixtureLocations)
      assert.equal(result.status, 'pending')
      assert.deepEqual(result.errors, [])
      assert.ok(result.pendingReasons.length > 0)
    }
  }
})

test('missing passage kind remains pending even when both reviews are complete', () => {
  const [result] = validateWrittenConnections([reviewedConnection({ kind: undefined })], fixtureLocations)
  assert.equal(result.status, 'pending')
  assert.deepEqual(result.errors, [])
  assert.ok(result.pendingReasons.length > 0)
})

test('missing or blank unreviewed directions are pending rather than invented', () => {
  for (const direction of [undefined, '', ' \t\n ']) {
    const connection = reviewedConnection({ direction, instructionReviewed: false })
    const [result] = validateWrittenConnections([connection], fixtureLocations)
    assert.equal(result.status, 'pending')
    assert.deepEqual(result.errors, [])
    assert.ok(result.pendingReasons.length > 0)
    assert.equal(result.connection.direction, direction)
  }
})

test('claiming instructions are reviewed requires nonblank written directions', () => {
  for (const direction of [undefined, '', ' \t\n ']) {
    const [result] = validateWrittenConnections([reviewedConnection({ direction })], fixtureLocations)
    assert.equal(result.status, 'invalid')
    assert.ok(result.errors.length > 0)
  }
})

test('connection IDs must be nonblank strings', () => {
  for (const id of [undefined, null, 42, '', ' \t\n ']) {
    const [result] = validateWrittenConnections([malformedConnection({ id })], fixtureLocations)
    assert.equal(result.status, 'invalid', `id: ${String(id)}`)
    assert.ok(result.errors.length > 0)
  }
})

test('duplicate IDs invalidate every matching record rather than only the later one', () => {
  const connections = [
    reviewedConnection({ id: 'fixture-duplicate' }),
    reviewedConnection({ id: 'fixture-unique' }),
    reviewedConnection({ id: 'fixture-duplicate', from: lowerLanding.id, to: upperLanding.id, kind: 'stairs' }),
  ]
  const results = validateWrittenConnections(connections, fixtureLocations)
  assert.deepEqual(results.map(({ status }) => status), ['invalid', 'ready', 'invalid'])
  assert.ok(results[0].errors.length > 0)
  assert.ok(results[2].errors.length > 0)
})

test('different connection IDs may describe the same directed endpoints', () => {
  const results = validateWrittenConnections([
    reviewedConnection({ id: 'fixture-passage-a' }),
    reviewedConnection({ id: 'fixture-passage-b' }),
  ], fixtureLocations)
  assert.deepEqual(results.map(({ status }) => status), ['ready', 'ready'])
})

test('stable catalogue IDs do not require legacy numeric graph mappings', () => {
  const locations = fixtureLocations.map(({ id, displayName, type, buildingId }) => ({
    id, displayName, type, buildingId,
  }))
  const [result] = validateWrittenConnections([reviewedConnection()], locations)
  assert.equal(result.status, 'ready')
  assert.deepEqual(result.errors, [])
})

test('each endpoint must name a known distinct location', () => {
  for (const field of ['from', 'to']) {
    for (const value of [undefined, null, 42, '', ' \t\n ', 'fixture-unknown-location']) {
      const [result] = validateWrittenConnections([malformedConnection({ [field]: value })], fixtureLocations)
      assert.equal(result.status, 'invalid', `${field}: ${String(value)}`)
      assert.ok(result.errors.length > 0)
    }
  }
  const [selfConnection] = validateWrittenConnections([
    reviewedConnection({ to: roomStart.id }),
  ], fixtureLocations)
  assert.equal(selfConnection.status, 'invalid')
  assert.ok(selfConnection.errors.length > 0)
})

test('provided measurements must be finite positive numbers without coercion', () => {
  for (const field of ['distanceMeters', 'durationSeconds']) {
    for (const value of [0, -1, NaN, Infinity, -Infinity, '12.5', null]) {
      const [result] = validateWrittenConnections([malformedConnection({ [field]: value })], fixtureLocations)
      assert.equal(result.status, 'invalid', `${field}: ${String(value)}`)
      assert.ok(result.errors.length > 0)
    }
    const [validMeasurement] = validateWrittenConnections([
      reviewedConnection({ [field]: 0.1 }),
    ], fixtureLocations)
    assert.equal(validMeasurement.status, 'ready', field)
  }
})

test('provided kinds, review flags and directions reject incorrect runtime types', () => {
  const invalidFields: Record<string, unknown>[] = [
    { kind: 'elevator' }, { kind: '' }, { kind: null }, { kind: 42 },
    { connectivityReviewed: 'true' }, { connectivityReviewed: 1 }, { connectivityReviewed: null },
    { instructionReviewed: 'false' }, { instructionReviewed: 0 }, { instructionReviewed: null },
    { direction: 42 }, { direction: null }, { direction: false },
  ]
  for (const fields of invalidFields) {
    const [result] = validateWrittenConnections([malformedConnection(fields)], fixtureLocations)
    assert.equal(result.status, 'invalid', JSON.stringify(fields))
    assert.ok(result.errors.length > 0)
  }
})

test('structural errors take precedence over outstanding review work', () => {
  const [result] = validateWrittenConnections([
    { ...pendingConnection, to: 'fixture-unknown-location' },
  ], fixtureLocations)
  assert.equal(result.status, 'invalid')
  assert.ok(result.errors.length > 0)
})

test('validation preserves record order and inputs without adding reverse connections', () => {
  const connections = Object.freeze([
    Object.freeze(reviewedConnection({ id: 'fixture-first' })),
    Object.freeze({ ...pendingConnection }),
  ])
  const locations = Object.freeze(fixtureLocations.map((location) => Object.freeze({ ...location })))
  const beforeConnections = structuredClone(connections)
  const beforeLocations = structuredClone(locations)
  const results = validateWrittenConnections(connections, locations)
  assert.equal(results.length, connections.length)
  assert.deepEqual(results.map(({ index }) => index), [0, 1])
  assert.equal(results[0].connection, connections[0])
  assert.equal(results[1].connection, connections[1])
  assert.deepEqual(connections, beforeConnections)
  assert.deepEqual(locations, beforeLocations)
  assert.deepEqual(validateWrittenConnections([], locations), [])
})

test('the existing prototype remains pending and unchanged with the default location catalogue', () => {
  const before = structuredClone(firstWrittenRoute)
  const results = validateWrittenConnections(firstWrittenRoute.connections)
  assert.equal(results.length, firstWrittenRoute.connections.length)
  assert.ok(results.every(({ status }) => status === 'pending'))
  assert.ok(results.every(({ errors, pendingReasons }) => errors.length === 0 && pendingReasons.length > 0))
  assert.ok(firstWrittenRoute.connections.every(
    ({ connectivityReviewed, instructionReviewed }) => connectivityReviewed === false && instructionReviewed === false,
  ))
  assert.deepEqual(firstWrittenRoute, before)
})
