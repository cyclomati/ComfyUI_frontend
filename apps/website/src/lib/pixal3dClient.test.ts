import { describe, expect, it, vi } from 'vitest'

import { runPixal3d } from './pixal3dClient'

const workflow = {
  '356': { class_type: 'Save3DAdvanced', inputs: {} },
  '357': { class_type: 'LoadImage', inputs: { image: 'old.png' } }
}

describe('runPixal3d', () => {
  it('uploads the image, updates the workflow, and returns the GLB', async () => {
    const requests: Array<[RequestInfo | URL, RequestInit | undefined]> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        requests.push([url, init])
        if (url === '/pixal3d-api/api/v2/assets') {
          return Response.json({ id: 'asset-1', hash: 'blake3:abc' })
        }
        if (url === '/assets/models-v2/pixal3d-trellis2/pixal3d_api.json') {
          return Response.json(workflow)
        }
        if (url === '/pixal3d-api/api/v2/jobs') {
          return Response.json({
            id: 'job-1',
            status: 'succeeded',
            outputs: [
              {
                node_id: 356,
                id: 'output-1',
                name: 'result.glb',
                url: 'https://output.test/result.glb'
              }
            ]
          })
        }
        return new Response(null, { status: 404 })
      })
    )

    const result = await runPixal3d({
      name: 'input.png',
      source: new File(['image'], 'input.png', { type: 'image/png' })
    })

    const upload = requests[0][1]?.body
    if (!(upload instanceof FormData))
      throw new Error('Expected an upload form')
    expect([...upload.keys()]).toEqual(['content_type', 'file_path', 'file'])
    expect(upload.get('file_path')).toBe('input.png')

    const submission: unknown = JSON.parse(String(requests[2][1]?.body))
    expect(submission).toMatchObject({
      workflow: {
        '357': {
          inputs: {
            image: {
              __type: 'core/ASSET',
              info: {
                id: 'asset-1',
                hash: 'blake3:abc',
                file_path: 'input.png'
              }
            }
          }
        }
      }
    })
    expect(result).toEqual({
      jobId: 'job-1',
      outputName: 'result.glb',
      outputUrl: '/pixal3d-api/api/v2/assets/output-1/content'
    })
  })

  it('accepts a string output node ID', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL) => {
        if (url === '/pixal3d-api/api/v2/assets') {
          return Response.json({ id: 'asset-1' })
        }
        if (url === '/assets/models-v2/pixal3d-trellis2/pixal3d_api.json') {
          return Response.json(workflow)
        }
        return Response.json({
          id: 'job-1',
          status: 'succeeded',
          outputs: [
            {
              node_id: '356',
              id: 'output-1',
              name: 'result.glb',
              url: 'https://output.test/result.glb'
            }
          ]
        })
      })
    )

    await expect(
      runPixal3d({
        name: 'input.png',
        source: new File(['image'], 'input.png', { type: 'image/png' })
      })
    ).resolves.toMatchObject({
      outputName: 'result.glb',
      outputUrl: '/pixal3d-api/api/v2/assets/output-1/content'
    })
  })

  it('reports live progress events while polling the job', async () => {
    let progressListener: ((event: MessageEvent<string>) => void) | undefined
    const close = vi.fn()
    class FakeEventSource {
      constructor(readonly url: string) {}

      addEventListener(
        type: string,
        listener: (event: MessageEvent<string>) => void
      ) {
        if (type === 'progress') progressListener = listener
      }

      close = close
    }
    vi.stubGlobal('EventSource', FakeEventSource)

    let jobRequests = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL) => {
        if (url === '/pixal3d-api/api/v2/assets') {
          return Response.json({ id: 'asset-1' })
        }
        if (url === '/assets/models-v2/pixal3d-trellis2/pixal3d_api.json') {
          return Response.json(workflow)
        }
        if (url === '/pixal3d-api/api/v2/jobs') {
          return Response.json({ id: 'job-1', status: 'running', outputs: [] })
        }
        jobRequests += 1
        if (jobRequests === 1) {
          return Response.json({
            id: 'job-1',
            status: 'running',
            outputs: [],
            progress: null
          })
        }
        return Response.json({
          id: 'job-1',
          status: 'succeeded',
          outputs: [
            {
              node_id: 356,
              id: 'output-1',
              name: 'result.glb',
              url: 'https://output.test/result.glb'
            }
          ]
        })
      })
    )
    const onProgress = vi.fn()

    const result = runPixal3d(
      {
        name: 'input.png',
        source: new File(['image'], 'input.png', { type: 'image/png' })
      },
      onProgress
    )
    await vi.waitFor(() => expect(progressListener).toBeDefined())
    progressListener?.(
      new MessageEvent('progress', {
        data: JSON.stringify({ value: 0.42, nodes_done: 11, nodes_total: 31 })
      })
    )

    await expect(result).resolves.toMatchObject({ jobId: 'job-1' })
    expect(onProgress).toHaveBeenCalledWith({ status: 'running', value: 0.42 })
    const values = onProgress.mock.calls.map(([progress]) => progress.value)
    expect(values).toEqual([...values].sort((a, b) => a - b))
    expect(jobRequests).toBe(2)
    expect(close).toHaveBeenCalledOnce()
  })

  it('reports a failed job', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL) => {
        if (url === '/pixal3d-api/api/v2/assets') {
          return Response.json({ id: 'asset-1' })
        }
        if (url === '/assets/models-v2/pixal3d-trellis2/pixal3d_api.json') {
          return Response.json(workflow)
        }
        return Response.json({
          id: 'job-1',
          status: 'failed',
          outputs: [],
          error: { message: 'Model failed to load' }
        })
      })
    )

    await expect(
      runPixal3d({
        name: 'input.png',
        source: new File(['image'], 'input.png', { type: 'image/png' })
      })
    ).rejects.toThrow('Model failed to load')
  })
})
