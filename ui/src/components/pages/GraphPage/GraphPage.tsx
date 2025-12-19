import { useNavigate } from 'react-router-dom'
import { MainLayout } from '../../templates/MainLayout'
import { InfluenceGraph } from '../../organisms/InfluenceGraph'
import { Text } from '../../atoms/Text'
import './GraphPage.css'

export const GraphPage = () => {
  const navigate = useNavigate()

  const handleNodeClick = (noteId: string) => {
    navigate(`/ui/notes/${noteId}`)
  }

  return (
    <MainLayout>
      <div className="graph-page">
        <div className="graph-page__header">
          <Text variant="title">影響グラフ</Text>
          <Text variant="caption">ノート間の影響関係を可視化</Text>
        </div>
        <div className="graph-page__content">
          <InfluenceGraph onNodeClick={handleNodeClick} />
        </div>
      </div>
    </MainLayout>
  )
}
