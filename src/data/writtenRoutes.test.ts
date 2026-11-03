/// <reference types="node" />

import assert from 'node:assert/strict'
import test from 'node:test'
import type { SchoolLocation } from './schoolLocations'
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
