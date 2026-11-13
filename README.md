# School Nav: connection-driven navigation

## Run and check

- `npm run dev` starts the development UI.
- `npm test` runs the TypeScript data/routing tests in memory with Node's test runner.
- `npm run build` type-checks and produces the production app.
- `npm run lint` checks the source.

## Test the first proposed journey

In development, enable **Show proposed routes**, then type W-301 as the start
and W-303 as the destination (or select them through Other → White Pod).
The calculated path uses the existing JSON adjacencies 47–48 and 48–49.
It displays the instructions from the two directed records in `writtenRoutes.ts`,
not a fixed-pair override. The result is explicitly **NOT verified**.
W-302 is a checkpoint, not an instruction to enter that classroom.

Both real records remain pending. Normal navigation currently has no approved
connections and reports unavailable; production has no proposed-route checkbox.
The older raw graph remains available for analysis, but its 187 imported edges
are not automatically treated as supported navigation.

## Review and expand

Confirm the actual corridor sequence, door access, passage types and forward
wording in a walkthrough before setting review flags. The old Level 3 plan is a
2010 draft and does not establish current room-door identities.
Add reviewed directed connection records to `writtenConnections` using existing
location IDs. `validateWrittenConnections` checks them before the shared Dijkstra
search combines them. No per-journey routing code is needed. Reverse instructions
need separate records. Unknown floors and incomplete transitions are excluded;
verified floor changes require an explicit stair/ramp connection. Missing times
stay absent and search costs are never shown as walking durations.

The original Vite template reference follows.

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
