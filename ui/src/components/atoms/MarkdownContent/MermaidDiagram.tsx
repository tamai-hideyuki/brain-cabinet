import { useEffect, useState, useId } from 'react'
import mermaid from 'mermaid'
import { useTheme } from '../../../hooks/useTheme'

type MermaidDiagramProps = {
  chart: string
}

export const MermaidDiagram = ({ chart }: MermaidDiagramProps) => {
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const { theme } = useTheme()
  const id = useId().replace(/:/g, '-')

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
    })
  }, [theme])

  useEffect(() => {
    const renderChart = async () => {
      try {
        const { svg } = await mermaid.render(`mermaid${id}`, chart)
        setSvg(svg)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to render diagram')
      }
    }
    renderChart()
  }, [chart, theme, id])

  if (error) {
    return <div className="mermaid-error">{error}</div>
  }

  return (
    <div
      className="mermaid-diagram"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
