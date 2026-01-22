import { useCallback, useState, useRef } from 'react'
import { useBlockEditorContext } from '../BlockEditorContext'
import { uploadNoteImage } from '../../../../api/noteImagesApi'
import type { ImageBlock as ImageBlockType } from '../../../../types/block'
import './blocks.css'

type ImageBlockProps = {
  block: ImageBlockType
}

export const ImageBlock = ({ block }: ImageBlockProps) => {
  const { state, actions, registerBlockRef, noteId } = useBlockEditorContext()
  const isFocused = state.focusedBlockId === block.id
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = useCallback(
    async (file: File) => {
      if (!noteId) {
        setError('ノートIDが必要です')
        return
      }

      setIsUploading(true)
      setError(null)

      try {
        const result = await uploadNoteImage(noteId, file)
        // Extract src from markdown: ![alt](src)
        const match = result.markdown.match(/!\[.*?\]\((.*?)\)/)
        if (match) {
          actions.updateBlock(block.id, {
            src: match[1],
            alt: file.name,
          })
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'アップロードに失敗しました')
      } finally {
        setIsUploading(false)
      }
    },
    [noteId, actions, block.id]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file && file.type.startsWith('image/')) {
        handleUpload(file)
      }
      e.target.value = ''
    },
    [handleUpload]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) {
        handleUpload(file)
      }
    },
    [handleUpload]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleClick = useCallback(() => {
    actions.setFocus(block.id)
    if (!block.src) {
      fileInputRef.current?.click()
    }
  }, [actions, block.id, block.src])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        actions.deleteBlock(block.id)
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        actions.insertNewBlock(block.id, 'text')
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        actions.focusPrev(block.id)
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        actions.focusNext(block.id)
        return
      }
    },
    [actions, block.id]
  )

  const setRef = useCallback(
    (element: HTMLElement | null) => {
      registerBlockRef(block.id, element)
    },
    [registerBlockRef, block.id]
  )

  // Generate image URL
  const getImageSrc = (src: string) => {
    if (src.startsWith('note-image://')) {
      const imageId = src.replace('note-image://', '')
      return `/api/note-images/${imageId}`
    }
    return src
  }

  return (
    <div
      className={`block block--image ${isFocused ? 'block--focused' : ''} ${isDragging ? 'block--dragging' : ''}`}
      ref={setRef}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="block__file-input"
      />

      {block.src ? (
        <div className="block__image-container">
          <img
            src={getImageSrc(block.src)}
            alt={block.alt}
            className="block__image"
            loading="lazy"
          />
          {block.caption && (
            <p className="block__image-caption">{block.caption}</p>
          )}
        </div>
      ) : (
        <div className="block__image-placeholder">
          {isUploading ? (
            <span>アップロード中...</span>
          ) : error ? (
            <span className="block__image-error">{error}</span>
          ) : (
            <>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span>クリックまたはドラッグで画像を追加</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
