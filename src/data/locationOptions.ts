import { schoolLocations, schoolPods, unresolvedLocations } from './schoolLocations'
import type { SchoolLocation } from './schoolLocations'

// Reuse both database lists, including destinations awaiting a graph mapping.
export const selectableLocations = [
  ...schoolLocations.filter((location) => !location.isWaypoint),
  ...unresolvedLocations.filter((location) => !schoolLocations.some(({ id }) => id === location.id)),
]

const commonLandmarkIds = new Set([
  'library', 'mellon-library', 'cafeteria', 'school-center',
  'farmer-gym', 'learning-commons', 'main-entrance',
])

export const landmarkOptions = selectableLocations.filter(({ id }) => commonLandmarkIds.has(id))

function getPodId(location: Pick<SchoolLocation, 'id' | 'podId' | 'roomNumber'>) {
  if (location.podId) return location.podId
  const prefix = (location.roomNumber || location.id).split('-')[0].toUpperCase()
  return schoolPods.find((pod) => 'roomPrefix' in pod && pod.roomPrefix === prefix)?.id
}

const remainingLocations = selectableLocations.filter(({ id }) => !commonLandmarkIds.has(id))
const sortLocations = (locations: typeof remainingLocations) => [...locations].sort(
  (a, b) => {
    const name = (location: (typeof remainingLocations)[number]) =>
      ('roomNumber' in location && location.roomNumber) || location.displayName
    return name(a).localeCompare(name(b), undefined, { numeric: true })
  },
)

export const podOptions = [
  ...schoolPods.map((pod) => ({
    id: pod.id,
    displayName: pod.displayName,
    locations: sortLocations(remainingLocations.filter((location) => getPodId(location) === pod.id)),
  })),
  {
    id: 'unassigned',
    displayName: 'Other locations',
    locations: sortLocations(remainingLocations.filter((location) => !getPodId(location))),
  },
].filter((pod) => pod.locations.length > 0)

export function getLocationLabel(location: (typeof selectableLocations)[number]) {
  return 'roomNumber' in location && location.roomNumber && location.roomNumber !== location.displayName
    ? `${location.roomNumber} — ${location.displayName}`
    : location.displayName
}
