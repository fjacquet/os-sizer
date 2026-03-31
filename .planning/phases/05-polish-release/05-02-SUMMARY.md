---
phase: 05-polish-release
plan: 02
subsystem: i18n
tags: [i18n, locales, QA, French, German, Italian, Swiss]
dependency_graph:
  requires: []
  provides: [verified-locale-files]
  affects: [all-UI-components]
tech_stack:
  added: []
  patterns: [vue-i18n, Swiss locale conventions]
key_files:
  created: []
  modified:
    - src/i18n/locales/fr.json
    - src/i18n/locales/de.json
    - src/i18n/locales/it.json
decisions:
  - Swiss German uses proper umlauts (ä, ö, ü) throughout — only eszett (ß) is forbidden; corrected prior ASCII workarounds
  - French nœud ligature used consistently for "nœuds" throughout FR locale
  - Italian "è" copula used in validation strings for grammatical correctness
metrics:
  duration: ~15 min
  completed: "2026-03-31"
  tasks: 2
  files_modified: 3
---

# Phase 05 Plan 02: i18n Locale QA Summary

Full QA pass on all 4 i18n locale files — fixing accent/umlaut inconsistencies across FR, DE, and IT locales while verifying key completeness and build integrity.

## What Was Done

### Task 1: Automated key completeness and empty-value audit

Ran key completeness verification script across all 4 locale files. Result: all locales had identical key sets with zero missing keys and zero empty values from the start.

Discovered a **consistency issue**: earlier locale sections used ASCII transliterations (no diacritics) while later validation sections used proper Unicode accents. This affected all 3 non-EN locales.

Fixed all three locale files to use proper Unicode characters throughout:

**French (fr.json):**
- "Noeuds" → "Nœuds" (proper ligature, used throughout)
- "heberges" → "hébergés", "controle" → "contrôle"
- "selectionner" → "sélectionner", "Precedent" → "Précédent"
- "Resultats" → "Résultats", "Peripherie" → "Périphérie"
- "Connectivite" → "Connectivité", "disponibilite" → "disponibilité"
- "Genere" → "Généré", "Copie" → "Copié", "Telecharger" → "Télécharger"
- "Generation" → "Génération", "Apercu" → "Aperçu"

**German (de.json):**
- "waehlen" → "wählen", "bestaetigen" → "bestätigen"
- "ueberschreiben" → "überschreiben", "Zurueck" → "Zurück"
- "Konnektivitaet" → "Konnektivität", "Hochverfuegbarkeit" → "Hochverfügbarkeit"
- "Stueckliste" → "Stückliste", "Einschraenkungen" → "Einschränkungen"
- "fuer" → "für" (where applicable in recommendation strings)
- "vollstaendiger" → "vollständiger", "ressourcenbeschraenkte" → "ressourcenbeschränkte"
- "unterstuetzt" → "unterstützt", "kostenguenstiger" → "kostengünstiger"
- No eszett characters present (Swiss German compliant)

**Italian (it.json):**
- "Connettivita" → "Connettività"
- "disponibilita" → "disponibilità"
- "Questo campo e obbligatorio" → "Questo campo è obbligatorio"
- "funzionalita" → "funzionalità"
- "Due nodi con arbitro e" → "Due nodi con arbitro è"
- "Alta Disponibilita" → "Alta Disponibilità"

### Task 2: Grammar, technical accuracy, and consistency review

Verified all translations against OpenShift technical terminology requirements:
- "Control Plane Nodes" → FR: "Nœuds du plan de contrôle" / DE: "Steuerungsebenen-Knoten" / IT: "Nodi del piano di controllo" — all correct
- "Worker Nodes" → FR: "Nœuds de travail" / DE: "Worker-Knoten" / IT: "Nodi worker" — all correct
- "High Availability" → FR: "Haute Disponibilité" / DE: "Hochverfügbarkeit" / IT: "Alta Disponibilità" — all correct
- Technology names (OpenShift, RHACM, ODF, ROSA, ARO, etc.) remain in English — correct

Swiss locale specifics verified:
- DE: Zero eszett characters — all replaced with "ss" equivalent or proper umlauts
- FR: Formal Swiss French register maintained throughout
- IT: Standard formal Italian appropriate for Ticino business documentation

`npm run build` passes with exit 0. All 4 JSON files parse without error.

## Verification Results

```
ALL LOCALES OK: identical key sets, no empty values
FR JSON valid
DE JSON valid
IT JSON valid
EN JSON valid
grep -c 'ß' de.json: 0 (PASS)
npm run build: exit 0
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pervasive accent/umlaut inconsistency across all 3 non-EN locales**
- **Found during:** Task 1
- **Issue:** Earlier sections of FR, DE, and IT locale files used ASCII workarounds (e.g., "waehlen" instead of "wählen", "Noeuds" instead of "Nœuds") while later validation sections used proper Unicode. This inconsistency would render incorrect characters in the UI.
- **Fix:** Applied proper Unicode diacritics throughout all three files for consistency
- **Files modified:** src/i18n/locales/fr.json, src/i18n/locales/de.json, src/i18n/locales/it.json
- **Commit:** 5f8a41c

## Known Stubs

None — all locale keys have proper translated values. No placeholder or TODO text found.

## Self-Check: PASSED

- src/i18n/locales/fr.json: FOUND
- src/i18n/locales/de.json: FOUND
- src/i18n/locales/it.json: FOUND
- Commit 5f8a41c: FOUND
- npm run build: PASSED (exit 0)
- Zero missing keys: VERIFIED
- Zero empty values: VERIFIED
- Zero eszett in de.json: VERIFIED
