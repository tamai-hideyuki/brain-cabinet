import { Badge } from '../../atoms/Badge'
import './TagList.css'

type TagListProps = {
  tags: string[]
  max?: number
}

export const TagList = ({ tags, max }: TagListProps) => {
  const displayTags = max ? tags.slice(0, max) : tags
  const remaining = max && tags.length > max ? tags.length - max : 0

  return (
    <div class="tag-list">
      {displayTags.map((tag) => (
        <Badge key={tag}>{tag}</Badge>
      ))}
      {remaining > 0 && <Badge variant="default">+{remaining}</Badge>}
    </div>
  )
}
