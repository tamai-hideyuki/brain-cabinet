import { useNavigate } from 'react-router-dom'
import { MainLayout } from '../../templates/MainLayout'
import { ClusterEvolution } from '../../organisms/ClusterEvolution'
import { Text } from '../../atoms/Text'
import './ClusterEvolutionPage.css'

export const ClusterEvolutionPage = () => {
  const navigate = useNavigate()

  const handleNoteClick = (noteId: string) => {
    navigate(`/ui/notes/${noteId}`)
  }

  return (
    <MainLayout>
      <div className="cluster-evolution-page">
        <div className="cluster-evolution-page__header">
          <Text variant="title">クラスタ進化</Text>
          <Text variant="caption">思考クラスタの時系列変化を追跡</Text>
        </div>
        <div className="cluster-evolution-page__content">
          <ClusterEvolution onNoteClick={handleNoteClick} />
        </div>
      </div>
    </MainLayout>
  )
}
