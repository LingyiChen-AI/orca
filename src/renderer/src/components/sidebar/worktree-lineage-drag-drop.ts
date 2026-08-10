import type { Worktree, WorktreeLineage } from '../../../../shared/types'
import { getLineageRenderInfo } from './worktree-lineage-projection'

const WORKTREE_CARD_SURFACE_SELECTOR = '[data-worktree-card-surface]'
const WORKTREE_LINEAGE_CHILDREN_SELECTOR =
  '[data-worktree-lineage-children],[data-worktree-legacy-lineage-children]'
const WORKTREE_LINEAGE_DROP_ROW_SELECTOR = '[data-worktree-lineage-drop-id]'

const LINEAGE_REORDER_GUTTER_PX = 8
const LINEAGE_REORDER_GUTTER_RATIO = 0.25

type VerticalRect = Pick<DOMRect, 'top' | 'bottom'>

export function isWorktreeLineageDropZoneHit(args: {
  pointerY: number
  rect: VerticalRect
}): boolean {
  const height = Math.max(0, args.rect.bottom - args.rect.top)
  if (height <= 0) {
    return false
  }

  const gutter = Math.min(LINEAGE_REORDER_GUTTER_PX, height * LINEAGE_REORDER_GUTTER_RATIO)
  const zoneTop = args.rect.top + gutter
  const zoneBottom = args.rect.bottom - gutter
  return args.pointerY >= zoneTop && args.pointerY <= zoneBottom
}

export function getWorktreeLineageDropTargetId(args: {
  container: HTMLElement
  target: Element
  pointerY: number
}): string | null {
  const cardSurface = args.target.closest<HTMLElement>(WORKTREE_CARD_SURFACE_SELECTOR)
  if (!cardSurface || !args.container.contains(cardSurface)) {
    return null
  }

  const lineageChildren = args.target.closest<HTMLElement>(WORKTREE_LINEAGE_CHILDREN_SELECTOR)
  if (
    lineageChildren &&
    lineageChildren.closest<HTMLElement>(WORKTREE_CARD_SURFACE_SELECTOR) === cardSurface
  ) {
    return null
  }

  // Why: surface edges stay reorderable while the owned agent area remains a stable parent target.
  if (
    !isWorktreeLineageDropZoneHit({
      pointerY: args.pointerY,
      rect: cardSurface.getBoundingClientRect()
    })
  ) {
    return null
  }

  const rowTarget = cardSurface.closest<HTMLElement>(WORKTREE_LINEAGE_DROP_ROW_SELECTOR)
  if (!rowTarget || !args.container.contains(rowTarget)) {
    return null
  }
  return rowTarget.getAttribute('data-worktree-lineage-drop-id')
}

export function getTopLevelWorktreeLineageDragIds(args: {
  draggedIds: readonly string[]
  lineageById: Readonly<Record<string, WorktreeLineage>>
  worktreeMap: ReadonlyMap<string, Worktree>
  cyclicLineageIds: ReadonlySet<string>
}): string[] {
  const selectedIds = new Set(args.draggedIds)
  const included = new Set<string>()
  const roots: string[] = []
  for (const id of args.draggedIds) {
    if (included.has(id)) {
      continue
    }
    included.add(id)
    let current = args.worktreeMap.get(id)
    let selectedAncestor = false
    while (current) {
      const lineage = getLineageRenderInfo(
        current,
        args.lineageById,
        args.worktreeMap,
        args.cyclicLineageIds
      )
      if (lineage.state !== 'valid') {
        break
      }
      if (selectedIds.has(lineage.parent.id)) {
        selectedAncestor = true
        break
      }
      current = lineage.parent
    }
    if (!selectedAncestor) {
      roots.push(id)
    }
  }
  return roots
}

export function getWorktreeLineageDragRootId(args: {
  worktreeId: string
  lineageRootIds: readonly string[]
  lineageById: Readonly<Record<string, WorktreeLineage>>
  worktreeMap: ReadonlyMap<string, Worktree>
  cyclicLineageIds: ReadonlySet<string>
}): string {
  const rootIds = new Set(args.lineageRootIds)
  let current = args.worktreeMap.get(args.worktreeId)
  while (current) {
    if (rootIds.has(current.id)) {
      return current.id
    }
    const lineage = getLineageRenderInfo(
      current,
      args.lineageById,
      args.worktreeMap,
      args.cyclicLineageIds
    )
    if (lineage.state !== 'valid') {
      break
    }
    current = lineage.parent
  }
  return args.worktreeId
}

export function getReorderedWorktreeIdsToUnnest(args: {
  draggedIds: readonly string[]
  sourceGroupIds: readonly string[]
  lineageById: Readonly<Record<string, WorktreeLineage>>
  worktreeMap: ReadonlyMap<string, Worktree>
  cyclicLineageIds: ReadonlySet<string>
}): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  const sourceGroupIdSet = new Set(args.sourceGroupIds)
  for (const id of args.draggedIds) {
    const worktree = args.worktreeMap.get(id)
    if (
      seen.has(id) ||
      !sourceGroupIdSet.has(id) ||
      !worktree ||
      getLineageRenderInfo(worktree, args.lineageById, args.worktreeMap, args.cyclicLineageIds)
        .state !== 'valid'
    ) {
      continue
    }
    seen.add(id)
    ids.push(id)
  }
  return ids
}
