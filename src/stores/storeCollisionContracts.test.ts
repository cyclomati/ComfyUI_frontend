import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { attachNodeToStores } from '@/core/graph/nodeShell/nodeShellLifecycle'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import type { GraphScope } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import type { LinkTopology } from '@/types/linkTopology'
import { toNodeId } from '@/types/nodeId'
import type { NodeState } from '@/types/nodeState'
import type { RerouteChain } from '@/types/rerouteChain'
import { toRerouteId } from '@/types/rerouteId'
import { widgetId } from '@/types/widgetId'
import { createNodeState } from '@/utils/__tests__/litegraphTestUtils'
import type { UUID } from '@/utils/uuid'

import { useLinkStore } from './linkStore'
import { useNodeDataStore } from './nodeDataStore'
import { useRerouteStore } from './rerouteStore'
import { useWidgetValueStore } from './widgetValueStore'

/**
 * Invariant suite pinning the entity-store collision contracts so they cannot
 * silently drift. The contract axis (ADR-0003 §Amendment, ADR-0008,
 * docs/architecture/node-data-store.md):
 *
 * - Identity-keyed stores — nodeDataStore (NodeId), linkStore (LinkId),
 *   rerouteStore (RerouteId) — hold app-minted ids. A collision there is two
 *   different entities claiming one name, so the store REJECTS,
 *   side-effect-free, and the caller resolves (LGraph.add remints via
 *   attachNodeToStores). Merging would silently hand one entity's
 *   links/widget state to another.
 * - The structural-keyed store — widgetValueStore
 *   (graphId:nodeId:name position keys) — RESOLVES: same position + same
 *   type IS the same logical slot, so the incumbent is reused (widget values
 *   survive node replacement); a type mismatch means a different widget now
 *   occupies the position, so the newcomer overwrites — and only then.
 *
 * A uniform rule was deliberately rejected: resolve-everywhere lets a
 * colliding node steal an incumbent's state; reject-everywhere strands widget
 * values that position keys legitimately recycle on reload/paste/replace.
 * If one of these tests blocks a change, the contract itself is being
 * changed: update the ADRs and the contract documentation with it.
 */

const rootA: UUID = 'root-a'

function scope(rootGraphId: UUID, owningGraphId: UUID): GraphScope {
  return {
    rootGraphId: toRootGraphId(rootGraphId),
    owningGraphId: toOwningGraphId(owningGraphId)
  }
}

const scopeA = scope(rootA, rootA)

function nodeState(id: number, title: string): NodeState {
  return createNodeState({ id: toNodeId(id), graphId: rootA, title })
}

function linkTopology(
  id: number,
  originNode: number,
  originSlot: number,
  targetNode: number,
  targetSlot: number
): LinkTopology {
  return {
    id: toLinkId(id),
    graphId: scopeA.owningGraphId,
    originNodeId: toNodeId(originNode),
    originSlot,
    targetNodeId: toNodeId(targetNode),
    targetSlot,
    type: 'INT'
  }
}

function chain(id: number, parentId?: number): RerouteChain {
  return {
    id: toRerouteId(id),
    graphId: scopeA.owningGraphId,
    parentId: parentId === undefined ? undefined : toRerouteId(parentId)
  }
}

describe('store collision contracts (identity keys reject, structural keys resolve)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  describe('identity-keyed stores reject on collision', () => {
    it('nodeDataStore: re-registering the registered identity returns the incumbent', () => {
      const store = useNodeDataStore()
      const state = nodeState(1, 'Incumbent')
      const registered = store.registerNode(scopeA, state)
      assert(registered)

      expect(store.registerNode(scopeA, registered)).toBe(registered)
      expect(store.getGraphNodesFor(rootA, rootA)).toHaveLength(1)
    })

    it('nodeDataStore: a different identity claiming a registered id is rejected without touching the incumbent', () => {
      const store = useNodeDataStore()
      const incumbent = store.registerNode(scopeA, nodeState(1, 'Incumbent'))
      assert(incumbent)

      const usurper = nodeState(1, 'Usurper')
      expect(store.registerNode(scopeA, usurper)).toBeUndefined()

      expect(incumbent.title).toBe('Incumbent')
      expect(store.getGraphNodesFor(rootA, rootA)).toHaveLength(1)
      expect(store.ownsNode(scopeA, usurper)).toBe(false)
      expect(store.deleteNode(scopeA, usurper)).toBe(false)
    })

    it('nodeDataStore: a rejected registration writes nothing to any store', () => {
      const nodeDataStore = useNodeDataStore()
      const widgetValueStore = useWidgetValueStore()
      const linkStore = useLinkStore()
      const rerouteStore = useRerouteStore()
      assert(nodeDataStore.registerNode(scopeA, nodeState(1, 'Incumbent')))

      expect(
        nodeDataStore.registerNode(scopeA, nodeState(1, 'Usurper'))
      ).toBeUndefined()

      expect(nodeDataStore.getGraphNodesFor(rootA, rootA)).toHaveLength(1)
      expect(widgetValueStore.getNodeWidgetIds(rootA, toNodeId(1))).toEqual([])
      expect([...linkStore.graphTopologies(scopeA)]).toEqual([])
      expect(rerouteStore.getReroute(scopeA, toRerouteId(1))).toBeUndefined()
    })

    it('linkStore: the first registration wins per link id and target input slot', () => {
      const store = useLinkStore()
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const incumbent = store.registerLink(scopeA, linkTopology(1, 5, 0, 9, 2))
      assert(incumbent)

      // Contested target slot: a different link id aiming at the same input.
      expect(
        store.registerLink(scopeA, linkTopology(2, 6, 0, 9, 2))
      ).toBeUndefined()
      // Contested identity: a different topology claiming the registered id.
      expect(
        store.registerLink(scopeA, linkTopology(1, 7, 0, 8, 1))
      ).toBeUndefined()

      expect(store.getInputSlotLink(scopeA, toNodeId(9), 2)).toBe(incumbent)
      expect([...store.graphTopologies(scopeA)]).toHaveLength(1)
      expect(consoleError).toHaveBeenCalled()
    })

    it('rerouteStore: the first registration wins per chain id', () => {
      const store = useRerouteStore()
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const incumbent = store.registerReroute(scopeA, chain(1))
      assert(incumbent)

      expect(store.registerReroute(scopeA, incumbent)).toBe(incumbent)
      expect(store.registerReroute(scopeA, chain(1, 7))).toBeUndefined()

      expect(store.getReroute(scopeA, toRerouteId(1))).toBe(incumbent)
      expect(incumbent.parentId).toBeUndefined()
    })
  })

  describe('structural-keyed widgetValueStore resolves on collision', () => {
    const seed = widgetId(rootA, toNodeId('node-1'), 'seed')

    it('same-type re-registration returns the incumbent, so live values survive node replacement', () => {
      const store = useWidgetValueStore()
      const incumbent = store.registerWidget<number>(seed, {
        type: 'number',
        value: 11,
        options: {}
      })
      assert(incumbent)
      incumbent.value = 99

      const reRegistered = store.registerWidget<number>(seed, {
        type: 'number',
        value: 11,
        options: {}
      })

      expect(reRegistered).toBe(incumbent)
      expect(store.getWidget(seed)?.value).toBe(99)
    })

    it('a type mismatch overwrites the stale entry — and only a mismatch does', () => {
      const store = useWidgetValueStore()
      const incumbent = store.registerWidget<number>(seed, {
        type: 'number',
        value: 5,
        options: {}
      })
      assert(incumbent)
      incumbent.value = 42

      // Same type, different init value: the incumbent still wins.
      store.registerWidget(seed, { type: 'number', value: 7, options: {} })
      expect(store.getWidget(seed)?.value).toBe(42)

      // Different type: the position now holds a different widget, so the
      // newcomer wins.
      const overwritten = store.registerWidget(seed, {
        type: 'string',
        value: 'hello',
        options: {}
      })
      expect(overwritten?.type).toBe('string')
      expect(store.getWidget(seed)?.value).toBe('hello')
    })
  })

  describe('LGraph.add remint path (the caller-side resolution of an identity rejection)', () => {
    it('remints a newcomer that collides with a registered id, leaving the incumbent untouched', () => {
      const graph = new LGraph()
      const incumbent = new LGraphNode('Incumbent')
      graph.add(incumbent)
      const takenId = incumbent.id

      const newcomer = new LGraphNode('Newcomer')
      newcomer.id = takenId
      graph.add(newcomer)

      expect(newcomer.id).not.toBe(takenId)
      expect(graph.getNodeById(takenId)).toBe(incumbent)
      expect(graph.getNodeById(newcomer.id)).toBe(newcomer)
      expect(incumbent.title).toBe('Incumbent')
      expect(
        useNodeDataStore().getGraphNodesFor(graph.id, graph.id)
      ).toHaveLength(2)
    })

    it('re-attaching the already-registered instance keeps its id without minting', () => {
      const graph = new LGraph()
      const node = new LGraphNode('Incumbent')
      graph.add(node)
      const registeredId = node.id

      const mintId = vi.fn(() => {
        throw new Error('re-attaching the incumbent must not mint an id')
      })
      attachNodeToStores(graph, node, mintId)

      expect(mintId).not.toHaveBeenCalled()
      expect(node.id).toBe(registeredId)
      expect(
        useNodeDataStore().getGraphNodesFor(graph.id, graph.id)
      ).toHaveLength(1)
    })

    // Pending #15720 (D-dq-04 bundle): the remint loop in attachNodeToStores
    // gains a console.warn naming the collided id, the reminted id, AND
    // graph.rootGraph.id, so a silent remint cannot strand serialized
    // references (links keyed on the old id) without a trace. Activate this
    // test when #15720 lands.
    it.todo(
      'a collision remint warns with both ids and the root graph id (#15720)'
    )
  })
})
