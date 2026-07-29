import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // This project uses many shadcn/ui components that legitimately set state in effects.
      // We prefer consistent UI library behavior over this strict performance heuristic.
      'react-hooks/set-state-in-effect': 'off',

      // Allow exporting hooks/constants alongside components (common in UI libs).
      'react-refresh/only-export-components': 'off',

      // Some UI components include non-deterministic demo helpers (e.g., skeleton widths).
      // We don't rely on this rule for correctness in this project.
      'react-hooks/purity': 'off',
    },
  },
])
