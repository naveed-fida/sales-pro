import tseslint from '@electron-toolkit/eslint-config-ts'
import prettierConfig from '@electron-toolkit/eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'out/**',
      'release/**',
      'dist/**',
      // Generated migration history and the local database.
      'drizzle/**',
      '.data/**',
      '.cache/**',
    ],
  },

  // Non type-checked recommended rules. Type-aware linting would need the
  // parser to load both tsconfigs on every run, and typecheck already covers
  // what it would add.
  tseslint.configs.recommended,

  // React rules belong to the renderer alone; main and preload have no React.
  // configs.flat is the flat-config namespace; configs.recommended at the top
  // level is still eslintrc-shaped and ESLint 10 rejects it.
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // shadcn components are vendored, not authored here. The CLI emits them
  // without explicit return types, so enforcing that would mean editing files
  // the generator owns and re-editing them on every `shadcn add`.
  // They also export their cva variant objects alongside the component, which
  // trips the fast-refresh rule.
  {
    files: ['src/renderer/src/components/ui/**/*.tsx'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },

  // Must come last: it turns off stylistic rules that would fight Prettier,
  // then reports remaining formatting differences as warnings.
  prettierConfig,
)
