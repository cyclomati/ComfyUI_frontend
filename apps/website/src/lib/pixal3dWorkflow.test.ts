import { describe, expect, it, vi } from 'vitest'

import { loadPixal3dWorkflow, setPixal3dImage } from './pixal3dWorkflow'

const workflow = {
  '356': { class_type: 'Save3DAdvanced', inputs: {} },
  '357': {
    class_type: 'LoadImage',
    inputs: { image: 'example.png' }
  }
}

describe('Pixal3D workflow', () => {
  it('loads the API workflow and replaces its image without mutating it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(workflow), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    )

    const loaded = await loadPixal3dWorkflow()
    const image = { __type: 'core/ASSET', info: { id: 'asset-id' } }
    const updated = setPixal3dImage(loaded, image)

    expect(updated['357']).toEqual({
      class_type: 'LoadImage',
      inputs: { image }
    })
    expect(loaded['357']).toEqual(workflow['357'])
  })

  it('rejects a workflow without the expected output node', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            '357': { class_type: 'LoadImage', inputs: {} }
          })
        )
      )
    )

    await expect(loadPixal3dWorkflow()).rejects.toThrow(
      'Pixal3D workflow is missing Save3DAdvanced node 356'
    )
  })
})
