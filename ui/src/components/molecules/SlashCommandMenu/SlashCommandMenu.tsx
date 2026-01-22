import { useState, useEffect, useRef } from 'react'
import type { BlockType, SlashCommandItem } from '../../../types/block'
import './SlashCommandMenu.css'

const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    type: 'text',
    label: 'テキスト',
    description: '通常のテキストブロック',
    icon: 'T',
    keywords: ['text', 'paragraph', 'テキスト'],
  },
  {
    type: 'heading1',
    label: '見出し 1',
    description: '大きな見出し',
    icon: 'H1',
    keywords: ['heading', 'h1', '見出し', 'タイトル'],
  },
  {
    type: 'heading2',
    label: '見出し 2',
    description: '中サイズの見出し',
    icon: 'H2',
    keywords: ['heading', 'h2', '見出し'],
  },
  {
    type: 'heading3',
    label: '見出し 3',
    description: '小さな見出し',
    icon: 'H3',
    keywords: ['heading', 'h3', '見出し'],
  },
  {
    type: 'bulletList',
    label: '箇条書き',
    description: '箇条書きリスト',
    icon: '•',
    keywords: ['bullet', 'list', 'リスト', '箇条書き'],
  },
  {
    type: 'numberedList',
    label: '番号付きリスト',
    description: '番号付きリスト',
    icon: '1.',
    keywords: ['numbered', 'list', 'リスト', '番号'],
  },
  {
    type: 'checklist',
    label: 'チェックリスト',
    description: 'ToDo リスト',
    icon: '☑',
    keywords: ['todo', 'checklist', 'チェック', 'タスク'],
  },
  {
    type: 'code',
    label: 'コードブロック',
    description: 'コードスニペット',
    icon: '</>',
    keywords: ['code', 'コード', 'プログラム'],
  },
  {
    type: 'quote',
    label: '引用',
    description: '引用ブロック',
    icon: '"',
    keywords: ['quote', '引用', 'blockquote'],
  },
  {
    type: 'toggle',
    label: 'トグル',
    description: '折りたたみブロック',
    icon: '▸',
    keywords: ['toggle', 'トグル', '折りたたみ', 'details'],
  },
  {
    type: 'image',
    label: '画像',
    description: '画像をアップロード',
    icon: '🖼',
    keywords: ['image', '画像', 'img', 'picture'],
  },
  {
    type: 'divider',
    label: '区切り線',
    description: '水平線',
    icon: '—',
    keywords: ['divider', 'hr', '区切り', '線'],
  },
  {
    type: 'table',
    label: 'テーブル',
    description: '表を作成',
    icon: '▦',
    keywords: ['table', 'テーブル', '表'],
  },
]

type SlashCommandMenuProps = {
  isOpen: boolean
  position: { x: number; y: number }
  searchText: string
  onSelect: (type: BlockType) => void
  onClose: () => void
}

export const SlashCommandMenu = ({
  isOpen,
  position,
  searchText,
  onSelect,
  onClose,
}: SlashCommandMenuProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [adjustedPosition, setAdjustedPosition] = useState(position)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  // Filter commands based on search text
  const filteredCommands = SLASH_COMMANDS.filter(cmd => {
    if (!searchText) return true
    const searchLower = searchText.toLowerCase()
    return (
      cmd.label.toLowerCase().includes(searchLower) ||
      cmd.type.toLowerCase().includes(searchLower) ||
      cmd.keywords.some(k => k.toLowerCase().includes(searchLower))
    )
  })

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [searchText])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Mark this event as handled by slash menu
      ;(e as any).__slashMenuHandled = true

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          setSelectedIndex(prev =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          setSelectedIndex(prev =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          )
          break
        case 'Enter':
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          if (filteredCommands[selectedIndex]) {
            onSelect(filteredCommands[selectedIndex].type)
          }
          break
        case 'Escape':
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          onClose()
          break
      }
    }

    // Use capture phase to handle events before they reach block components
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, filteredCommands, selectedIndex, onSelect, onClose])

  // Scroll selected item into view
  useEffect(() => {
    const item = itemRefs.current.get(selectedIndex)
    item?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  // Adjust position to prevent menu from going off-screen
  useEffect(() => {
    if (!isOpen || !menuRef.current) return

    const menu = menuRef.current
    const menuRect = menu.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth
    const padding = 8

    let newY = position.y
    let newX = position.x

    // If menu would go below viewport, show it above the cursor instead
    if (position.y + menuRect.height > viewportHeight - padding) {
      // Calculate position to show above: subtract menu height and some offset for the cursor line
      newY = Math.max(padding, position.y - menuRect.height - 24)
    }

    // If menu would go off right side, adjust left
    if (position.x + menuRect.width > viewportWidth - padding) {
      newX = Math.max(padding, viewportWidth - menuRect.width - padding)
    }

    setAdjustedPosition({ x: newX, y: newY })
  }, [isOpen, position, filteredCommands.length])

  if (!isOpen || filteredCommands.length === 0) return null

  return (
    <div
      ref={menuRef}
      className="slash-command-menu"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      <div className="slash-command-menu__header">
        ブロックを挿入
      </div>
      <div className="slash-command-menu__list">
        {filteredCommands.map((cmd, index) => (
          <button
            key={cmd.type}
            ref={el => {
              if (el) itemRefs.current.set(index, el)
            }}
            className={`slash-command-menu__item ${
              index === selectedIndex ? 'slash-command-menu__item--selected' : ''
            }`}
            onClick={() => onSelect(cmd.type)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className="slash-command-menu__icon">{cmd.icon}</span>
            <div className="slash-command-menu__content">
              <span className="slash-command-menu__label">{cmd.label}</span>
              <span className="slash-command-menu__description">{cmd.description}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
