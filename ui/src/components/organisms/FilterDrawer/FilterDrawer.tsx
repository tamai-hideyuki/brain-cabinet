import { useState, useMemo } from 'react'
import { Text } from '../../atoms/Text'
import { Button } from '../../atoms/Button'
import { Badge } from '../../atoms/Badge'
import type { Note } from '../../../types/note'
import './FilterDrawer.css'

type FilterMode = 'AND' | 'OR'
type SortMode = 'count' | 'alpha'

export type FilterState = {
  tags: string[]
  categories: string[]
  mode: FilterMode
}

type FilterDrawerProps = {
  isOpen: boolean
  onClose: () => void
  notes: Note[]
  filter: FilterState
  onFilterChange: (filter: FilterState) => void
}

type TagCount = {
  name: string
  count: number
}

export const FilterDrawer = ({
  isOpen,
  onClose,
  notes,
  filter,
  onFilterChange,
}: FilterDrawerProps) => {
  const [sortMode, setSortMode] = useState<SortMode>('count')

  // タグ一覧（使用頻度付き）
  const tagCounts = useMemo((): TagCount[] => {
    const counts = new Map<string, number>()
    notes.forEach((note) => {
      note.tags?.forEach((tag) => {
        counts.set(tag, (counts.get(tag) || 0) + 1)
      })
    })

    const tags = Array.from(counts.entries()).map(([name, count]) => ({
      name,
      count,
    }))

    if (sortMode === 'count') {
      return tags.sort((a, b) => b.count - a.count)
    }
    return tags.sort((a, b) => a.name.localeCompare(b.name, 'ja'))
  }, [notes, sortMode])

  // カテゴリ一覧（使用頻度付き）
  const categoryCounts = useMemo((): TagCount[] => {
    const counts = new Map<string, number>()
    notes.forEach((note) => {
      if (note.category) {
        counts.set(note.category, (counts.get(note.category) || 0) + 1)
      }
    })

    const categories = Array.from(counts.entries()).map(([name, count]) => ({
      name,
      count,
    }))

    if (sortMode === 'count') {
      return categories.sort((a, b) => b.count - a.count)
    }
    return categories.sort((a, b) => a.name.localeCompare(b.name, 'ja'))
  }, [notes, sortMode])

  const handleTagToggle = (tag: string) => {
    const newTags = filter.tags.includes(tag)
      ? filter.tags.filter((t) => t !== tag)
      : [...filter.tags, tag]
    onFilterChange({ ...filter, tags: newTags })
  }

  const handleCategoryToggle = (category: string) => {
    const newCategories = filter.categories.includes(category)
      ? filter.categories.filter((c) => c !== category)
      : [...filter.categories, category]
    onFilterChange({ ...filter, categories: newCategories })
  }

  const handleModeToggle = () => {
    onFilterChange({
      ...filter,
      mode: filter.mode === 'AND' ? 'OR' : 'AND',
    })
  }

  const handleClear = () => {
    onFilterChange({ tags: [], categories: [], mode: 'AND' })
  }

  const activeFilterCount = filter.tags.length + filter.categories.length

  if (!isOpen) return null

  return (
    <>
      <div className="filter-drawer__overlay" onClick={onClose} />
      <div className="filter-drawer">
        <div className="filter-drawer__header">
          <Text variant="subtitle">フィルター</Text>
          <button className="filter-drawer__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="filter-drawer__content">
          {/* フィルターモード */}
          <div className="filter-drawer__section">
            <div className="filter-drawer__section-header">
              <Text variant="caption">絞り込み条件</Text>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleModeToggle}
              >
                {filter.mode}
              </Button>
            </div>
            <Text variant="caption">
              {filter.mode === 'AND'
                ? 'すべての条件に一致'
                : 'いずれかの条件に一致'}
            </Text>
          </div>

          {/* ソート */}
          <div className="filter-drawer__section">
            <div className="filter-drawer__section-header">
              <Text variant="caption">並び順</Text>
              <div className="filter-drawer__sort-buttons">
                <Button
                  variant={sortMode === 'count' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setSortMode('count')}
                >
                  使用頻度
                </Button>
                <Button
                  variant={sortMode === 'alpha' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setSortMode('alpha')}
                >
                  名前順
                </Button>
              </div>
            </div>
          </div>

          {/* カテゴリ */}
          {categoryCounts.length > 0 && (
            <div className="filter-drawer__section">
              <Text variant="caption">カテゴリ</Text>
              <div className="filter-drawer__tags">
                {categoryCounts.map(({ name, count }) => (
                  <button
                    key={name}
                    className={`filter-drawer__tag ${filter.categories.includes(name) ? 'filter-drawer__tag--selected' : ''}`}
                    onClick={() => handleCategoryToggle(name)}
                  >
                    <span>{name}</span>
                    <Badge variant="default">{count}</Badge>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* タグ */}
          {tagCounts.length > 0 && (
            <div className="filter-drawer__section">
              <Text variant="caption">タグ</Text>
              <div className="filter-drawer__tags">
                {tagCounts.map(({ name, count }) => (
                  <button
                    key={name}
                    className={`filter-drawer__tag ${filter.tags.includes(name) ? 'filter-drawer__tag--selected' : ''}`}
                    onClick={() => handleTagToggle(name)}
                  >
                    <span>#{name}</span>
                    <Badge variant="default">{count}</Badge>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tagCounts.length === 0 && categoryCounts.length === 0 && (
            <div className="filter-drawer__empty">
              <Text variant="caption">タグやカテゴリがありません</Text>
            </div>
          )}
        </div>

        <div className="filter-drawer__footer">
          {activeFilterCount > 0 && (
            <Button variant="secondary" onClick={handleClear}>
              クリア ({activeFilterCount})
            </Button>
          )}
          <Button variant="primary" onClick={onClose}>
            適用
          </Button>
        </div>
      </div>
    </>
  )
}
