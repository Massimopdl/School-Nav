import { findConnectionPath, schoolEdges, schoolLocations } from './schoolLocations'
import type { SchoolEdgeKind, SchoolLocation } from './schoolLocations'

/** One directed connection between destinations or internal navigation points. */
export interface WrittenConnection {
  /** Stable, unique ID; keep it when the wording or measurements change. */
  id: string
  from: SchoolLocation['id']
  to: SchoolLocation['id']
  /** Omit until the passage type is confirmed. Reuse existing graph kinds. */
  kind?: SchoolEdgeKind | 'entrance'
  /** Instruction for from -> to only; omit while the wording is unknown. */
  direction?: string
  /** Add only a confirmed distance in metres; absence means unknown, not 0. */
  distanceMeters?: number
  /** Add only a confirmed duration in seconds; never copy unconfirmed source units. */
  durationSeconds?: number
  /** True only after checking ordinary permitted travel from -> to. */
  connectivityReviewed?: boolean
  /** Separate wording review; absent or false means the instruction is unconfirmed. */
  instructionReviewed?: boolean
  sourceReference?: string
  reviewNote?: string
}

export type WrittenConnectionStatus = 'invalid' | 'pending' | 'ready'

export interface WrittenConnectionValidation {
  /** Original record and position, including when IDs are missing or duplicated. */
  connection: WrittenConnection
  index: number
  status: WrittenConnectionStatus
  /** Broken data that must be corrected before the connection can be used. */
  errors: string[]
  /** Missing details or reviews; incomplete records can remain stored. */
  pendingReasons: string[]
}

const writtenConnectionKinds: readonly NonNullable<WrittenConnection['kind']>[] = [
  'hallway', 'doorway', 'stairs', 'outdoor', 'ramp', 'entrance',
]

/**
 * Check connection records without modifying them or approving school facts.
 * Ready means the required details and declared reviews are present; it does
 * not verify those reviews or depend on a legacy numbered graph mapping.
 * Pass a location catalogue explicitly when checking synthetic test records.
 */
export function validateWrittenConnections(
  connections: readonly WrittenConnection[],
  locations: readonly SchoolLocation[] = schoolLocations,
): WrittenConnectionValidation[] {
  const locationIds = new Set(locations.map(({ id }) => id))
  const idCounts = new Map<string, number>()
  for (const { id } of connections) {
    if (typeof id === 'string' && id.trim()) {
      idCounts.set(id, (idCounts.get(id) ?? 0) + 1)
    }
  }

  return connections.map((connection, index) => {
    const errors: string[] = []
    const pendingReasons: string[] = []

    if (typeof connection.id !== 'string' || !connection.id.trim()) {
      errors.push('Connection ID must be a nonempty string.')
    } else if ((idCounts.get(connection.id) ?? 0) > 1) {
      errors.push(`Connection ID "${connection.id}" is duplicated.`)
    }

    for (const field of ['from', 'to'] as const) {
      const endpoint = connection[field]
      if (typeof endpoint !== 'string' || !endpoint.trim()) {
        errors.push(`${field} must be a nonempty location ID.`)
      } else if (!locationIds.has(endpoint)) {
        errors.push(`${field} references unknown location "${endpoint}".`)
      }
    }
    if (typeof connection.from === 'string' && connection.from === connection.to) {
      errors.push('from and to must refer to different locations.')
    }

    if (connection.kind === undefined) {
      pendingReasons.push('Passage type has not been confirmed.')
    } else if (!writtenConnectionKinds.includes(connection.kind)) {
      errors.push('kind must be hallway, doorway, stairs, outdoor, ramp, or entrance.')
    }

    const hasInstruction = typeof connection.direction === 'string'
      && connection.direction.trim().length > 0
    if (connection.direction !== undefined && typeof connection.direction !== 'string') {
      errors.push('direction must be text when provided.')
    }
    if (!hasInstruction) {
      if (connection.instructionReviewed === true) {
        errors.push('A reviewed instruction must contain nonempty direction text.')
      } else {
        pendingReasons.push('A written instruction is still needed.')
      }
    }

    for (const field of ['connectivityReviewed', 'instructionReviewed'] as const) {
      const reviewed = connection[field]
      if (reviewed !== undefined && typeof reviewed !== 'boolean') {
        errors.push(`${field} must be true or false when provided.`)
      }
      if (reviewed !== true) {
        pendingReasons.push(`${field} has not been confirmed.`)
      }
    }

    for (const field of ['distanceMeters', 'durationSeconds'] as const) {
      const measurement = connection[field]
      if (measurement !== undefined && (
        typeof measurement !== 'number' || !Number.isFinite(measurement) || measurement <= 0
      )) {
        errors.push(`${field} must be a finite positive number when provided.`)
      }
    }

    const status: WrittenConnectionStatus = errors.length > 0
      ? 'invalid'
      : pendingReasons.length > 0 ? 'pending' : 'ready'
    return { connection, index, status, errors, pendingReasons }
  })
}

// Endpoints own their building and floor, including different staircase levels.
// A reverse connection needs its own ID and instruction; never infer it here.
// Connectivity review does not verify measurements. Leave unknown values absent.
// Imported graph estimates, units and conflicting samples remain in schoolGraph.json
// and the legacy SchoolEdge model; they are not confirmed navigation measurements.

// Retain the original record grouping for compatibility, not route lookup.
// Source adjacency does not confirm physical travel or passage type.
export const firstWrittenRoute = {
  from: 'w-301',
  to: 'w-302',
  connections: [
    {
      id: 'w-301-to-w-302',
      from: 'w-301',
      to: 'w-302',
      direction: 'Proposed segment: W-301 → W-302. Verify the corridor path; passing W-302 does not mean entering it.',
      connectivityReviewed: false,
      instructionReviewed: false,
      sourceReference: 'schoolGraph.json: nodes 47 and 48',
      reviewNote: 'Existing prototype; physical connection and wording await confirmation.',
    },
  ] satisfies readonly WrittenConnection[],
} as const

// Small instruction overlay on existing JSON edges. No new physical adjacency
// or timing is asserted. Additional journeys come from adding reviewed records.
export const writtenConnections: readonly WrittenConnection[] = [
  ...firstWrittenRoute.connections,
  {
    id: 'w-302-to-w-303', from: 'w-302', to: 'w-303',
    direction: 'Proposed segment: W-302 → W-303. Verify the corridor path and destination doorway.',
    connectivityReviewed: false, instructionReviewed: false,
    sourceReference: 'schoolGraph.json: nodes 48 and 49',
    reviewNote: 'Listed graph adjacency only; physical travel, passage type and wording await confirmation.',
  },
]

export interface WrittenRouteOptions {
  /** Explicit development preview only; pending records never become approved. */
  allowProposed?: boolean
  connections?: readonly WrittenConnection[]
}

export function findWrittenRoute(fromId: string, toId: string, options: WrittenRouteOptions = {}) {
  if (!schoolLocations.some(({ id }) => id === fromId)
    || !schoolLocations.some(({ id }) => id === toId) || fromId === toId) return null
  const eligible = validateWrittenConnections(options.connections ?? writtenConnections).filter((result) => {
    if (result.status === 'invalid' || (result.status === 'pending' && !options.allowProposed)) return false
    const connection = result.connection
    if (!connection.direction?.trim()) return false
    const from = schoolLocations.find(({ id }) => id === connection.from)!
    const to = schoolLocations.find(({ id }) => id === connection.to)!
    // Unknown/unfinished floor transitions cannot masquerade as complete routes.
    if (from.floor === undefined || to.floor === undefined) return false
    if (from.floor !== to.floor && (result.status !== 'ready'
      || (connection.kind !== 'stairs' && connection.kind !== 'ramp'))) return false
    // Proposed segments must have supporting raw adjacency, not invented links.
    return result.status === 'ready' || schoolEdges.some((edge) =>
      (edge.from === from.id && edge.to === to.id) || (edge.from === to.id && edge.to === from.id))
  })
  // Prefer a wholly approved route even when previewing proposed data.
  const ready = eligible.filter(({ status }) => status === 'ready').map(({ connection }) => connection)
  const route = findConnectionPath(fromId, toId, ready)
    ?? (options.allowProposed ? findConnectionPath(fromId, toId, eligible.map(({ connection }) => connection)) : null)
  if (!route) return null
  return {
    from: fromId, to: toId, path: route.path, connections: route.connections,
    verification: route.connections.every((connection) => ready.includes(connection))
      ? 'approved' as const : 'proposed' as const,
  }
}

/** Match the existing stable ID whether selected or entered as a room number. */
export function resolveRoomId(room: string) {
  const normalizedRoom = room.trim().toLowerCase()
  return schoolLocations.find(
    (location) => !location.isWaypoint && location.roomNumber?.toLowerCase() === normalizedRoom,
  )?.id
}
