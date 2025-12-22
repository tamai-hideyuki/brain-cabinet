/**
 * Bookmark Service のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildTree, type BookmarkNode } from "./index";

// DBに依存しない純粋関数 buildTree のテスト
describe("bookmarkService", () => {
  describe("buildTree", () => {
    it("空の配列を渡すと空の配列を返す", () => {
      const result = buildTree([]);
      expect(result).toEqual([]);
    });

    it("ルートノードのみの場合、そのまま返す", () => {
      const nodes: BookmarkNode[] = [
        {
          id: "1",
          parentId: null,
          type: "folder",
          name: "Root Folder",
          noteId: null,
          url: null,
          position: 0,
          isExpanded: true,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ];

      const result = buildTree(nodes);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
      expect(result[0].children).toEqual([]);
    });

    it("親子関係を正しく構築する", () => {
      const nodes: BookmarkNode[] = [
        {
          id: "parent",
          parentId: null,
          type: "folder",
          name: "Parent",
          noteId: null,
          url: null,
          position: 0,
          isExpanded: true,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          id: "child",
          parentId: "parent",
          type: "note",
          name: "Child",
          noteId: "note-1",
          url: null,
          position: 0,
          isExpanded: false,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ];

      const result = buildTree(nodes);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("parent");
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children![0].id).toBe("child");
    });

    it("複数のルートノードを正しく処理する", () => {
      const nodes: BookmarkNode[] = [
        {
          id: "root1",
          parentId: null,
          type: "folder",
          name: "Root 1",
          noteId: null,
          url: null,
          position: 0,
          isExpanded: true,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          id: "root2",
          parentId: null,
          type: "folder",
          name: "Root 2",
          noteId: null,
          url: null,
          position: 1,
          isExpanded: true,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ];

      const result = buildTree(nodes);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("root1");
      expect(result[1].id).toBe("root2");
    });

    it("positionでソートする", () => {
      const nodes: BookmarkNode[] = [
        {
          id: "c",
          parentId: null,
          type: "folder",
          name: "C",
          noteId: null,
          url: null,
          position: 2,
          isExpanded: true,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          id: "a",
          parentId: null,
          type: "folder",
          name: "A",
          noteId: null,
          url: null,
          position: 0,
          isExpanded: true,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          id: "b",
          parentId: null,
          type: "folder",
          name: "B",
          noteId: null,
          url: null,
          position: 1,
          isExpanded: true,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ];

      const result = buildTree(nodes);

      expect(result[0].id).toBe("a");
      expect(result[1].id).toBe("b");
      expect(result[2].id).toBe("c");
    });

    it("子ノードもpositionでソートする", () => {
      const nodes: BookmarkNode[] = [
        {
          id: "parent",
          parentId: null,
          type: "folder",
          name: "Parent",
          noteId: null,
          url: null,
          position: 0,
          isExpanded: true,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          id: "child3",
          parentId: "parent",
          type: "note",
          name: "Child 3",
          noteId: "note-3",
          url: null,
          position: 2,
          isExpanded: false,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          id: "child1",
          parentId: "parent",
          type: "note",
          name: "Child 1",
          noteId: "note-1",
          url: null,
          position: 0,
          isExpanded: false,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          id: "child2",
          parentId: "parent",
          type: "note",
          name: "Child 2",
          noteId: "note-2",
          url: null,
          position: 1,
          isExpanded: false,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ];

      const result = buildTree(nodes);

      expect(result[0].children![0].id).toBe("child1");
      expect(result[0].children![1].id).toBe("child2");
      expect(result[0].children![2].id).toBe("child3");
    });

    it("深いネスト構造を正しく構築する", () => {
      const nodes: BookmarkNode[] = [
        {
          id: "level0",
          parentId: null,
          type: "folder",
          name: "Level 0",
          noteId: null,
          url: null,
          position: 0,
          isExpanded: true,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          id: "level1",
          parentId: "level0",
          type: "folder",
          name: "Level 1",
          noteId: null,
          url: null,
          position: 0,
          isExpanded: true,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          id: "level2",
          parentId: "level1",
          type: "folder",
          name: "Level 2",
          noteId: null,
          url: null,
          position: 0,
          isExpanded: true,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          id: "level3",
          parentId: "level2",
          type: "note",
          name: "Level 3",
          noteId: "note-1",
          url: null,
          position: 0,
          isExpanded: false,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ];

      const result = buildTree(nodes);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("level0");
      expect(result[0].children![0].id).toBe("level1");
      expect(result[0].children![0].children![0].id).toBe("level2");
      expect(result[0].children![0].children![0].children![0].id).toBe("level3");
    });

    it("親が見つからないノードはルートに追加される", () => {
      const nodes: BookmarkNode[] = [
        {
          id: "orphan",
          parentId: "non-existent",
          type: "note",
          name: "Orphan",
          noteId: "note-1",
          url: null,
          position: 0,
          isExpanded: false,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ];

      const result = buildTree(nodes);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("orphan");
    });

    it("異なるタイプのノードを正しく処理する", () => {
      const nodes: BookmarkNode[] = [
        {
          id: "folder",
          parentId: null,
          type: "folder",
          name: "Folder",
          noteId: null,
          url: null,
          position: 0,
          isExpanded: true,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          id: "note",
          parentId: "folder",
          type: "note",
          name: "Note",
          noteId: "note-1",
          url: null,
          position: 0,
          isExpanded: false,
          createdAt: 1000,
          updatedAt: 1000,
          note: {
            id: "note-1",
            title: "Note Title",
            category: "tech",
          },
        },
        {
          id: "link",
          parentId: "folder",
          type: "link",
          name: "Link",
          noteId: null,
          url: "https://example.com",
          position: 1,
          isExpanded: false,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ];

      const result = buildTree(nodes);

      expect(result[0].type).toBe("folder");
      expect(result[0].children![0].type).toBe("note");
      expect(result[0].children![0].noteId).toBe("note-1");
      expect(result[0].children![1].type).toBe("link");
      expect(result[0].children![1].url).toBe("https://example.com");
    });

    it("元のノード配列を変更しない", () => {
      const nodes: BookmarkNode[] = [
        {
          id: "1",
          parentId: null,
          type: "folder",
          name: "Test",
          noteId: null,
          url: null,
          position: 0,
          isExpanded: true,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ];

      const original = JSON.stringify(nodes);
      buildTree(nodes);

      expect(JSON.stringify(nodes)).toBe(original);
    });
  });
});
