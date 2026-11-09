import { useState } from 'react'
import { getLocationLabel, landmarkOptions, podOptions, selectableLocations } from './data/locationOptions'
import { findDirections, formatSeconds } from './data/routeDirections'
import type { Directions } from './data/routeDirections'
import { resolveRoomId } from './data/writtenRoutes'
import './App.css'

type Location = { landmark: string; room: string }

function getLocationId(location: Location) {
  return location.landmark || resolveRoomId(location.room) || ''
}

function getLocationName(location: Location) {
  const id = getLocationId(location)
  return selectableLocations.find((landmark) => landmark.id === id)?.displayName
    || location.room.trim()
}

function unavailableMessage(
  directions: Exclude<Directions, { status: 'found' }>,
  from: { id: string; name: string },
  to: { id: string; name: string },
) {
  switch (directions.status) {
    case 'same-place':
      return 'Your starting point and destination are the same place.'
    case 'not-mapped': {
      const names = [from, to].filter(({ id }) => directions.locationIds.includes(id)).map(({ name }) => name)
      return `${names.join(' and ')} ${names.length > 1 ? 'have' : 'has'} not been added to the map yet, so directions can't be generated.`
    }
    case 'no-route':
      return `No recorded connections join ${from.name} and ${to.name} yet.`
    case 'unknown-location':
      return 'We could not find one of those rooms. Check the room number, e.g. W-302.'
  }
}

function LocationField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: Location
  onChange: (location: Location) => void
}) {
  const [level, setLevel] = useState<'landmarks' | 'pods' | 'rooms'>('landmarks')
  const [podId, setPodId] = useState('')
  const pod = podOptions.find(({ id }) => id === podId)
  const options = level === 'landmarks' ? landmarkOptions : pod?.locations ?? []
  const selectedLocation = selectableLocations.find(({ id }) => id === value.landmark)
  const selectLocation = (locationId: string) => {
    onChange({ landmark: locationId, room: '' })
    setLevel('landmarks')
    setPodId('')
  }

  return (
    <fieldset className="field">
      <legend>{label}</legend>
      {level !== 'landmarks' && (
        <div className="location-back-links">
          <button type="button" onClick={() => setLevel(level === 'rooms' ? 'pods' : 'landmarks')}>
            ← {level === 'rooms' ? 'Back to pods' : 'Back to landmarks'}
          </button>
          {level === 'rooms' && (
            <button type="button" onClick={() => setLevel('landmarks')}>All landmarks</button>
          )}
        </div>
      )}
      <label htmlFor={`${id}-landmark`}>
        {level === 'landmarks' ? 'Choose a landmark' : level === 'pods' ? 'Choose a pod' : `${pod?.displayName} — choose a location`}
      </label>
      {level === 'rooms' && <span className={`pod-badge pod-${podId}`}>{pod?.displayName}</span>}
      <select
        id={`${id}-landmark`}
        value={level === 'landmarks' ? value.landmark : ''}
        onChange={(event) => {
          const selected = event.target.value
          if (selected === 'other') {
            setLevel('pods')
          } else if (level === 'pods' && selected) {
            setPodId(selected)
            setLevel('rooms')
          } else {
            selectLocation(selected)
          }
        }}
      >
        <option value="">{level === 'landmarks' ? 'Select a landmark' : level === 'pods' ? 'Select a pod' : 'Select a room or location'}</option>
        {level === 'pods' ? podOptions.map((option) => (
          <option key={option.id} value={option.id}>{option.displayName}</option>
        )) : options.map((location) => (
          <option key={location.id} value={location.id}>{getLocationLabel(location)}</option>
        ))}
        {level === 'landmarks' && selectedLocation && !landmarkOptions.some(({ id }) => id === selectedLocation.id) && (
          <option value={selectedLocation.id}>{getLocationLabel(selectedLocation)}</option>
        )}
        {level === 'landmarks' && <option value="other">Other</option>}
      </select>
      {level !== 'landmarks' && (
        <p className="location-hint" role="status">
          {selectedLocation ? `Currently selected: ${getLocationLabel(selectedLocation)}. ` : ''}
          {level === 'pods' ? 'Choose a pod to browse its rooms, or Other locations.' : 'Only locations recorded in this group are shown.'}
        </p>
      )}
      <span className="location-divider">or</span>
      <label htmlFor={`${id}-room`}>Enter a specific room</label>
      <input
        id={`${id}-room`}
        type="text"
        placeholder="e.g. W-302 or O-309"
        value={value.room}
        onChange={(event) => {
          onChange({ landmark: '', room: event.target.value })
          setLevel('landmarks')
          setPodId('')
        }}
        aria-describedby={`${id}-hint`}
      />
      <p className="location-hint" id={`${id}-hint`}>
        Choose a landmark, browse Other for rooms, or type a room number.
      </p>
    </fieldset>
  )
}

function App() {
  const [startingPoint, setStartingPoint] = useState<Location>({ landmark: '', room: '' })
  const [destination, setDestination] = useState<Location>({ landmark: '', room: '' })
  const [submitted, setSubmitted] = useState(false)
  const from = getLocationName(startingPoint)
  const to = getLocationName(destination)
  const fromId = getLocationId(startingPoint)
  const toId = getLocationId(destination)
  const directions = findDirections(fromId, toId)

  return (
    <main className="homepage">
      <header className="site-header">
        <a className="app-name" href="/">School Nav</a>
        <span className="prototype-label">Prototype</span>
      </header>

      <section className="intro">
        <p className="eyebrow">Find your way around</p>
        <h1>Where do you need to go?</h1>
        <p className="description">
          Choose a landmark or enter a room number for each location
          to get clear, written directions.
        </p>
      </section>

      <section className="navigation-panel" aria-labelledby="panel-title">
        <h2 id="panel-title">Plan your journey</h2>
        <p className="route-hint">
          Directions are generated for any two mapped locations.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (from && to) setSubmitted(true)
          }}
        >
          <LocationField
            id="starting-point"
            label="Where are you starting?"
            value={startingPoint}
            onChange={(location) => {
              setStartingPoint(location)
              setSubmitted(false)
            }}
          />
          <LocationField
            id="destination"
            label="Where are you going?"
            value={destination}
            onChange={(location) => {
              setDestination(location)
              setSubmitted(false)
            }}
          />

          <button
            className="directions-button"
            type="submit"
            disabled={!from || !to}
          >
            Get Directions
          </button>
        </form>

        {submitted && (
          <div className="journey-summary" role="status">
            <h3>{directions.status === 'found' ? 'Your directions' : 'Route unavailable'}</h3>
            <p><strong>From:</strong> {from}</p>
            <p><strong>To:</strong> {to}</p>
            {directions.status === 'found' ? (
              <>
                <ol className="direction-steps">
                  {directions.steps.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
                {directions.totalSeconds !== undefined && (
                  <p>
                    <strong>Total walking time:</strong> about {formatSeconds(directions.totalSeconds)}
                    {directions.usesEstimate && ' (some legs are not timed yet, so this is an estimate)'}
                  </p>
                )}
              </>
            ) : (
              <p>{unavailableMessage(directions, { id: fromId, name: from }, { id: toId, name: to })}</p>
            )}
          </div>
        )}
      </section>

      <footer className="site-footer">
        <p>School Nav prototype · Routes generated from the school map</p>
      </footer>
    </main>
  )
}

export default App
