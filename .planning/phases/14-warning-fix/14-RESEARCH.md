# Phase 14: Warning Fix - Research

**Researched:** 2026-04-05
**Domain:** Engine validation logic, AddOnConfig interface, Zod schema, i18n locale files
**Confidence:** HIGH

---

## Summary

Phase 14 is a surgical, well-scoped change across four layers of the codebase: the engine validation function, the `AddOnConfig` interface + Zod schema + defaults factory, the four locale JSON files, and the validation test suite. No new libraries are needed. No UI pages require new components — only a new checkbox wiring in `Step2WorkloadForm.vue`.

The current `VIRT_RWX_REQUIRES_ODF` warning (WARN-02) fires whenever `virtEnabled=true` and `odfEnabled=false`. This is incorrect: a user could have a non-ODF RWX storage class (e.g. NFS, Longhorn with RWX mode) that also supports live migration. The fix introduces a new `rwxStorageAvailable` boolean field on `AddOnConfig` and changes the guard to `virtEnabled && !rwxStorageAvailable && !odfEnabled`. The old warning code and messageKey are retired across source, locales, and tests.

**Primary recommendation:** Add `rwxStorageAvailable: boolean` to `AddOnConfig` (interface + Zod schema + defaults), change the validation guard to check both `odfEnabled` and the new field, rename the warning code and all i18n keys, and update the six test cases in `validation.test.ts`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WARN-04 | User sees live migration warning only when virtEnabled AND no RWX-capable storage (ODF or any other RWX class) is configured | New field `rwxStorageAvailable` + updated guard condition in `validateInputs` |
| WARN-05 | Warning code, i18n keys, and test fixtures updated from `VIRT_RWX_REQUIRES_ODF` to `VIRT_RWX_STORAGE_REQUIRED` in all 4 locales and all test files | Full enumeration of all locations where the old key appears provided below |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- Always prefix commands with `rtk` (token optimization)
- Engine files: zero Vue, Pinia, or vue-i18n imports (ENG-09 / CALC-01)
- CALC-02: `calculationStore` must have zero `ref()` — only `computed()`
- vue-i18n VueI18nPlugin must NOT use `include` option (Vite 8 rolldown bug)
- Pattern mirror: architecture mirrors `/Users/fjacquet/Projects/vcf-sizer`
- No new npm packages for v2.1 (REQUIREMENTS.md out-of-scope constraint)

---

## Standard Stack

No new libraries. All changes are internal to the existing stack:

| Layer | File | Change Type |
|-------|------|-------------|
| Engine types | `src/engine/types.ts` | Add field to `AddOnConfig` interface |
| Engine validation | `src/engine/validation.ts` | Update guard condition + rename code/messageKey |
| Engine defaults | `src/engine/defaults.ts` | Add default value for new field |
| URL state schema | `src/composables/useUrlState.ts` | Add field to `AddOnConfigSchema` with `.optional().default(false)` |
| Locale EN | `src/i18n/locales/en.json` | Rename key + update message text |
| Locale FR | `src/i18n/locales/fr.json` | Rename key + update message text |
| Locale DE | `src/i18n/locales/de.json` | Rename key + update message text |
| Locale IT | `src/i18n/locales/it.json` | Rename key + update message text |
| UI wizard | `src/components/wizard/Step2WorkloadForm.vue` | Add checkbox for new field |
| Validation tests | `src/engine/validation.test.ts` | Rename describe block + update 6 test cases, add 1 new test |
| PPTX fixture | `src/composables/__tests__/usePptxExport.test.ts` | Add field to `makeClusterConfig` fixture |

---

## Architecture Patterns

### How the existing WARN-02 guard works

`src/engine/validation.ts` lines 37–46 (confirmed by direct read):

```typescript
// Current (WRONG — fires even when non-ODF RWX storage is present)
if (config.addOns.virtEnabled && !config.addOns.odfEnabled && config.topology !== 'sno') {
  warnings.push({
    code: 'VIRT_RWX_REQUIRES_ODF',
    severity: 'warning',
    messageKey: 'warnings.virt.rwxRequiresOdf',
  })
}
```

**Target guard (CORRECT):**

```typescript
// WARN-04: live migration requires RWX storage — ODF OR any other RWX class
if (
  config.addOns.virtEnabled &&
  !config.addOns.odfEnabled &&
  !config.addOns.rwxStorageAvailable &&
  config.topology !== 'sno'
) {
  warnings.push({
    code: 'VIRT_RWX_STORAGE_REQUIRED',
    severity: 'warning',
    messageKey: 'warnings.virt.rwxStorageRequired',
  })
}
```

The SNO suppression logic (line 50 onward) is unchanged.

### How boolean add-on fields are wired end-to-end

Pattern from `odfEnabled` (the reference implementation):

1. **`engine/types.ts`** — field declared in `AddOnConfig` interface
2. **`engine/defaults.ts`** — field initialised in `createDefaultClusterConfig` (`addOns: { ..., odfEnabled: false }`)
3. **`composables/useUrlState.ts`** — field declared in `AddOnConfigSchema` Zod object with `.default(false)`; for v2.0 backward compat use `.optional().default(false)` so existing URLs without the field deserialise cleanly
4. **`components/wizard/Step2WorkloadForm.vue`** — `addOnField('odfEnabled')` computed, bound to a checkbox `@change` handler
5. **`engine/validation.ts`** — guard reads `config.addOns.odfEnabled`

`rwxStorageAvailable` follows the exact same path. No store changes needed: `inputStore.ts` uses `ClusterConfig` directly from `engine/types.ts` so the new field is automatically available once the interface is updated.

### Locale key structure

The i18n key `warnings.virt.rwxRequiresOdf` lives inside the `warnings.virt` namespace in all four locale files. The rename target is `warnings.virt.rwxStorageRequired`. The old sub-key `rwxRequiresOdf` must be removed and `rwxStorageRequired` added.

### Test fixture pattern in usePptxExport.test.ts

`makeClusterConfig()` in `src/composables/__tests__/usePptxExport.test.ts` constructs a full inline `AddOnConfig` literal (confirmed lines 22–41 by direct read). When `rwxStorageAvailable` is added to the `AddOnConfig` interface, TypeScript will report an error unless the fixture also includes the new field. It must be added as `rwxStorageAvailable: false`.

---

## Complete Enumeration of All Locations to Change

### Source files

| File | Line(s) | What changes |
|------|---------|--------------|
| `src/engine/types.ts` | After `rhoaiEnabled` (line 53) | Add `rwxStorageAvailable: boolean` |
| `src/engine/defaults.ts` | `addOns` object (line 41 area) | Add `rwxStorageAvailable: false` |
| `src/engine/validation.ts` | Lines 40–46 | Update guard condition; rename `VIRT_RWX_REQUIRES_ODF` → `VIRT_RWX_STORAGE_REQUIRED`; rename `warnings.virt.rwxRequiresOdf` → `warnings.virt.rwxStorageRequired` |
| `src/composables/useUrlState.ts` | `AddOnConfigSchema` after `rhoaiEnabled` (line 43) | Add `rwxStorageAvailable: z.boolean().optional().default(false)` |
| `src/components/wizard/Step2WorkloadForm.vue` | After `virtEnabled` setup (line 49) | Add `const rwxStorageAvailable = addOnField('rwxStorageAvailable')` and checkbox in template |
| `src/composables/__tests__/usePptxExport.test.ts` | `makeClusterConfig` fixture (line 41) | Add `rwxStorageAvailable: false` to `addOns` literal |

### Locale files — key rename in `warnings.virt`

| File | Old key | New key | New message |
|------|---------|---------|-------------|
| `src/i18n/locales/en.json` | `rwxRequiresOdf` | `rwxStorageRequired` | "OpenShift Virtualization requires RWX-capable storage for live migration. Configure ODF or another RWX storage class to enable live migration." |
| `src/i18n/locales/fr.json` | `rwxRequiresOdf` | `rwxStorageRequired` | "OpenShift Virtualization nécessite un stockage compatible RWX pour la migration en direct. Configurez ODF ou une autre classe de stockage RWX pour activer la migration en direct." |
| `src/i18n/locales/de.json` | `rwxRequiresOdf` | `rwxStorageRequired` | "OpenShift Virtualization benötigt RWX-fähigen Speicher für die Live-Migration. Konfigurieren Sie ODF oder eine andere RWX-Speicherklasse, um die Live-Migration zu aktivieren." |
| `src/i18n/locales/it.json` | `rwxRequiresOdf` | `rwxStorageRequired` | "OpenShift Virtualization richiede storage compatibile RWX per la migrazione live. Configurare ODF o un'altra classe di storage RWX per abilitare la migrazione live." |

### Test file — validation.test.ts

The describe block `'WARN-02: VIRT_RWX_REQUIRES_ODF'` (line 56) must be replaced with a new describe block `'WARN-04/05: VIRT_RWX_STORAGE_REQUIRED'`. Changes:

| Test | What changes |
|------|-------------|
| "emits warning when virtEnabled=true, odfEnabled=false, topology=standard-ha" | Add `config.addOns.rwxStorageAvailable = false`; change assertion to `w.code === 'VIRT_RWX_STORAGE_REQUIRED'` |
| "no warning when virtEnabled=true and odfEnabled=true" | Change assertion to check `'VIRT_RWX_STORAGE_REQUIRED'` |
| "no warning when virtEnabled=false" | Change assertion to check `'VIRT_RWX_STORAGE_REQUIRED'` |
| "suppresses ... for SNO topology" | Change assertions from `'VIRT_RWX_REQUIRES_ODF'` to `'VIRT_RWX_STORAGE_REQUIRED'` |
| NEW: "no warning when virtEnabled=true, odfEnabled=false, but rwxStorageAvailable=true" | Add new test case for non-ODF RWX path (WARN-04 second bullet) |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Backward-compat URL deserialization | Custom migration code | Zod `.optional().default(false)` | Zod drops unknown fields with `.strip()` and fills missing fields with defaults in one parse call |
| Locale sync across 4 files | Script to check key parity | Manual edit — 4 files, 1 key change each | Trivial scope, no tooling needed |

---

## Common Pitfalls

### Pitfall 1: TypeScript strict mode catches incomplete fixture objects
**What goes wrong:** Adding `rwxStorageAvailable` to `AddOnConfig` interface causes TypeScript errors in any file that constructs a literal `AddOnConfig` object without the new field.
**Why it happens:** `tsconfig` uses `strict: true`; missing required properties are compile errors.
**How to avoid:** Search all test fixtures that inline `AddOnConfig` literals. Confirmed locations: `usePptxExport.test.ts` `makeClusterConfig` function. The `createDefaultClusterConfig` factory in `defaults.ts` must also be updated.
**Warning signs:** `rtk tsc` errors mentioning "Property 'rwxStorageAvailable' is missing in type".

### Pitfall 2: Old messageKey key name left in validation.ts
**What goes wrong:** Validation emits `warnings.virt.rwxRequiresOdf` but locale files only have `warnings.virt.rwxStorageRequired` — warning banner shows raw key string.
**Why it happens:** Rename in validation.ts and locale files must be done atomically.
**How to avoid:** Change messageKey in validation.ts to `'warnings.virt.rwxStorageRequired'` in the same commit/plan as the locale key rename.

### Pitfall 3: Zod `.strip()` drops new field if not declared in schema
**What goes wrong:** URL state deserialization silently strips `rwxStorageAvailable` because it is not in `AddOnConfigSchema`, reverting it to undefined in the hydrated store.
**Why it happens:** `AddOnConfigSchema` uses `.strip()` — undeclared fields are removed.
**How to avoid:** Add `rwxStorageAvailable: z.boolean().optional().default(false)` to `AddOnConfigSchema` before any URL hydration test.

### Pitfall 4: SNO suppression logic must remain unchanged
**What goes wrong:** Touching lines 50–56 of validation.ts accidentally modifies the SNO live migration suppression.
**Why it happens:** The two `if` blocks are adjacent.
**How to avoid:** Only modify lines 37–46 (the WARN-02 block). Leave lines 50 onward untouched.

### Pitfall 5: addOnField type casting
**What goes wrong:** `addOnField('rwxStorageAvailable')` returns `computed<boolean | number>` — the checkbox `@change` handler must cast to `boolean`, same as `odfEnabled`.
**Why it happens:** `addOnField` is typed as `computed<boolean | number>` to handle both field types.
**How to avoid:** Use same pattern as existing checkboxes: `@change="rwxStorageAvailable = ($event.target as HTMLInputElement).checked"`.

---

## Code Examples

### Adding a boolean field to AddOnConfig (reference: odfEnabled pattern)

```typescript
// src/engine/types.ts — AddOnConfig interface
export interface AddOnConfig {
  odfEnabled: boolean         // existing
  // ... existing fields ...
  rhoaiEnabled: boolean       // existing (last field)
  // Phase 14: non-ODF RWX storage available for live migration
  rwxStorageAvailable: boolean  // default false
}
```

```typescript
// src/engine/defaults.ts — createDefaultClusterConfig
addOns: {
  // ... existing fields ...
  rhoaiEnabled: false,
  // Phase 14: non-ODF RWX storage
  rwxStorageAvailable: false,
},
```

```typescript
// src/composables/useUrlState.ts — AddOnConfigSchema
const AddOnConfigSchema = z.object({
  // ... existing fields ...
  rhoaiEnabled: z.boolean().default(false),
  // Phase 14: .optional().default() for v2.0 URL backward compat (STATE.md WARN-02 note)
  rwxStorageAvailable: z.boolean().optional().default(false),
}).strip()
```

### Updated validation guard

```typescript
// src/engine/validation.ts — WARN-04
// WARN-04: RWX storage required for live migration — ODF or any RWX storage class satisfies this.
if (
  config.addOns.virtEnabled &&
  !config.addOns.odfEnabled &&
  !config.addOns.rwxStorageAvailable &&
  config.topology !== 'sno'
) {
  warnings.push({
    code: 'VIRT_RWX_STORAGE_REQUIRED',
    severity: 'warning',
    messageKey: 'warnings.virt.rwxStorageRequired',
  })
}
```

### Checkbox pattern in Step2WorkloadForm.vue (reference: odfEnabled)

```vue
<!-- src/components/wizard/Step2WorkloadForm.vue — script setup addition -->
const rwxStorageAvailable = addOnField('rwxStorageAvailable')

<!-- template addition (show only when virtEnabled, placed after virtEnabled checkbox) -->
<div v-if="virtEnabled" class="ml-6 mt-2">
  <label class="flex items-center gap-2 cursor-pointer">
    <input
      type="checkbox"
      :checked="rwxStorageAvailable as boolean"
      :aria-label="t('workload.rwxStorageAvailable')"
      class="w-4 h-4 accent-blue-600"
      @change="rwxStorageAvailable = ($event.target as HTMLInputElement).checked"
    />
    <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('workload.rwxStorageAvailable') }}</span>
  </label>
</div>
```

A new i18n key `workload.rwxStorageAvailable` is needed in all four locale files (e.g. EN: "Non-ODF RWX Storage Class Available").

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| VIRT_RWX_REQUIRES_ODF (ODF-specific guard) | VIRT_RWX_STORAGE_REQUIRED (any-RWX guard) | Eliminates false positives for users with NFS/Longhorn/other RWX classes |

**Backward compatibility note (from STATE.md):**
> WARN-02 backward compat: v2.0 sessions lack `rwxStorageAvailable` — Zod schema must use `.optional().default(false)`

This is pre-decided. The `.optional().default(false)` pattern ensures existing v2.0 URL-encoded sessions deserialise without error, defaulting to `rwxStorageAvailable=false` (conservative — will show warning until user explicitly sets the field).

---

## Open Questions

1. **UI label for rwxStorageAvailable**
   - What we know: existing checkboxes use short i18n labels from the `workload.*` namespace
   - What's unclear: exact English wording for the new checkbox — "Non-ODF RWX Storage Available" vs "RWX Storage Class Configured" vs "Other RWX Storage Available"
   - Recommendation: use "RWX Storage Class Available (non-ODF)" for clarity; planner may refine

2. **Conditional display of rwxStorageAvailable checkbox**
   - What we know: the checkbox only matters when `virtEnabled=true` and `odfEnabled=false`
   - What's unclear: whether to always show it or only reveal it when `virtEnabled && !odfEnabled`
   - Recommendation: show only when `virtEnabled=true` (v-if pattern, same as `rhacmManagedClusters` slider) — hides noise when virt is off; both odfEnabled and rwxStorageAvailable are visible when virt is on

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — all changes are code/config edits within the existing project).

---

## Sources

### Primary (HIGH confidence)
- Direct file reads: `src/engine/validation.ts`, `src/engine/types.ts`, `src/engine/defaults.ts`, `src/composables/useUrlState.ts` — confirmed current implementation
- Direct file reads: all 4 locale JSON files — confirmed current key names and message text
- Direct file reads: `src/engine/validation.test.ts` — confirmed all 6 existing test cases
- Direct file reads: `src/composables/__tests__/usePptxExport.test.ts` — confirmed `makeClusterConfig` fixture structure
- Direct file reads: `src/components/wizard/Step2WorkloadForm.vue` — confirmed `addOnField` pattern
- `.planning/STATE.md` — confirmed Zod backward-compat requirement for new field

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` WARN-04/WARN-05 definitions — requirements text
- `.planning/ROADMAP.md` Phase 14 success criteria — success criteria enumeration

---

## Metadata

**Confidence breakdown:**
- All touched files: HIGH — confirmed by direct read, no inference
- Architecture patterns: HIGH — reference implementation (odfEnabled) is identical pattern
- Locale message text: MEDIUM — English provided, translations are suggested; planner/implementer should verify tone matches existing locale style
- Test case scope: HIGH — all 6 existing tests enumerated, new test case identified

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable codebase, no external API dependencies)
