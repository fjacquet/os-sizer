import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('engine zero-Vue-import constraint (ENG-09)', () => {
  it.todo('no engine .ts file imports from vue, pinia, or vue-i18n')
})
