import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

describe('LiteGraphCanvasSplitterOverlay', () => {
  it('graph-canvas-panel has overflow-visible to prevent clipping toolbar on mobile', () => {
    const filePath = resolve(__dirname, 'LiteGraphCanvasSplitterOverlay.vue')
    const source = readFileSync(filePath, 'utf-8')

    expect(source).toMatch(
      /class="[^"]*graph-canvas-panel[^"]*overflow-visible/
    )
  })
})
