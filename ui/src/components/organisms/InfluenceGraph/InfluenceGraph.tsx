import { useEffect, useRef, useState } from 'react'
import { Network, type Options } from 'vis-network'
import { DataSet } from 'vis-data'
import { Text } from '../../atoms/Text'
import { Spinner } from '../../atoms/Spinner'
import './InfluenceGraph.css'

type GraphNode = {
  id: string
  title: string
  clusterId: number | null
}

type GraphEdge = {
  source: string
  target: string
  weight: number
}

type GraphData = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  stats: {
    nodeCount: number
    edgeCount: number
  }
}

type InfluenceGraphProps = {
  onNodeClick?: (noteId: string) => void
}

// クラスタIDに基づく色を生成
const getClusterColor = (clusterId: number | null): string => {
  if (clusterId === null) return '#94a3b8' // gray
  const colors = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#ec4899', // pink
    '#84cc16', // lime
  ]
  return colors[clusterId % colors.length]
}

export const InfluenceGraph = ({ onNodeClick }: InfluenceGraphProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)
  const [data, setData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)

  // データを取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/influence/graph?limit=150')
        if (!res.ok) throw new Error('Failed to fetch graph data')
        const json = await res.json()
        setData(json)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // グラフを描画
  useEffect(() => {
    if (!data || !containerRef.current) return

    const nodes = new DataSet(
      data.nodes.map((node) => ({
        id: node.id,
        label: node.title.length > 20 ? node.title.slice(0, 20) + '...' : node.title,
        title: node.title,
        color: {
          background: getClusterColor(node.clusterId),
          border: getClusterColor(node.clusterId),
          highlight: {
            background: '#fbbf24',
            border: '#f59e0b',
          },
        },
        font: {
          color: '#ffffff',
          size: 12,
        },
      }))
    )

    const edges = new DataSet(
      data.edges.map((edge, index) => ({
        id: `edge-${index}`,
        from: edge.source,
        to: edge.target,
        value: edge.weight,
        arrows: 'to',
        color: {
          color: 'rgba(156, 163, 175, 0.4)',
          highlight: '#f59e0b',
        },
      }))
    )

    const options: Options = {
      nodes: {
        shape: 'dot',
        size: 16,
        borderWidth: 2,
        shadow: true,
      },
      edges: {
        smooth: {
          enabled: true,
          type: 'continuous',
          roundness: 0.5,
        },
        scaling: {
          min: 1,
          max: 4,
        },
      },
      physics: {
        enabled: true,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -50,
          centralGravity: 0.01,
          springLength: 100,
          springConstant: 0.08,
        },
        stabilization: {
          enabled: true,
          iterations: 200,
          updateInterval: 25,
        },
      },
      interaction: {
        hover: true,
        tooltipDelay: 100,
        zoomView: true,
        dragView: true,
      },
    }

    const network = new Network(containerRef.current, { nodes, edges }, options)
    networkRef.current = network

    network.on('click', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0] as string
        const node = data.nodes.find((n) => n.id === nodeId)
        if (node) {
          setSelectedNode(node)
          if (onNodeClick) {
            onNodeClick(nodeId)
          }
        }
      } else {
        setSelectedNode(null)
      }
    })

    return () => {
      network.destroy()
    }
  }, [data, onNodeClick])

  if (loading) {
    return (
      <div className="influence-graph__loading">
        <Spinner size="lg" />
        <Text variant="body">グラフを読み込み中...</Text>
      </div>
    )
  }

  if (error) {
    return (
      <div className="influence-graph__error">
        <Text variant="body">{error}</Text>
      </div>
    )
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="influence-graph__empty">
        <Text variant="body">影響関係のデータがありません</Text>
        <Text variant="caption">ノートを更新すると影響グラフが成長します</Text>
      </div>
    )
  }

  return (
    <div className="influence-graph">
      <div className="influence-graph__stats">
        <Text variant="caption">
          {data.stats.nodeCount} ノード / {data.stats.edgeCount} エッジ
        </Text>
      </div>
      <div className="influence-graph__container" ref={containerRef} />
      {selectedNode && (
        <div className="influence-graph__selected">
          <Text variant="subtitle">{selectedNode.title}</Text>
          <Text variant="caption">{selectedNode.id}</Text>
          {selectedNode.clusterId !== null && (
            <Text variant="caption">クラスタ: {selectedNode.clusterId}</Text>
          )}
        </div>
      )}
    </div>
  )
}
