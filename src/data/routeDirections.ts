import { schoolLocations, unresolvedLocations } from './schoolLocations'
import { findWrittenRoute } from './writtenRoutes'
import type { WrittenRouteOptions } from './writtenRoutes'

export type Directions =
  | {
      status: 'found'
      source: 'connections'
      verification: 'approved' | 'proposed'
      connectionIds: string[]
      steps: string[]
      /** Absent for written routes, which have no confirmed timings. */
      totalSeconds?: number
      /** True when any leg uses a placeholder time instead of a measured one. */
      usesEstimate: boolean
    }
  | { status: 'same-place' }
  /** One or both locations have no graph node yet, so no route can be generated. */
  | { status: 'not-mapped'; locationIds: string[] }
  /** Both locations are mapped, but no chain of connections joins them. */
  | { status: 'no-route' }
  | { status: 'unknown-location' }

/** Locations that exist in the imported graph and can therefore be routed. */
export const routableLocationIds = new Set(
  schoolLocations.filter(({ nodeNumber }) => nodeNumber !== undefined).map(({ id }) => id),
)

/** Formats seconds as "45s" or "1m 05s", matching PlannerRunner. */
export function formatSeconds(seconds: number) {
  const rounded = Math.round(seconds)
  if (rounded < 60) return `${rounded}s`
  return `${Math.floor(rounded / 60)}m ${String(rounded % 60).padStart(2, '0')}s`
}

/** Calculate directions from validated, ordered, directed connection records. */
export function findDirections(fromId: string, toId: string, options: WrittenRouteOptions = {}): Directions {
  const knownIds = new Set([...schoolLocations, ...unresolvedLocations].map(({ id }) => id))
  if (!knownIds.has(fromId) || !knownIds.has(toId)) return { status: 'unknown-location' }
  if (fromId === toId) return { status: 'same-place' }

  const route = findWrittenRoute(fromId, toId, options)
  if (route) {
    const timed = route.verification === 'approved'
      && route.connections.every(({ durationSeconds }) => durationSeconds !== undefined)
    return {
      status: 'found', source: 'connections', verification: route.verification,
      connectionIds: route.connections.map(({ id }) => id),
      steps: route.connections.map(({ direction }) => direction!),
      ...(timed ? { totalSeconds: route.connections.reduce((sum, c) => sum + c.durationSeconds!, 0) } : {}),
      usesEstimate: false,
    }
  }
  const unmapped = [fromId, toId].filter((id) => !routableLocationIds.has(id))
  return unmapped.length ? { status: 'not-mapped', locationIds: unmapped } : { status: 'no-route' }
}
