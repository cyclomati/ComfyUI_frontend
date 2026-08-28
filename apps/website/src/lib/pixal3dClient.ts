import {
  loadPixal3dWorkflow,
  PIXAL3D_OUTPUT_NODE_ID,
  setPixal3dImage
} from './pixal3dWorkflow'

const API_ROOT = '/pixal3d-api/api/v2'
const TERMINAL_STATUSES = new Set([
  'succeeded',
  'canceled',
  'failed',
  'expired'
])

export type Pixal3dImage = {
  name: string
  source: File | string
}

type Pixal3dProgress = {
  status: string
  value: number | null
}

type Pixal3dResult = {
  jobId: string
  outputName: string
  outputUrl: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function errorMessage(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null)
  if (isRecord(body) && isRecord(body.error)) {
    const message = body.error.message
    if (typeof message === 'string') return message
  }
  return `Comfy API request failed (${response.status})`
}

async function requestJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init)
  if (!response.ok) throw new Error(await errorMessage(response))
  return response.json()
}

async function resolveImage(image: Pixal3dImage): Promise<File> {
  if (image.source instanceof File) return image.source

  const response = await fetch(image.source)
  if (!response.ok) {
    throw new Error(`Failed to load example image (${response.status})`)
  }
  const blob = await response.blob()
  return new File([blob], image.name, { type: blob.type })
}

async function uploadImage(file: File) {
  const form = new FormData()
  form.append('content_type', file.type || 'application/octet-stream')
  form.append('file_path', file.name)
  form.append('file', file, file.name)

  const asset = await requestJson(`${API_ROOT}/assets`, {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: form
  })
  if (!isRecord(asset) || typeof asset.id !== 'string') {
    throw new Error('Comfy API returned an invalid asset')
  }

  const info: Record<string, unknown> = {
    id: asset.id,
    file_path: file.name
  }
  if (typeof asset.hash === 'string') info.hash = asset.hash
  return { __type: 'core/ASSET', info }
}

function readJob(value: unknown) {
  if (!isRecord(value) || typeof value.id !== 'string') {
    throw new Error('Comfy API returned an invalid job')
  }
  if (typeof value.status !== 'string' || !Array.isArray(value.outputs)) {
    throw new Error('Comfy API returned an invalid job')
  }
  return value
}

function jobId(job: Record<string, unknown>) {
  const id = job.id
  if (typeof id !== 'string')
    throw new Error('Comfy API returned an invalid job')
  return id
}

function jobStatus(job: Record<string, unknown>) {
  const status = job.status
  if (typeof status !== 'string') {
    throw new Error('Comfy API returned an invalid job')
  }
  return status
}

function progressValue(job: Record<string, unknown>) {
  if (!isRecord(job.progress)) return null
  return typeof job.progress.value === 'number' ? job.progress.value : null
}

function eventData(event: MessageEvent<string>): unknown {
  try {
    return JSON.parse(event.data)
  } catch {
    return null
  }
}

function watchJobProgress(
  id: string,
  onProgress: ((progress: Pixal3dProgress) => void) | undefined
) {
  if (!onProgress || typeof EventSource === 'undefined') return () => {}

  const events = new EventSource(
    `${API_ROOT}/jobs/${encodeURIComponent(id)}/events`
  )

  function onProgressEvent(event: MessageEvent<string>) {
    const progress = eventData(event)
    if (!isRecord(progress) || typeof progress.value !== 'number') return
    onProgress?.({ status: 'running', value: progress.value })
  }

  function onStatusEvent(event: MessageEvent<string>) {
    const snapshot = eventData(event)
    if (!isRecord(snapshot) || typeof snapshot.status !== 'string') return
    onProgress?.({
      status: snapshot.status,
      value: progressValue(snapshot)
    })
  }

  events.addEventListener('progress', onProgressEvent)
  events.addEventListener('status', onStatusEvent)
  return () => events.close()
}

function outputResult(job: Record<string, unknown>): Pixal3dResult {
  const outputs = job.outputs
  if (!Array.isArray(outputs)) {
    throw new Error('Comfy API returned an invalid job')
  }
  const output = outputs.find(
    (candidate) =>
      isRecord(candidate) &&
      String(candidate.node_id) === PIXAL3D_OUTPUT_NODE_ID
  )
  if (
    !isRecord(output) ||
    typeof output.id !== 'string' ||
    typeof output.name !== 'string' ||
    typeof output.url !== 'string'
  ) {
    throw new Error('Pixal3D completed without a GLB output')
  }

  return {
    jobId: jobId(job),
    outputName: output.name,
    outputUrl: `${API_ROOT}/assets/${encodeURIComponent(output.id)}/content`
  }
}

function wait(delay: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, delay))
}

export async function runPixal3d(
  image: Pixal3dImage,
  onProgress?: (progress: Pixal3dProgress) => void
): Promise<Pixal3dResult> {
  let lastProgress = 0.05
  function reportProgress(progress: Pixal3dProgress) {
    if (progress.value !== null) {
      lastProgress = Math.max(lastProgress, progress.value)
    }
    onProgress?.({ status: progress.status, value: lastProgress })
  }

  reportProgress({ status: 'uploading', value: 0.05 })
  const file = await resolveImage(image)
  const asset = await uploadImage(file)
  reportProgress({ status: 'submitting', value: 0.05 })
  const workflow = setPixal3dImage(await loadPixal3dWorkflow(), asset)
  let job = readJob(
    await requestJson(`${API_ROOT}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID()
      },
      body: JSON.stringify({ workflow })
    })
  )

  const stopWatchingProgress = watchJobProgress(
    jobId(job),
    onProgress ? reportProgress : undefined
  )
  let delay = 500
  try {
    while (!TERMINAL_STATUSES.has(jobStatus(job))) {
      job = readJob(await requestJson(`${API_ROOT}/jobs/${jobId(job)}`))
      reportProgress({
        status: jobStatus(job),
        value: progressValue(job)
      })
      if (TERMINAL_STATUSES.has(jobStatus(job))) break
      await wait(delay)
      delay = Math.min(delay * 1.5, 5000)
    }
  } finally {
    stopWatchingProgress()
  }

  if (jobStatus(job) !== 'succeeded') {
    const message =
      isRecord(job.error) && typeof job.error.message === 'string'
        ? job.error.message
        : `Pixal3D job ended ${jobStatus(job)}`
    throw new Error(message)
  }
  reportProgress({ status: jobStatus(job), value: 1 })
  return outputResult(job)
}
