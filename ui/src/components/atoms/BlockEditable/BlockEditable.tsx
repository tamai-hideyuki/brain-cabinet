import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import type { InlineMark } from '../../../types/block'
import './BlockEditable.css'

/**
 * Apply marks to content and return HTML string
 */
function applyMarksToContent(content: string, marks: InlineMark[]): string {
  if (!content || marks.length === 0) {
    return escapeHtml(content)
  }

  // Sort marks by start position, then by end (longer marks first)
  const sortedMarks = [...marks].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start
    return b.end - a.end
  })

  // Build segments with their marks
  type Segment = { start: number; end: number; marks: InlineMark[] }
  const segments: Segment[] = []

  // Find all unique boundaries
  const boundaries = new Set<number>([0, content.length])
  for (const mark of sortedMarks) {
    boundaries.add(Math.max(0, mark.start))
    boundaries.add(Math.min(content.length, mark.end))
  }
  const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b)

  // Create segments between boundaries
  for (let i = 0; i < sortedBoundaries.length - 1; i++) {
    const start = sortedBoundaries[i]
    const end = sortedBoundaries[i + 1]
    const activeMarks = sortedMarks.filter(m => m.start <= start && m.end >= end)
    segments.push({ start, end, marks: activeMarks })
  }

  // Render segments
  let html = ''
  for (const segment of segments) {
    let text = escapeHtml(content.slice(segment.start, segment.end))

    // Apply marks (innermost first)
    for (const mark of segment.marks) {
      switch (mark.type) {
        case 'bold':
          text = `<strong>${text}</strong>`
          break
        case 'italic':
          text = `<em>${text}</em>`
          break
        case 'code':
          text = `<code>${text}</code>`
          break
        case 'link':
          text = `<a href="${escapeHtml(mark.url || '')}" target="_blank" rel="noopener noreferrer">${text}</a>`
          break
      }
    }
    html += text
  }

  return html
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export interface BlockEditableProps {
  content: string
  marks?: InlineMark[]
  placeholder?: string
  className?: string
  disabled?: boolean
  multiline?: boolean
  onContentChange: (content: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void
  onFocus?: () => void
  onBlur?: () => void
  onPaste?: (e: React.ClipboardEvent<HTMLDivElement>) => void
}

export interface BlockEditableRef {
  focus: () => void
  blur: () => void
  getCursorPosition: () => number
  setCursorPosition: (position: number) => void
  getElement: () => HTMLDivElement | null
}

/**
 * Contenteditable wrapper component
 * Provides controlled behavior for editable content
 */
export const BlockEditable = forwardRef<BlockEditableRef, BlockEditableProps>(
  (
    {
      content,
      marks = [],
      placeholder = '',
      className = '',
      disabled = false,
      multiline = false,
      onContentChange,
      onKeyDown,
      onFocus,
      onBlur,
      onPaste,
    },
    ref
  ) => {
    const editableRef = useRef<HTMLDivElement>(null)
    const isComposing = useRef(false)
    const lastRenderedContent = useRef<string>('')
    const lastRenderedMarks = useRef<InlineMark[]>([])

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      focus: () => {
        editableRef.current?.focus()
      },
      blur: () => {
        editableRef.current?.blur()
      },
      getCursorPosition: () => {
        const element = editableRef.current
        if (!element) return 0

        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0) return 0

        const range = selection.getRangeAt(0)
        const preCaretRange = range.cloneRange()
        preCaretRange.selectNodeContents(element)
        preCaretRange.setEnd(range.startContainer, range.startOffset)

        return preCaretRange.toString().length
      },
      setCursorPosition: (position: number) => {
        const element = editableRef.current
        if (!element) return

        const selection = window.getSelection()
        if (!selection) return

        const range = document.createRange()
        let currentPos = 0
        let found = false

        const traverseNodes = (node: Node): boolean => {
          if (node.nodeType === Node.TEXT_NODE) {
            const textLength = node.textContent?.length || 0
            if (currentPos + textLength >= position) {
              range.setStart(node, position - currentPos)
              range.setEnd(node, position - currentPos)
              found = true
              return true
            }
            currentPos += textLength
          } else {
            for (const child of Array.from(node.childNodes)) {
              if (traverseNodes(child)) return true
            }
          }
          return false
        }

        traverseNodes(element)

        if (!found) {
          // Position at end
          range.selectNodeContents(element)
          range.collapse(false)
        }

        selection.removeAllRanges()
        selection.addRange(range)
      },
      getElement: () => editableRef.current,
    }))

    // Update DOM when content or marks change externally
    useEffect(() => {
      const element = editableRef.current
      if (!element || isComposing.current) return

      const currentText = element.textContent || ''
      const marksChanged = JSON.stringify(marks) !== JSON.stringify(lastRenderedMarks.current)
      const contentChanged = currentText !== content

      if (contentChanged || marksChanged) {
        // Preserve cursor position
        const selection = window.getSelection()
        const cursorPos = selection && selection.rangeCount > 0
          ? (() => {
              const range = selection.getRangeAt(0)
              const preRange = range.cloneRange()
              preRange.selectNodeContents(element)
              preRange.setEnd(range.startContainer, range.startOffset)
              return preRange.toString().length
            })()
          : 0

        // Render content with marks
        const html = applyMarksToContent(content, marks)
        element.innerHTML = html

        // Update tracking refs
        lastRenderedContent.current = content
        lastRenderedMarks.current = marks

        // Restore cursor if element is focused
        if (document.activeElement === element) {
          const newPos = Math.min(cursorPos, content.length)
          requestAnimationFrame(() => {
            const sel = window.getSelection()
            if (!sel) return

            const range = document.createRange()
            let currentPos = 0
            let found = false

            const traverseNodes = (node: Node): boolean => {
              if (node.nodeType === Node.TEXT_NODE) {
                const textLength = node.textContent?.length || 0
                if (currentPos + textLength >= newPos) {
                  range.setStart(node, newPos - currentPos)
                  range.setEnd(node, newPos - currentPos)
                  found = true
                  return true
                }
                currentPos += textLength
              } else {
                for (const child of Array.from(node.childNodes)) {
                  if (traverseNodes(child)) return true
                }
              }
              return false
            }

            traverseNodes(element)

            if (!found && element.firstChild) {
              range.selectNodeContents(element)
              range.collapse(false)
            }

            sel.removeAllRanges()
            sel.addRange(range)
          })
        }
      }
    }, [content, marks])

    const handleInput = useCallback(() => {
      if (isComposing.current) return

      const element = editableRef.current
      if (!element) return

      const newContent = element.textContent || ''
      if (newContent !== content) {
        onContentChange(newContent)
      }
    }, [content, onContentChange])

    const handleCompositionStart = useCallback(() => {
      isComposing.current = true
    }, [])

    const handleCompositionEnd = useCallback(() => {
      isComposing.current = false
      handleInput()
    }, [handleInput])

    const handleKeyDownInternal = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        // Prevent newlines in single-line mode
        if (!multiline && e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
        }

        onKeyDown?.(e)
      },
      [multiline, onKeyDown]
    )

    const handlePasteInternal = useCallback(
      (e: React.ClipboardEvent<HTMLDivElement>) => {
        // If custom handler provided, let it handle
        if (onPaste) {
          onPaste(e)
          return
        }

        // Default: paste as plain text
        e.preventDefault()
        const text = e.clipboardData.getData('text/plain')

        // Insert at cursor
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          range.deleteContents()
          range.insertNode(document.createTextNode(text))
          range.collapse(false)
          selection.removeAllRanges()
          selection.addRange(range)
        }

        handleInput()
      },
      [onPaste, handleInput]
    )

    return (
      <div
        ref={editableRef}
        className={`block-editable ${className}`.trim()}
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={handleInput}
        onKeyDown={handleKeyDownInternal}
        onFocus={onFocus}
        onBlur={onBlur}
        onPaste={handlePasteInternal}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        spellCheck={false}
      />
    )
  }
)

BlockEditable.displayName = 'BlockEditable'
