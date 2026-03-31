---
phase: 01-project-foundation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - vite.config.ts
  - tsconfig.json
  - tsconfig.app.json
  - tsconfig.node.json
  - tsconfig.vitest.json
  - eslint.config.js
  - .prettierrc
  - vitest.config.ts
  - src/style.css
  - src/main.ts
  - src/App.vue
  - index.html
  - src/stores/inputStore.test.ts
  - src/stores/uiStore.test.ts
  - src/stores/calculationStore.test.ts
autonomous: true
requirements:
  - SETUP-01
  - SETUP-02
  - SETUP-03

must_haves:
  truths:
    - "npm run dev starts the Vite dev server on localhost without errors"
    - "npm run test exits 0 (vitest runner works even with stub test files)"
    - "npm run type-check exits 0 (TypeScript strict mode passes)"
    - "npm run lint exits 0 (ESLint passes on all .ts and .vue files)"
    - "npm run build produces a dist/ directory without rolldown errors"
  artifacts:
    - path: "package.json"
      provides: "Dependency manifest with exact vcf-sizer versions"
      contains: '"vue": "^3.5.31"'
    - path: "vite.config.ts"
      provides: "Vite build configuration with base /os-sizer/"
      contains: "base: '/os-sizer/'"
    - path: "vitest.config.ts"
      provides: "Test runner configuration"
      contains: "environment: 'node'"
    - path: "src/style.css"
      provides: "Tailwind v4 CSS entry point"
      contains: '@import "tailwindcss"'
    - path: "src/main.ts"
      provides: "Bootstrap entry point with correct plugin order"
      contains: "app.use(pinia)"
    - path: "src/stores/inputStore.test.ts"
      provides: "Wave 0 test stub so vitest has a file to discover"
      contains: "describe("
  key_links:
    - from: "src/main.ts"
      to: "src/App.vue"
      via: "createApp(App)"
      pattern: "createApp\\(App\\)"
    - from: "vite.config.ts"
      to: "@intlify/unplugin-vue-i18n/vite"
      via: "VueI18nPlugin({ runtimeOnly: false })"
      pattern: "VueI18nPlugin"
---

<objective>
Initialize the os-sizer project with the exact same toolchain as vcf-sizer. All configuration files are copied verbatim from /Users/fjacquet/Projects/vcf-sizer/ with only the project name and base URL changed.

Purpose: Establish a runnable Vue 3 + TypeScript + Vite 8 + Tailwind v4 project that passes lint, type-check, test, and build before any domain code is written.

Output: A working project scaffold where `npm run dev` works, `npm run test` exits 0, and Wave 0 test stub files exist for the Pinia stores.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-project-foundation/01-RESEARCH.md

Reference implementation (read before writing any file):
/Users/fjacquet/Projects/vcf-sizer/package.json
/Users/fjacquet/Projects/vcf-sizer/vite.config.ts
/Users/fjacquet/Projects/vcf-sizer/tsconfig.json
/Users/fjacquet/Projects/vcf-sizer/tsconfig.app.json
/Users/fjacquet/Projects/vcf-sizer/tsconfig.node.json
/Users/fjacquet/Projects/vcf-sizer/tsconfig.vitest.json
/Users/fjacquet/Projects/vcf-sizer/eslint.config.js
/Users/fjacquet/Projects/vcf-sizer/.prettierrc
/Users/fjacquet/Projects/vcf-sizer/src/style.css
/Users/fjacquet/Projects/vcf-sizer/src/main.ts
/Users/fjacquet/Projects/vcf-sizer/src/App.vue
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Initialize project and install dependencies</name>
  <files>package.json, index.html</files>

  <read_first>
    - /Users/fjacquet/Projects/vcf-sizer/package.json (source of truth for all dependency versions)
    - /Users/fjacquet/Projects/os-sizer/package.json (current state if it exists)
    - /Users/fjacquet/Projects/vcf-sizer/index.html (title and entry point)
  </read_first>

  <behavior>
    - package.json contains `"vue": "^3.5.31"` in dependencies
    - package.json contains `"vite": "^8.0.3"` in dependencies
    - package.json contains `"pinia": "^3.0.4"` in dependencies
    - package.json contains `"vue-i18n": "^11.3.0"` in dependencies
    - package.json contains `"vitest": "^4.1.2"` in devDependencies
    - package.json scripts include `"test": "vitest run"` (not vitest watch)
    - package.json scripts include `"type-check": "vue-tsc --noEmit"`
    - package.json scripts include `"lint": "eslint src --ext .ts,.vue"`
    - package.json scripts include `"build": "vue-tsc -b tsconfig.app.json tsconfig.node.json && vite build"`
    - npm install completes without errors
  </behavior>

  <action>
First verify Node.js and npm are present: `node --version && npm --version`

If /Users/fjacquet/Projects/os-sizer/package.json does not exist, run:
```
cd /Users/fjacquet/Projects/os-sizer
npm create vite@latest . -- --template vue-ts
```
(Accept overwrite prompts — the directory exists but may have only .planning/)

Then install all production dependencies to match vcf-sizer exactly:
```
npm install \
  vue@^3.5.31 \
  vite@^8.0.3 \
  @vitejs/plugin-vue@^6.0.5 \
  tailwindcss@^4.2.2 \
  @tailwindcss/vite@^4.2.2 \
  pinia@^3.0.4 \
  vue-i18n@^11.3.0 \
  vue-router@^5.0.4 \
  zod@^4.3.6 \
  decimal.js@^10.6.0 \
  lz-string@^1.5.0 \
  @vueuse/core@^14.2.1 \
  chart.js@^4.5.1 \
  vue-chartjs@^5.3.3 \
  pptxgenjs@^4.0.1
```

Then install dev dependencies:
```
npm install -D \
  @intlify/unplugin-vue-i18n@^11.0.7 \
  @types/node@^25.5.0 \
  vitest@^4.1.2 \
  @vitest/ui@^4.1.2 \
  vue-tsc@^3.2.6 \
  eslint@^10.1.0 \
  @eslint/js@^10.0.1 \
  typescript-eslint@^8.58.0 \
  eslint-plugin-vue@^10.8.0 \
  eslint-config-prettier@^10.1.8 \
  prettier@^3.8.1 \
  globals@^17.4.0 \
  @vue/eslint-config-typescript@^14.7.0
```

Update package.json scripts section to exactly match vcf-sizer:
```json
"scripts": {
  "dev": "vite",
  "build": "vue-tsc -b tsconfig.app.json tsconfig.node.json && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "type-check": "vue-tsc --noEmit",
  "lint": "eslint src --ext .ts,.vue"
}
```

Also ensure `"type": "module"` is present in package.json root.

Update index.html title to "OpenShift Sizing Calculator" and ensure the entry point is `src/main.ts`.
  </action>

  <verify>
    <automated>cd /Users/fjacquet/Projects/os-sizer && node --version && npm --version && node -e "const p=require('./package.json'); console.log(p.dependencies.vue, p.dependencies.pinia, p.devDependencies.vitest)"</automated>
  </verify>

  <acceptance_criteria>
    - `grep '"vue"' package.json` outputs a line containing `"^3.5.31"`
    - `grep '"pinia"' package.json` outputs a line containing `"^3.0.4"`
    - `grep '"vitest"' package.json` outputs a line containing `"^4.1.2"`
    - `grep '"test"' package.json` outputs `"vitest run"` (not `"vitest"` alone)
    - `grep '"type"' package.json` outputs `"module"`
    - `ls /Users/fjacquet/Projects/os-sizer/node_modules/.bin/vite` exists
    - `ls /Users/fjacquet/Projects/os-sizer/node_modules/.bin/vitest` exists
  </acceptance_criteria>

  <done>package.json has all vcf-sizer dependency versions, npm install completed, node_modules present with vite and vitest binaries.</done>
</task>

<task type="auto">
  <name>Task 2: Write all config files (vite, tsconfig x4, eslint, prettier, vitest, style.css)</name>
  <files>
    vite.config.ts,
    tsconfig.json,
    tsconfig.app.json,
    tsconfig.node.json,
    tsconfig.vitest.json,
    eslint.config.js,
    .prettierrc,
    vitest.config.ts,
    src/style.css
  </files>

  <read_first>
    - /Users/fjacquet/Projects/vcf-sizer/vite.config.ts
    - /Users/fjacquet/Projects/vcf-sizer/tsconfig.json
    - /Users/fjacquet/Projects/vcf-sizer/tsconfig.app.json
    - /Users/fjacquet/Projects/vcf-sizer/tsconfig.node.json
    - /Users/fjacquet/Projects/vcf-sizer/tsconfig.vitest.json
    - /Users/fjacquet/Projects/vcf-sizer/eslint.config.js
    - /Users/fjacquet/Projects/vcf-sizer/.prettierrc
    - /Users/fjacquet/Projects/vcf-sizer/src/style.css
  </read_first>

  <action>
Write each config file. Only vite.config.ts changes from vcf-sizer (base URL). All others are verbatim copies.

**vite.config.ts** — copy vcf-sizer verbatim, change only `base`:
```typescript
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'

export default defineConfig({
  base: '/os-sizer/',
  plugins: [
    vue(),
    tailwindcss(),
    // Note: include is omitted to avoid rolldown/JSON conflict with Vite 8.
    // JSON locale files are processed natively by rolldown.
    // The plugin still handles SFC <i18n> blocks if needed in future.
    VueI18nPlugin({
      runtimeOnly: false,
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
```

**tsconfig.json** — copy verbatim from vcf-sizer (references app, node, vitest):
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.vitest.json" }
  ]
}
```

**tsconfig.app.json** — copy verbatim from vcf-sizer:
```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
  "exclude": ["src/**/*.test.ts", "src/**/*.spec.ts"]
}
```

**tsconfig.node.json** — copy verbatim from vcf-sizer:
```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "types": ["node"],
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

**tsconfig.vitest.json** — copy verbatim from vcf-sizer:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "types": ["vitest/globals", "node"],
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"]
}
```

**eslint.config.js** — copy verbatim from vcf-sizer:
```javascript
import eslint from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import eslintPluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import typescriptEslint from 'typescript-eslint'

export default typescriptEslint.config(
  { ignores: ['*.d.ts', '**/coverage', '**/dist', '**/node_modules'] },
  {
    extends: [
      eslint.configs.recommended,
      ...typescriptEslint.configs.recommended,
      ...eslintPluginVue.configs['flat/recommended'],
    ],
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        parser: typescriptEslint.parser,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'vue/multi-word-component-names': 'off',
      'vue/block-lang': ['error', { script: { lang: 'ts' } }],
    },
  },
  eslintConfigPrettier,
  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
)
```

**.prettierrc** — copy verbatim from vcf-sizer:
```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf",
  "vueIndentScriptAndStyle": true
}
```

**vitest.config.ts** — copy from vcf-sizer pattern (include stores test path for Wave 0 stubs):
```typescript
import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'src/engine/**/*.test.ts',
      'src/composables/**/*.test.ts',
      'src/stores/**/*.test.ts',
    ],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
```

**src/style.css** — copy verbatim from vcf-sizer (Tailwind v4 + print rules):
```css
@import "tailwindcss";

@custom-variant print (@media print);

@page {
  size: A4 portrait;
  margin: 25mm 15mm 25mm 15mm;
}

@media print {
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
```

CRITICAL: Do NOT create tailwind.config.js — Tailwind v4 uses CSS-first configuration only.
  </action>

  <verify>
    <automated>cd /Users/fjacquet/Projects/os-sizer && grep "base: '/os-sizer/'" vite.config.ts && grep "runtimeOnly: false" vite.config.ts && grep -v "include" vite.config.ts | grep -c "VueI18nPlugin" && grep '@import "tailwindcss"' src/style.css && grep '"semi": false' .prettierrc</automated>
  </verify>

  <acceptance_criteria>
    - `grep "base: '/os-sizer/'" vite.config.ts` finds a match
    - `grep "runtimeOnly: false" vite.config.ts` finds a match
    - `grep "include:" vite.config.ts` finds NO match (the `include` option must be absent from the plugin call)
    - `grep '@import "tailwindcss"' src/style.css` finds a match
    - `grep "tailwind.config" . -r --include="*.js" --include="*.ts"` finds NO match
    - `grep '"semi": false' .prettierrc` finds a match
    - `grep "environment: 'node'" vitest.config.ts` finds a match
    - `grep "tsconfig.vitest.json" tsconfig.json` finds a match
    - `ls tsconfig.app.json tsconfig.node.json tsconfig.vitest.json` all exist
  </acceptance_criteria>

  <done>All config files written. vite.config.ts has base=/os-sizer/ and VueI18nPlugin without include. Tailwind v4 CSS-only setup. All tsconfig files reference each other correctly.</done>
</task>

<task type="auto">
  <name>Task 3: Write App.vue shell, main.ts, Wave-0 test stubs, and validate full toolchain</name>
  <files>
    src/main.ts,
    src/App.vue,
    src/stores/inputStore.test.ts,
    src/stores/uiStore.test.ts,
    src/stores/calculationStore.test.ts
  </files>

  <read_first>
    - /Users/fjacquet/Projects/vcf-sizer/src/main.ts (bootstrap order is critical)
    - /Users/fjacquet/Projects/vcf-sizer/src/App.vue (layout pattern)
  </read_first>

  <behavior>
    - main.ts calls app.use(pinia) before app.use(i18n) before app.mount('#app')
    - App.vue renders `{{ t('app.title') }}` in the header using useI18n()
    - App.vue imports LanguageSwitcher but renders it as a stub comment until Phase 3
    - Wave-0 test stubs: each .test.ts has at least one describe() block so vitest discovers it
    - `npm run test` exits 0 after stub files are created
    - `npm run type-check` exits 0
    - `npm run lint` exits 0
  </behavior>

  <action>
**src/main.ts** — bootstrap order is critical, do NOT reorder:
```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { i18n } from './i18n'
import App from './App.vue'
import './style.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(i18n)
// Note: hydrateFromUrl() will be added here in Phase 4 (after useUrlState.ts is written)
app.mount('#app')
```

NOTE: `src/i18n/index.ts` does not exist yet — it will be created in plan 03. For now, create a temporary stub at `src/i18n/index.ts`:
```typescript
import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
export const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
export async function loadLocale(_locale: 'fr' | 'de' | 'it'): Promise<void> {}
```

Also create `src/i18n/locales/en.json` minimal stub:
```json
{ "app": { "title": "OpenShift Sizing Calculator" } }
```

**src/App.vue** — simplified shell (Phase 3 will add full wizard panes):
```vue
<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  const { t } = useI18n()
</script>

<template>
  <div class="min-h-screen bg-gray-50 font-sans">
    <header class="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10 print:hidden">
      <h1 class="text-lg font-bold text-gray-900">{{ t('app.title') }}</h1>
      <!-- LanguageSwitcher added in plan 03 -->
    </header>
    <main class="p-6">
      <p class="text-gray-500">Wizard placeholder — implemented in Phase 3.</p>
    </main>
  </div>
</template>
```

**Wave-0 test stubs** — these must exist BEFORE vitest runs so the runner finds test files:

`src/stores/inputStore.test.ts`:
```typescript
/// <reference types="vitest/globals" />
import { describe, it } from 'vitest'
// inputStore tests — implemented in Phase 2 when ClusterConfig types are defined
describe('inputStore — stub', () => {
  it('placeholder: store module will be tested in Phase 2', () => {
    // Wave 0 stub — no assertions yet
  })
})
```

`src/stores/uiStore.test.ts`:
```typescript
/// <reference types="vitest/globals" />
import { describe, it } from 'vitest'
// uiStore tests — implemented in plan 02 alongside the store
describe('uiStore — stub', () => {
  it('placeholder: locale detection will be tested in plan 02', () => {
    // Wave 0 stub — no assertions yet
  })
})
```

`src/stores/calculationStore.test.ts`:
```typescript
/// <reference types="vitest/globals" />
import { describe, it } from 'vitest'
// calculationStore tests — implemented in plan 02 alongside the store
describe('calculationStore — stub', () => {
  it('placeholder: computed-only pattern will be tested in plan 02', () => {
    // Wave 0 stub — no assertions yet
  })
})
```

After writing all files, run the full toolchain validation:
1. `npm run type-check` — must exit 0
2. `npm run test` — must exit 0 (3 stub tests pass)
3. `npm run lint` — must exit 0
4. `npm run build` — must exit 0 and produce dist/

Fix any errors before marking done. Common issues:
- If `npm run build` fails with "Cannot find module '@intlify/unplugin-vue-i18n/vite'": confirm `@intlify/unplugin-vue-i18n` is in devDependencies and run `npm install` again.
- If lint fails on App.vue with "multi-word component name": ensure `'vue/multi-word-component-names': 'off'` is in eslint.config.js rules.

Also add a git pre-commit hook (optional but referenced in ROADMAP plan 1 description):
```bash
mkdir -p /Users/fjacquet/Projects/os-sizer/.git/hooks
cat > /Users/fjacquet/Projects/os-sizer/.git/hooks/pre-commit << 'EOF'
#!/bin/sh
cd "$(git rev-parse --show-toplevel)"
npm run lint && npm run type-check
EOF
chmod +x /Users/fjacquet/Projects/os-sizer/.git/hooks/pre-commit
```
  </action>

  <verify>
    <automated>cd /Users/fjacquet/Projects/os-sizer && npm run type-check && npm run test && npm run lint</automated>
  </verify>

  <acceptance_criteria>
    - `npm run type-check` exits with code 0
    - `npm run test` exits with code 0 and output shows "3 passed" (the 3 stub tests)
    - `npm run lint` exits with code 0
    - `npm run build` exits with code 0 and `ls dist/index.html` exists
    - `grep "app.use(pinia)" src/main.ts` finds a match before `app.use(i18n)`
    - `grep "app.mount" src/main.ts` finds a match after both use() calls
    - `grep "t('app.title')" src/App.vue` finds a match
    - `ls src/stores/inputStore.test.ts src/stores/uiStore.test.ts src/stores/calculationStore.test.ts` all exist
  </acceptance_criteria>

  <done>Full toolchain green: type-check, test (3 stubs), lint, and build all exit 0. App.vue renders app.title from i18n. Wave-0 test stubs committed.</done>
</task>

</tasks>

<verification>
After all three tasks complete, run the full suite:

```bash
cd /Users/fjacquet/Projects/os-sizer
npm run type-check && npm run test && npm run lint && npm run build
```

All four commands must exit 0. Check:
- `dist/` directory exists with index.html
- `grep "base: '/os-sizer/'" vite.config.ts` confirms base URL
- `grep "runtimeOnly: false" vite.config.ts` confirms VueI18nPlugin
- `grep -c "include" vite.config.ts` returns 0 (no include in VueI18nPlugin)
- No tailwind.config.js file present
</verification>

<success_criteria>
- npm run dev starts the Vite dev server without errors
- npm run test exits 0 with 3 stub tests passing
- npm run type-check exits 0 (strict TypeScript)
- npm run lint exits 0 (ESLint clean)
- npm run build produces a clean dist/ directory
- vite.config.ts has base: '/os-sizer/' and VueI18nPlugin without include
- All four tsconfig files present and correctly cross-referenced
</success_criteria>

<output>
After completion, create `/Users/fjacquet/Projects/os-sizer/.planning/phases/01-project-foundation/01-01-scaffold-SUMMARY.md`
</output>
