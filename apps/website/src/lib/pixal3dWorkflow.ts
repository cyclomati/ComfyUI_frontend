const WORKFLOW_URL = '/assets/models-v2/pixal3d-trellis2/pixal3d_api.json'
const IMAGE_NODE_ID = '357'
const OUTPUT_NODE_ID = '356'

type Workflow = Record<string, unknown>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getNode(workflow: Workflow, id: string, classType: string) {
  const node = workflow[id]
  if (!isRecord(node) || node.class_type !== classType) {
    throw new Error(`Pixal3D workflow is missing ${classType} node ${id}`)
  }
  return node
}

export async function loadPixal3dWorkflow(): Promise<Workflow> {
  const response = await fetch(WORKFLOW_URL)
  if (!response.ok) {
    throw new Error(`Failed to load Pixal3D workflow (${response.status})`)
  }

  const workflow: unknown = await response.json()
  if (!isRecord(workflow)) {
    throw new Error('Pixal3D workflow is not an API-format object')
  }

  getNode(workflow, IMAGE_NODE_ID, 'LoadImage')
  getNode(workflow, OUTPUT_NODE_ID, 'Save3DAdvanced')
  return workflow
}

export function setPixal3dImage(workflow: Workflow, image: unknown): Workflow {
  const imageNode = getNode(workflow, IMAGE_NODE_ID, 'LoadImage')
  if (!isRecord(imageNode.inputs)) {
    throw new Error(`Pixal3D workflow node ${IMAGE_NODE_ID} has no inputs`)
  }

  return {
    ...workflow,
    [IMAGE_NODE_ID]: {
      ...imageNode,
      inputs: { ...imageNode.inputs, image }
    }
  }
}

export { OUTPUT_NODE_ID as PIXAL3D_OUTPUT_NODE_ID }
