import { useRef, useCallback, useState } from 'react'
import { useBlockEditorContext } from '../BlockEditorContext'
import type { CodeBlock as CodeBlockType } from '../../../../types/block'
import './blocks.css'

type CodeBlockEditorProps = {
  block: CodeBlockType
}

const LANGUAGES = [
  { value: '', label: 'プレーンテキスト' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'sql', label: 'SQL' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'bash', label: 'Bash' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'mermaid', label: 'Mermaid' },
]

export const CodeBlockEditor = ({ block }: CodeBlockEditorProps) => {
  const { state, actions, registerBlockRef } = useBlockEditorContext()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isFocused = state.focusedBlockId === block.id
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      actions.updateBlock(block.id, { content: e.target.value })
    },
    [actions, block.id]
  )

  const handleLanguageChange = useCallback(
    (language: string) => {
      actions.updateBlock(block.id, { language })
      setShowLanguageMenu(false)
    },
    [actions, block.id]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Tab: Insert tab character
      if (e.key === 'Tab') {
        e.preventDefault()
        const textarea = textareaRef.current
        if (!textarea) return

        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const value = textarea.value
        const newValue = value.substring(0, start) + '  ' + value.substring(end)

        actions.updateBlock(block.id, { content: newValue })

        // Restore cursor position
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2
        }, 0)
        return
      }

      // Escape: Exit code block, focus next
      if (e.key === 'Escape') {
        e.preventDefault()
        actions.focusNext(block.id)
        return
      }

      // Backspace on empty: Delete block
      if (e.key === 'Backspace' && block.content === '') {
        e.preventDefault()
        actions.deleteBlock(block.id)
        return
      }
    },
    [actions, block.id, block.content]
  )

  const handleFocus = useCallback(() => {
    actions.setFocus(block.id)
  }, [actions, block.id])

  const setRef = useCallback(
    (element: HTMLElement | null) => {
      registerBlockRef(block.id, element)
    },
    [registerBlockRef, block.id]
  )

  const currentLanguage = LANGUAGES.find(l => l.value === block.language)?.label || 'プレーンテキスト'

  return (
    <div
      className={`block block--code ${isFocused ? 'block--focused' : ''}`}
      ref={setRef}
    >
      <div className="block__code-header">
        <div className="block__language-selector">
          <button
            type="button"
            className="block__language-button"
            onClick={() => setShowLanguageMenu(!showLanguageMenu)}
          >
            {currentLanguage}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {showLanguageMenu && (
            <div className="block__language-menu">
              {LANGUAGES.map(lang => (
                <button
                  key={lang.value}
                  type="button"
                  className={`block__language-option ${lang.value === block.language ? 'block__language-option--selected' : ''}`}
                  onClick={() => handleLanguageChange(lang.value)}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <textarea
        ref={textareaRef}
        className="block__code-textarea"
        value={block.content}
        onChange={handleContentChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder="コードを入力..."
        spellCheck={false}
        rows={Math.max(3, block.content.split('\n').length)}
      />
    </div>
  )
}
