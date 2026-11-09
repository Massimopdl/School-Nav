import { schoolLocations } from './schoolLocations'
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

// Preserve the existing one-way prototype and wording. Source adjacency and
// matching floors do not confirm its physical sequence or written instruction.
export const firstWrittenRoute = {
  from: 'w-301',
  to: 'w-302',
  connections: [
    {
      id: 'w-301-to-w-302',
      from: 'w-301',
      to: 'w-302',
      direction: 'Leave W-301 and follow the hallway to W-302 on the same floor. Enter W-302.',
      connectivityReviewed: false,
      instructionReviewed: false,
      sourceReference: 'schoolGraph.json: nodes 47 and 48',
      reviewNote: 'Existing prototype; physical connection and wording await confirmation.',
    },
  ] satisfies readonly WrittenConnection[],
} as const

export function findWrittenRoute(fromId: string, toId: string) {
  return fromId === firstWrittenRoute.from && toId === firstWrittenRoute.to
    ? firstWrittenRoute
    : null
}

/** Match the existing stable ID whether selected or entered as a room number. */
export function resolveRoomId(room: string) {
  const normalizedRoom = room.trim().toLowerCase()
  return schoolLocations.find(
    (location) => !location.isWaypoint && location.roomNumber?.toLowerCase() === normalizedRoom,
  )?.id
}
