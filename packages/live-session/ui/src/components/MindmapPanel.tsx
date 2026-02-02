import { useRef, useEffect } from "react";
import { Network } from "vis-network";
import { DataSet } from "vis-data";
import type { MindmapNode } from "../hooks/useWebSocket";

interface Props {
  nodes: MindmapNode[];
}

/**
 * マインドマップ描画
 * 「正しそうに見せない」UX: 直線、薄い色、ラフなラベル
 */
export function MindmapPanel({ nodes }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const nodesDataRef = useRef(new DataSet<{ id: string; label: string; color: string; font: object }>());
  const edgesDataRef = useRef(new DataSet<{ id: string; from: string; to: string }>());

  // ネットワーク初期化
  useEffect(() => {
    if (!containerRef.current) return;

    const network = new Network(
      containerRef.current,
      { nodes: nodesDataRef.current, edges: edgesDataRef.current },
      {
        layout: {
          hierarchical: {
            direction: "LR",
            sortMethod: "directed",
            levelSeparation: 120,
            nodeSpacing: 60,
          },
        },
        nodes: {
          shape: "box",
          borderWidth: 1,
          margin: { top: 6, bottom: 6, left: 10, right: 10 },
        },
        edges: {
          smooth: false, // 直線（荒さを維持）
          color: { color: "#444" },
          arrows: { to: { enabled: true, scaleFactor: 0.5 } },
        },
        physics: false,
        interaction: {
          dragNodes: false,
          zoomView: true,
          dragView: true,
        },
      }
    );

    networkRef.current = network;

    return () => {
      network.destroy();
    };
  }, []);

  // ノード追加
  useEffect(() => {
    const visNodes = nodesDataRef.current;
    const visEdges = edgesDataRef.current;

    for (const node of nodes) {
      if (!visNodes.get(node.id)) {
        const style = NODE_STYLES[node.type] || NODE_STYLES.topic;
        visNodes.add({
          id: node.id,
          label: node.label,
          color: style.color,
          font: { color: style.fontColor, size: 12 },
        });

        if (node.parentId) {
          visEdges.add({
            id: `e-${node.id}`,
            from: node.parentId,
            to: node.id,
          });
        }
      }
    }

    // 最新ノードにフォーカス
    if (nodes.length > 0) {
      const last = nodes[nodes.length - 1];
      networkRef.current?.focus(last.id, { animation: { duration: 300, easingFunction: "easeInOutQuad" } });
    }
  }, [nodes]);

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>判断地図</h3>
      <div ref={containerRef} style={styles.canvas} />
    </div>
  );
}

// 薄い色（「正しそうに見せない」）
const NODE_STYLES: Record<string, { color: string; fontColor: string }> = {
  topic: { color: "#2a2a3a", fontColor: "#8888aa" },
  question: { color: "#2a2a35", fontColor: "#8888cc" },
  decision_point: { color: "#352a2a", fontColor: "#cc8888" },
  reference: { color: "#2a352a", fontColor: "#88aa88" },
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
    borderRight: "1px solid #333",
  },
  heading: {
    margin: 0,
    padding: "12px 16px",
    fontSize: 14,
    color: "#999",
    borderBottom: "1px solid #333",
  },
  canvas: {
    flex: 1,
    minHeight: 0,
    height: 0,
  },
};
