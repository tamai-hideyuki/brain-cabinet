/**
 * TimelinePath - 時間軸に沿った道を3Dで表示
 * メモが道に沿って配置される
 */

import { useMemo } from 'react'
import { Text } from '@react-three/drei'
import { TimelineNoteMesh } from './TimelineNoteMesh'
import type { TimelineNote } from './TimelineNoteMesh'

export type { TimelineNote }

type DateGroup = {
  date: string
  displayDate: string
  notes: TimelineNote[]
}

type Props = {
  notes: TimelineNote[]
  onSelectNote: (noteId: string) => void
  highlightedNoteIds: Set<string>
  isSearchActive: boolean
}

// 配色
const PATH_COLOR = '#3B82F6' // 道の色（青）
const MARKER_COLOR = '#F59E0B' // 日付マーカーの色（オレンジ）
const NOTE_COLORS = [
  '#4F46E5', // indigo
  '#7C3AED', // violet
  '#0891B2', // cyan
  '#059669', // emerald
  '#DC2626', // red
]

// レイアウト設定
const PATH_WIDTH = 4
const DATE_SPACING = 25 // 日付間の間隔
const NOTE_OFFSET_X = 5 // ノートの道からの横オフセット
const NOTE_SPACING_Z = 4.5 // 同じ日のノート間の間隔
const CARD_HEIGHT = 3 // カードの高さ
const FLOOR_PADDING = 2 // 床のパディング

/**
 * 日付をフォーマット（YYYY-MM-DD）
 * updatedAtはUnixタイムスタンプ（秒）
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * 日付ラベルをフォーマット（今日、昨日、または日付）
 */
function formatDateLabel(dateStr: string): string {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

  if (dateStr === todayStr) {
    return '今日'
  }
  if (dateStr === yesterdayStr) {
    return '昨日'
  }

  // YYYY-MM-DD 形式をパースして表示
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  })
}

/**
 * 日付でグループ化（更新日時でソート）
 */
function groupNotesByDate(notes: TimelineNote[]): DateGroup[] {
  const grouped = new Map<string, TimelineNote[]>()

  // 更新日時でソート（新しい順）
  const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt)

  for (const note of sorted) {
    const dateKey = formatDate(note.updatedAt)

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, [])
    }
    grouped.get(dateKey)!.push(note)
  }

  // 日付順に並べ替え（新しい順）
  return Array.from(grouped.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, groupNotes]) => ({
      date,
      displayDate: formatDateLabel(date),
      notes: groupNotes.sort((a, b) => b.updatedAt - a.updatedAt), // グループ内も更新順
    }))
}

/**
 * 道のセグメント（日付マーカー間を結ぶ）
 */
function PathSegment({ start, end }: { start: number; end: number }) {
  const length = Math.abs(end - start)
  const centerZ = (start + end) / 2

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, centerZ]}>
      <planeGeometry args={[PATH_WIDTH, length]} />
      <meshStandardMaterial
        color={PATH_COLOR}
        transparent
        opacity={0.3}
      />
    </mesh>
  )
}

/**
 * 日付マーカー（道の上に立つ標識）
 */
function DateMarker({ position, date, noteCount }: {
  position: [number, number, number]
  date: string
  noteCount: number
}) {
  return (
    <group position={position}>
      {/* マーカーポール */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 3, 8]} />
        <meshStandardMaterial color={MARKER_COLOR} />
      </mesh>

      {/* マーカー看板 */}
      <mesh position={[0, 3.5, 0]}>
        <boxGeometry args={[4, 1.5, 0.2]} />
        <meshStandardMaterial
          color={MARKER_COLOR}
          emissive={MARKER_COLOR}
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* 日付テキスト */}
      <Text
        position={[0, 3.5, 0.15]}
        fontSize={0.5}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        {date}
      </Text>

      {/* ノート数 */}
      <Text
        position={[0, 2.8, 0.15]}
        fontSize={0.3}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        {noteCount}件
      </Text>

      {/* 地面のサークル */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[2, 32]} />
        <meshStandardMaterial
          color={MARKER_COLOR}
          transparent
          opacity={0.4}
        />
      </mesh>
    </group>
  )
}

/**
 * 日付グループの床（メモの下に敷く）
 * ノートの配置: zOffset = -Math.floor(noteIndex / 2) * NOTE_SPACING_Z - 2
 * 最初のノート: z = -2
 * 最後のノート: z = -Math.floor((noteCount-1) / 2) * NOTE_SPACING_Z - 2
 */
function DateFloor({
  zPosition,
  noteCount,
  color
}: {
  zPosition: number
  noteCount: number
  color: string
}) {
  // ノート数に基づいて床のサイズを計算
  const floorWidth = NOTE_OFFSET_X * 2 + 3 + FLOOR_PADDING * 2 // 左右のオフセット + カード幅 + パディング

  // ノートの配置範囲を計算
  const firstNoteZ = -2 // 最初のノートのzオフセット
  const lastNoteZ = -Math.floor((noteCount - 1) / 2) * NOTE_SPACING_Z - 2 // 最後のノートのzオフセット
  const floorDepth = Math.abs(lastNoteZ - firstNoteZ) + FLOOR_PADDING * 2 + 3 // +3はカードの奥行き分

  // 床の中心位置
  const floorCenterZ = zPosition + (firstNoteZ + lastNoteZ) / 2

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.005, floorCenterZ]}
    >
      <planeGeometry args={[floorWidth, floorDepth]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.15}
      />
    </mesh>
  )
}

export function TimelinePath({ notes, onSelectNote, highlightedNoteIds, isSearchActive }: Props) {
  const dateGroups = useMemo(() => groupNotesByDate(notes), [notes])

  // 道の全長を計算
  const totalLength = dateGroups.length * DATE_SPACING

  return (
    <group>
      {/* 道の背景（全体を通る薄いプレート） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -totalLength / 2]}>
        <planeGeometry args={[PATH_WIDTH + 2, totalLength + DATE_SPACING]} />
        <meshStandardMaterial
          color="#1e3a5f"
          transparent
          opacity={0.2}
        />
      </mesh>

      {/* 日付ごとにマーカーとノートを配置 */}
      {dateGroups.map((group, dateIndex) => {
        const zPosition = -dateIndex * DATE_SPACING
        const groupColor = NOTE_COLORS[dateIndex % NOTE_COLORS.length]

        return (
          <group key={group.date}>
            {/* 道のセグメント */}
            {dateIndex < dateGroups.length - 1 && (
              <PathSegment
                start={zPosition}
                end={zPosition - DATE_SPACING}
              />
            )}

            {/* 日付マーカー */}
            <DateMarker
              position={[0, 0, zPosition]}
              date={group.displayDate}
              noteCount={group.notes.length}
            />

            {/* 日付グループの床 */}
            <DateFloor
              zPosition={zPosition}
              noteCount={group.notes.length}
              color={groupColor}
            />

            {/* ノートカード（道の両側に交互に配置） */}
            {group.notes.map((note, noteIndex) => {
              // 左右交互に配置
              const side = noteIndex % 2 === 0 ? 1 : -1
              const xOffset = NOTE_OFFSET_X * side
              // 奥行き方向にずらす
              const zOffset = -Math.floor(noteIndex / 2) * NOTE_SPACING_Z - 2

              return (
                <TimelineNoteMesh
                  key={note.id}
                  note={note}
                  position={[xOffset, CARD_HEIGHT / 2 + 0.5, zPosition + zOffset]}
                  color={NOTE_COLORS[noteIndex % NOTE_COLORS.length]}
                  onSelect={onSelectNote}
                  isHighlighted={highlightedNoteIds.has(note.id)}
                  isDimmed={isSearchActive && !highlightedNoteIds.has(note.id)}
                />
              )
            })}
          </group>
        )
      })}

      {/* タイムラインの始点マーカー */}
      <group position={[0, 0, DATE_SPACING / 2]}>
        <Text
          position={[0, 4, 0]}
          fontSize={1}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.05}
          outlineColor="#000000"
        >
          Timeline
        </Text>
        <Text
          position={[0, 2.8, 0]}
          fontSize={0.4}
          color="#888888"
          anchorX="center"
          anchorY="middle"
        >
          {notes.length} notes
        </Text>
      </group>
    </group>
  )
}
