import { findRoute, schoolLocations } from './schoolLocations'
import type { Route } from './schoolLocations'
import { findWrittenRoute } from './writtenRoutes'

export type Directions =
  | {
      status: 'found'
      /** 'written' = hand-written route; 'graph' = generated from schoolGraph.json. */
      source: 'written' | 'graph'
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

const locationsById = new Map(schoolLocations.map((location) => [location.id, location]))

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

function nameOf(id: string) {
  return locationsById.get(id)?.displayName ?? id
}

// Leg wording stays generic: the graph does not confirm doorways, stairs or sides.
function describeGraphRoute(route: Route) {
  return route.edges.map((edge, index) => {
    const from = nameOf(route.path[index])
    const to = nameOf(route.path[index + 1])
    const time = `about ${formatSeconds(edge.walkSeconds)}${edge.measured ? '' : ', estimated'}`
    const verb = edge.kind === 'outdoor' ? 'Head outside' : 'Walk'
    return `${verb} from ${from} to ${to} (${time}).`
  })
}

/**
 * Directions for any pair of locations. A hand-written route wins when one
 * exists; otherwise the quickest route is generated from the school graph.
 */
export function findDirections(fromId: string, toId: string): Directions {
  if (!fromId || !toId) return { status: 'unknown-location' }
  if (fromId === toId) return { status: 'same-place' }

  const written = findWrittenRoute(fromId, toId)
  if (written) {
    return {
      status: 'found',
      source: 'written',
      steps: written.connections.map(({ direction }) => direction),
      usesEstimate: false,
    }
  }

  const unmapped = [fromId, toId].filter((id) => !routableLocationIds.has(id))
  if (unmapped.length) return { status: 'not-mapped', locationIds: unmapped }

  const route = findRoute(fromId, toId)
  if (!route) return { status: 'no-route' }
  return {
    status: 'found',
    source: 'graph',
    steps: describeGraphRoute(route),
    totalSeconds: route.totalSeconds,
    usesEstimate: route.usesUnmeasuredEdge,
  }
}
