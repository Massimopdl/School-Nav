import { build } from 'vite'

// Bundle TypeScript tests in memory and execute with Node's built-in runner.
for (const name of ['writtenRoutes', 'locationOptions', 'routeDirections']) {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    build: { ssr: `src/data/${name}.test.ts`, write: false },
  })
  const entry = result.output.find(item => item.type === 'chunk' && item.isEntry)
  await import(`data:text/javascript;base64,${Buffer.from(entry.code).toString('base64')}`)
}
