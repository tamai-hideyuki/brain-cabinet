import { visit, SKIP } from 'unist-util-visit'
import type { Plugin } from 'unified'
import type { Text, Link, Root } from 'mdast'
import type { Node, Parent } from 'unist'

const UUID_PATTERN = /\[\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]\]/gi

export const remarkNoteLink: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index: number | undefined, parent: Parent | undefined) => {
      if (index === undefined || parent === undefined) return

      const value = node.value
      const regex = new RegExp(UUID_PATTERN.source, 'gi')
      const matches = [...value.matchAll(regex)]

      if (matches.length === 0) return

      const newNodes: (Text | Link)[] = []
      let lastIndex = 0

      for (const match of matches) {
        const matchStart = match.index!
        const matchEnd = matchStart + match[0].length
        const uuid = match[1]

        // テキスト前の部分
        if (matchStart > lastIndex) {
          newNodes.push({
            type: 'text',
            value: value.slice(lastIndex, matchStart),
          } as Text)
        }

        // リンクノード
        newNodes.push({
          type: 'link',
          url: `note://${uuid}`,
          children: [{ type: 'text', value: uuid } as Text],
        } as Link)

        lastIndex = matchEnd
      }

      // 残りのテキスト
      if (lastIndex < value.length) {
        newNodes.push({
          type: 'text',
          value: value.slice(lastIndex),
        } as Text)
      }

      // 親ノードの子を置き換え
      parent.children.splice(index, 1, ...newNodes as Node[])

      // 追加したノードをスキップして無限ループを防ぐ
      return [SKIP, index + newNodes.length]
    })
  }
}
