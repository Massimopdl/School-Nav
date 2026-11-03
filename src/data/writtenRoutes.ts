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
