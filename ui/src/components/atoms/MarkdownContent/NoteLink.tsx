import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'

type NoteLinkProps = {
  href: string
  children: ReactNode
}

export const NoteLink = ({ href, children }: NoteLinkProps) => {
  const navigate = useNavigate()

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    const uuid = href.replace('note://', '')
    navigate(`/ui/notes/${uuid}`)
  }

  return (
    <a href={href} onClick={handleClick} className="note-link">
      {children}
    </a>
  )
}
