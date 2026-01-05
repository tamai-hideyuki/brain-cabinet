import { useMemo } from 'react'
import './DiffView.css'

type DiffViewProps = {
  oldText: string
  newText: string
}

type DiffLine = {
  type: 'unchanged' | 'added' | 'removed'
  content: string
  oldLineNum?: number
  newLineNum?: number
}

/**
 * 行単位の差分を計算する（シンプルなLCS風アルゴリズム）
 */
const computeLineDiff = (oldText: string, newText: string): DiffLine[] => {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')

  // LCS (Longest Common Subsequence) テーブルを構築
  const m = oldLines.length
  const n = newLines.length
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // バックトラックして差分を構築
  let i = m
  let j = n
  const temp: DiffLine[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      temp.unshift({
        type: 'unchanged',
        content: oldLines[i - 1],
        oldLineNum: i,
        newLineNum: j,
      })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      temp.unshift({
        type: 'added',
        content: newLines[j - 1],
        newLineNum: j,
      })
      j--
    } else {
      temp.unshift({
        type: 'removed',
        content: oldLines[i - 1],
        oldLineNum: i,
      })
      i--
    }
  }

  return temp
}

export const DiffView = ({ oldText, newText }: DiffViewProps) => {
  const diffLines = useMemo(() => computeLineDiff(oldText, newText), [oldText, newText])

  if (diffLines.length === 0) {
    return <div className="diff-view diff-view--empty">変更なし</div>
  }

  return (
    <div className="diff-view">
      <table className="diff-view__table">
        <tbody>
          {diffLines.map((line, index) => (
            <tr key={index} className={`diff-view__row diff-view__row--${line.type}`}>
              <td className="diff-view__line-num diff-view__line-num--old">
                {line.oldLineNum ?? ''}
              </td>
              <td className="diff-view__line-num diff-view__line-num--new">
                {line.newLineNum ?? ''}
              </td>
              <td className="diff-view__sign">
                {line.type === 'added' && '+'}
                {line.type === 'removed' && '-'}
                {line.type === 'unchanged' && ' '}
              </td>
              <td className="diff-view__content">
                <pre>{line.content || ' '}</pre>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
