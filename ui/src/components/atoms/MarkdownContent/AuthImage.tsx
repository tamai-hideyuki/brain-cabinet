import { useState, useEffect } from 'react'
import { fetchWithAuth } from '../../../api/client'

type AuthImageProps = {
  src: string
  alt: string
  className?: string
}

/**
 * 認証付きで画像を取得し表示するコンポーネント
 * note-image:// プロトコルをサポート
 */
export const AuthImage = ({ src, alt, className }: AuthImageProps) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let isMounted = true
    let objectUrl: string | null = null

    const loadImage = async () => {
      try {
        setLoading(true)
        setError(false)

        // note-image:// プロトコルをAPI URLに変換
        let apiUrl = src
        if (src.startsWith('note-image://')) {
          const imageId = src.replace('note-image://', '')
          apiUrl = `/api/notes/images/${imageId}/data`
        }

        // 外部URLはそのまま使用
        if (apiUrl.startsWith('http://') || apiUrl.startsWith('https://')) {
          if (isMounted) {
            setImageSrc(apiUrl)
            setLoading(false)
          }
          return
        }

        // 認証付きで画像を取得
        const response = await fetchWithAuth(apiUrl)
        if (!response.ok) {
          throw new Error('Failed to load image')
        }

        const blob = await response.blob()
        objectUrl = URL.createObjectURL(blob)

        if (isMounted) {
          setImageSrc(objectUrl)
          setLoading(false)
        }
      } catch (e) {
        console.error('Failed to load image:', e)
        if (isMounted) {
          setError(true)
          setLoading(false)
        }
      }
    }

    loadImage()

    return () => {
      isMounted = false
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [src])

  if (loading) {
    return <span className="markdown-content__image-loading">画像読み込み中...</span>
  }

  if (error || !imageSrc) {
    return <span className="markdown-content__image-error">画像を読み込めませんでした</span>
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      loading="lazy"
    />
  )
}
