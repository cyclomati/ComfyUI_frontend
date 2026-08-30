import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'

import { validateAdrDirectory } from './check-adrs'

const temporaryDirectories: string[] = []

const createFixture = (): string => {
  const directory = join(
    tmpdir(),
    `comfyui-adr-check-${process.pid}-${temporaryDirectories.length}`
  )
  mkdirSync(directory)
  temporaryDirectories.push(directory)
  writeFileSync(
    join(directory, 'ECS-entity-component-system.md'),
    '# ADR-ECS: Entity Component System\n\nDate: 2026-03-23\n\n## Status\n\nProposed\n'
  )
  writeFileSync(
    join(directory, 'README.md'),
    '| [ECS](ECS-entity-component-system.md) | Entity Component System | Proposed | 2026-03-23 |\n'
  )
  return directory
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true })
  }
})

describe('validateAdrDirectory', () => {
  test('accepts identifier-based ADRs with a matching index', () => {
    expect(() => validateAdrDirectory(createFixture())).not.toThrow()
  })

  test('rejects numbered ADR filenames', () => {
    const directory = createFixture()
    writeFileSync(
      join(directory, '0024-new-decision.md'),
      '# 24. New decision\n'
    )

    expect(() => validateAdrDirectory(directory)).toThrow(
      'Invalid ADR filenames'
    )
  })

  test('rejects index metadata that differs from the ADR', () => {
    const directory = createFixture()
    writeFileSync(
      join(directory, 'README.md'),
      '| [ECS](ECS-entity-component-system.md) | Wrong title | Proposed | 2026-03-23 |\n'
    )

    expect(() => validateAdrDirectory(directory)).toThrow(
      'ADR index must contain every ADR exactly once'
    )
  })
})
