import { useCallback, useState, useRef } from 'react'
import { useBlockEditorContext } from '../BlockEditorContext'
import type { TableBlock as TableBlockType, TableRow, TableCell } from '../../../../types/block'
import { generateBlockId } from '../../../../types/block'
import './blocks.css'

type TableBlockProps = {
  block: TableBlockType
}

export const TableBlock = ({ block }: TableBlockProps) => {
  const { state, actions, registerBlockRef } = useBlockEditorContext()
  const isFocused = state.focusedBlockId === block.id
  const [, setFocusedCell] = useState<{ row: number; col: number } | null>(null)
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  const handleCellChange = useCallback(
    (rowIndex: number, colIndex: number, value: string) => {
      const newRows = block.rows.map((row, ri) => {
        if (ri !== rowIndex) return row
        return {
          ...row,
          cells: row.cells.map((cell, ci) =>
            ci === colIndex ? { ...cell, content: value } : cell
          ),
        }
      })
      actions.updateBlock(block.id, { rows: newRows })
    },
    [actions, block.id, block.rows]
  )

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
      const numRows = block.rows.length
      const numCols = block.rows[0]?.cells.length ?? 0

      // Tab: Move to next cell
      if (e.key === 'Tab') {
        e.preventDefault()
        let nextRow = rowIndex
        let nextCol = colIndex + (e.shiftKey ? -1 : 1)

        if (nextCol >= numCols) {
          nextCol = 0
          nextRow++
        } else if (nextCol < 0) {
          nextCol = numCols - 1
          nextRow--
        }

        if (nextRow >= 0 && nextRow < numRows) {
          const cellKey = `${nextRow}-${nextCol}`
          cellRefs.current.get(cellKey)?.focus()
        }
        return
      }

      // Arrow keys for navigation
      if (e.key === 'ArrowUp' && rowIndex > 0) {
        e.preventDefault()
        const cellKey = `${rowIndex - 1}-${colIndex}`
        cellRefs.current.get(cellKey)?.focus()
        return
      }

      if (e.key === 'ArrowDown' && rowIndex < numRows - 1) {
        e.preventDefault()
        const cellKey = `${rowIndex + 1}-${colIndex}`
        cellRefs.current.get(cellKey)?.focus()
        return
      }

      // Backspace on empty table: Delete
      if (e.key === 'Backspace' && block.rows.every(r => r.cells.every(c => c.content === ''))) {
        e.preventDefault()
        actions.deleteBlock(block.id)
        return
      }
    },
    [actions, block.id, block.rows]
  )

  const addRow = useCallback(() => {
    const numCols = block.rows[0]?.cells.length ?? 2
    const newRow: TableRow = {
      id: generateBlockId(),
      cells: Array.from({ length: numCols }, () => ({
        id: generateBlockId(),
        content: '',
        marks: [],
      })),
    }
    actions.updateBlock(block.id, { rows: [...block.rows, newRow] })
  }, [actions, block.id, block.rows])

  const addColumn = useCallback(() => {
    const newRows = block.rows.map(row => ({
      ...row,
      cells: [
        ...row.cells,
        { id: generateBlockId(), content: '', marks: [] } as TableCell,
      ],
    }))
    actions.updateBlock(block.id, { rows: newRows })
  }, [actions, block.id, block.rows])

  const deleteRow = useCallback(
    (rowIndex: number) => {
      if (block.rows.length <= 1) return
      const newRows = block.rows.filter((_, i) => i !== rowIndex)
      actions.updateBlock(block.id, { rows: newRows })
    },
    [actions, block.id, block.rows]
  )

  const deleteColumn = useCallback(
    (colIndex: number) => {
      if ((block.rows[0]?.cells.length ?? 0) <= 1) return
      const newRows = block.rows.map(row => ({
        ...row,
        cells: row.cells.filter((_, i) => i !== colIndex),
      }))
      actions.updateBlock(block.id, { rows: newRows })
    },
    [actions, block.id, block.rows]
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

  const setCellRef = useCallback((key: string, element: HTMLInputElement | null) => {
    if (element) {
      cellRefs.current.set(key, element)
    } else {
      cellRefs.current.delete(key)
    }
  }, [])

  return (
    <div
      className={`block block--table ${isFocused ? 'block--focused' : ''}`}
      ref={setRef}
      onClick={handleFocus}
    >
      <div className="block__table-container">
        <table className="block__table">
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={row.id} className={rowIndex === 0 ? 'block__table-header-row' : ''}>
                {row.cells.map((cell, colIndex) => (
                  <td key={cell.id} className="block__table-cell">
                    <input
                      ref={(el) => setCellRef(`${rowIndex}-${colIndex}`, el)}
                      type="text"
                      className="block__table-input"
                      value={cell.content}
                      onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colIndex)}
                      onFocus={() => setFocusedCell({ row: rowIndex, col: colIndex })}
                      onBlur={() => setFocusedCell(null)}
                      placeholder={rowIndex === 0 ? 'ヘッダー' : ''}
                    />
                  </td>
                ))}
                {isFocused && (
                  <td className="block__table-action-cell">
                    <button
                      type="button"
                      className="block__table-delete-row"
                      onClick={() => deleteRow(rowIndex)}
                      title="行を削除"
                    >
                      ×
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {isFocused && (
          <div className="block__table-column-actions">
            {block.rows[0]?.cells.map((_, colIndex) => (
              <button
                key={colIndex}
                type="button"
                className="block__table-delete-col"
                onClick={() => deleteColumn(colIndex)}
                title="列を削除"
              >
                ×
              </button>
            ))}
          </div>
        )}
      </div>
      {isFocused && (
        <div className="block__table-actions">
          <button type="button" className="block__table-add-button" onClick={addRow}>
            + 行を追加
          </button>
          <button type="button" className="block__table-add-button" onClick={addColumn}>
            + 列を追加
          </button>
          <button
            type="button"
            className="block__table-delete-button"
            onClick={() => actions.deleteBlock(block.id)}
          >
            テーブルを削除
          </button>
        </div>
      )}
    </div>
  )
}
