import type { MenuTreeNodePublic } from "@/client"

// 遞迴展開選單樹，讓 path/key 查找共用同一份邏輯。
export function flattenMenuTree(
  nodes: MenuTreeNodePublic[],
): MenuTreeNodePublic[] {
  return nodes.flatMap((node) => [
    node,
    ...flattenMenuTree(node.children ?? []),
  ])
}

// 由 menu key 找出目前可見的選單節點。
export function findMenuNodeByKey(
  nodes: MenuTreeNodePublic[],
  key: string,
): MenuTreeNodePublic | undefined {
  return flattenMenuTree(nodes).find((node) => node.key === key)
}

// 由完整 URL path 找出目前可見的選單節點。
export function findMenuNodeByPath(
  nodes: MenuTreeNodePublic[],
  path: string,
): MenuTreeNodePublic | undefined {
  return flattenMenuTree(nodes).find((node) => node.path === path)
}

// 找出指定 key 在選單樹中的完整標籤路徑，供麵包屑與頁面標題同源顯示。
export function findMenuLabelPath(
  nodes: MenuTreeNodePublic[],
  key: string,
  labelPath: string[] = [],
): string[] | undefined {
  for (const node of nodes) {
    const nextPath = [...labelPath, node.label]

    if (node.key === key) return nextPath

    const found = findMenuLabelPath(node.children ?? [], key, nextPath)
    if (found !== undefined) return found
  }

  return undefined
}
