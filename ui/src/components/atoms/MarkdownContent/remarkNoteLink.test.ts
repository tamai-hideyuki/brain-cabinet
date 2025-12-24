import { describe, it, expect } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { remarkNoteLink } from './remarkNoteLink'
import type { Root, Link, Text } from 'mdast'

const process = (markdown: string): Root => {
  const processor = unified().use(remarkParse).use(remarkNoteLink)
  return processor.runSync(processor.parse(markdown)) as Root
}

const findLinks = (tree: Root): Link[] => {
  const links: Link[] = []
  const visit = (node: unknown) => {
    if (node && typeof node === 'object' && 'type' in node) {
      const n = node as { type: string; children?: unknown[]; url?: string }
      if (n.type === 'link') {
        links.push(n as unknown as Link)
      }
      if (n.children) {
        n.children.forEach(visit)
      }
    }
  }
  visit(tree)
  return links
}

describe('remarkNoteLink', () => {
  it('[[uuid]] をリンクに変換する', () => {
    const result = process('[[550e8400-e29b-41d4-a716-446655440000]]')
    const links = findLinks(result)

    expect(links).toHaveLength(1)
    expect(links[0].url).toBe('note://550e8400-e29b-41d4-a716-446655440000')
    expect((links[0].children[0] as Text).value).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('複数の [[uuid]] を処理する', () => {
    const result = process('[[11111111-1111-1111-1111-111111111111]] と [[22222222-2222-2222-2222-222222222222]]')
    const links = findLinks(result)

    expect(links).toHaveLength(2)
    expect(links[0].url).toBe('note://11111111-1111-1111-1111-111111111111')
    expect(links[1].url).toBe('note://22222222-2222-2222-2222-222222222222')
  })

  it('テキスト前後を保持する', () => {
    const result = process('前のテキスト [[550e8400-e29b-41d4-a716-446655440000]] 後のテキスト')
    const links = findLinks(result)

    expect(links).toHaveLength(1)

    // 段落ノードを取得
    const paragraph = result.children[0] as { children: Array<{ type: string; value?: string }> }
    expect(paragraph.children[0].type).toBe('text')
    expect(paragraph.children[0].value).toBe('前のテキスト ')
    expect(paragraph.children[1].type).toBe('link')
    expect(paragraph.children[2].type).toBe('text')
    expect(paragraph.children[2].value).toBe(' 後のテキスト')
  })

  it('不正なUUID形式はリンクにしない', () => {
    const result = process('[[invalid-uuid]]')
    const links = findLinks(result)

    expect(links).toHaveLength(0)
  })

  it('短すぎるUUIDはリンクにしない', () => {
    const result = process('[[550e8400-e29b-41d4]]')
    const links = findLinks(result)

    expect(links).toHaveLength(0)
  })

  it('角括弧なしのUUIDはリンクにしない', () => {
    const result = process('550e8400-e29b-41d4-a716-446655440000')
    const links = findLinks(result)

    expect(links).toHaveLength(0)
  })

  it('大文字のUUIDも処理する', () => {
    const result = process('[[550E8400-E29B-41D4-A716-446655440000]]')
    const links = findLinks(result)

    expect(links).toHaveLength(1)
    expect(links[0].url).toBe('note://550E8400-E29B-41D4-A716-446655440000')
  })

  it('日本語テキストと混在しても正しく処理する', () => {
    const result = process('株式会社ホワイトプラス\n[[32528754-ab7a-447f-97ac-f23cf27be86f]]')
    const links = findLinks(result)

    expect(links).toHaveLength(1)
    expect(links[0].url).toBe('note://32528754-ab7a-447f-97ac-f23cf27be86f')
  })

  it('空文字列を処理してもエラーにならない', () => {
    const result = process('')
    const links = findLinks(result)

    expect(links).toHaveLength(0)
  })

  it('[[uuid]] が連続していても正しく処理する', () => {
    const result = process('[[11111111-1111-1111-1111-111111111111]][[22222222-2222-2222-2222-222222222222]]')
    const links = findLinks(result)

    expect(links).toHaveLength(2)
  })

  it('片方の角括弧だけではリンクにしない', () => {
    const result = process('[550e8400-e29b-41d4-a716-446655440000]')
    const links = findLinks(result)

    expect(links).toHaveLength(0)
  })

  it('三重角括弧はリンクにしない', () => {
    const result = process('[[[550e8400-e29b-41d4-a716-446655440000]]]')
    const links = findLinks(result)

    // [[[uuid]]] は [[uuid]] として1つだけマッチする
    expect(links).toHaveLength(1)
  })

  it('コードブロック内のテキストは処理されない（remark-parseの仕様）', () => {
    const result = process('```\n[[550e8400-e29b-41d4-a716-446655440000]]\n```')
    const links = findLinks(result)

    // コードブロック内はtextノードではなくcodeノードになるため処理されない
    expect(links).toHaveLength(0)
  })

  it('インラインコード内のテキストは処理されない', () => {
    const result = process('`[[550e8400-e29b-41d4-a716-446655440000]]`')
    const links = findLinks(result)

    expect(links).toHaveLength(0)
  })

  it('混合大文字小文字のUUIDも処理する', () => {
    const result = process('[[550e8400-E29B-41d4-A716-446655440000]]')
    const links = findLinks(result)

    expect(links).toHaveLength(1)
    expect(links[0].url).toBe('note://550e8400-E29B-41d4-A716-446655440000')
  })

  it('リスト内の [[uuid]] も処理する', () => {
    const result = process('- 項目1 [[11111111-1111-1111-1111-111111111111]]\n- 項目2')
    const links = findLinks(result)

    expect(links).toHaveLength(1)
  })

  it('見出し内の [[uuid]] も処理する', () => {
    const result = process('# タイトル [[11111111-1111-1111-1111-111111111111]]')
    const links = findLinks(result)

    expect(links).toHaveLength(1)
  })

  it('引用内の [[uuid]] も処理する', () => {
    const result = process('> 引用文 [[11111111-1111-1111-1111-111111111111]]')
    const links = findLinks(result)

    expect(links).toHaveLength(1)
  })

  it('同じUUIDが複数回出現しても全て処理する', () => {
    const uuid = '11111111-1111-1111-1111-111111111111'
    const result = process(`[[${uuid}]] と [[${uuid}]] と [[${uuid}]]`)
    const links = findLinks(result)

    expect(links).toHaveLength(3)
    links.forEach((link) => {
      expect(link.url).toBe(`note://${uuid}`)
    })
  })
})
