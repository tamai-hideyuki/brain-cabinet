/**
 * Calendar3DScene - 3Dカレンダー メインシーン
 */

import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html, Stars } from '@react-three/drei'
import { TimelinePlayerControls } from './TimelinePlayerControls'
import { TouchControls } from '../LibraryPage/TouchControls'
import { useIsTouchDevice } from '../LibraryPage/LibraryScene'
import { YearBlock } from './YearBlock'
import { MonthBlock, calculateMonthPosition } from './MonthBlock'
import { DayCell, calculateDayPosition, isToday } from './DayCell'
import { CalendarNoteMesh, calculateNotePosition } from './CalendarNoteMesh'
import type { CalendarHierarchy, CalendarYear, CalendarMonth } from '../../../utils/calendarHierarchy'
import { getDaysInMonth, getFirstDayOfMonth } from '../../../utils/calendarHierarchy'
import type { ExpansionState, ExpansionActions } from '../../../hooks/useCalendarExpansion'

type Props = {
  hierarchy: CalendarHierarchy
  expansionState: ExpansionState
  expansionActions: ExpansionActions
  onSelectNote: (noteId: string) => void
}

// 年ブロック間隔
// 年展開だけでは間隔変えない（月がコンパクトなので）
// 月展開時に月間隔が広がると、その分年間隔も必要になる
const YEAR_SPACING_X_BASE = 45

function LoadingIndicator() {
  return (
    <Html center>
      <div style={{ color: 'white', fontSize: '1.2rem' }}>Loading Calendar...</div>
    </Html>
  )
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
      <planeGeometry args={[500, 500]} />
      <meshStandardMaterial color="#0f1729" />
    </mesh>
  )
}

function Lighting() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 50, 0]} intensity={1.5} castShadow />
      <pointLight position={[50, 30, 50]} intensity={0.8} color="#3B82F6" />
      <pointLight position={[-50, 30, -50]} intensity={0.8} color="#F59E0B" />
    </>
  )
}

/**
 * 月のカレンダーグリッド（全日を表示）
 */
function MonthCalendarGrid({
  year,
  month,
  monthPosition,
  calendarMonth,
  expansionState,
  expansionActions,
  onSelectNote,
}: {
  year: number
  month: number
  monthPosition: [number, number, number]
  calendarMonth: CalendarMonth | undefined
  expansionState: ExpansionState
  expansionActions: ExpansionActions
  onSelectNote: (noteId: string) => void
}) {
  const daysInMonth = getDaysInMonth(year, month)
  const firstDayOfWeek = getFirstDayOfMonth(year, month)

  // 日ごとのノート数をマップ化
  const noteCountByDay = useMemo(() => {
    const map = new Map<number, number>()
    if (calendarMonth) {
      for (const day of calendarMonth.days) {
        map.set(day.day, day.notes.length)
      }
    }
    return map
  }, [calendarMonth])

  // 日ごとのノートを取得
  const notesByDay = useMemo(() => {
    const map = new Map<number, CalendarMonth['days'][0]['notes']>()
    if (calendarMonth) {
      for (const day of calendarMonth.days) {
        map.set(day.day, day.notes)
      }
    }
    return map
  }, [calendarMonth])

  return (
    <>
      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
        const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const noteCount = noteCountByDay.get(day) || 0
        const notes = notesByDay.get(day) || []
        const isDayExpanded = expansionState.expandedDays.has(dateKey)

        const initialPos: [number, number, number] = [
          monthPosition[0],
          monthPosition[1],
          monthPosition[2],
        ]
        // 展開日に応じて位置を動的に計算
        const targetPos = calculateDayPosition(
          day,
          firstDayOfWeek,
          monthPosition,
          expansionState.expandedDays,
          year,
          month
        )

        return (
          <group key={dateKey}>
            <DayCell
              day={day}
              dateKey={dateKey}
              noteCount={noteCount}
              position={initialPos}
              targetPosition={targetPos}
              isExpanded={isDayExpanded}
              onToggle={() => expansionActions.toggleDay(dateKey)}
              visible={true}
              isToday={isToday(dateKey)}
            />
            {/* 展開時にノートをサークル状に表示 */}
            {isDayExpanded &&
              notes.map((note, noteIndex) => (
                <CalendarNoteMesh
                  key={note.id}
                  note={note}
                  position={targetPos}
                  targetPosition={calculateNotePosition(noteIndex, targetPos, notes.length)}
                  color="#4F46E5"
                  onSelect={onSelectNote}
                  visible={true}
                  index={noteIndex}
                />
              ))}
          </group>
        )
      })}
    </>
  )
}

/**
 * 年のコンテンツ（月ブロック群）
 */
function YearContent({
  calendarYear,
  yearPosition,
  expansionState,
  expansionActions,
  onSelectNote,
}: {
  calendarYear: CalendarYear
  yearPosition: [number, number, number]
  expansionState: ExpansionState
  expansionActions: ExpansionActions
  onSelectNote: (noteId: string) => void
}) {
  const isYearExpanded = expansionState.expandedYears.has(calendarYear.year)

  // 月データをマップ化
  const monthDataMap = useMemo(() => {
    const map = new Map<number, CalendarMonth>()
    for (const m of calendarYear.months) {
      map.set(m.month, m)
    }
    return map
  }, [calendarYear.months])

  // この年の展開されている月を抽出
  const expandedMonthsInThisYear = useMemo(() => {
    const result = new Set<string>()
    for (const monthKey of expansionState.expandedMonths) {
      if (monthKey.startsWith(`${calendarYear.year}-`)) {
        result.add(monthKey)
      }
    }
    return result
  }, [calendarYear.year, expansionState.expandedMonths])

  return (
    <>
      {/* 12ヶ月分のブロック */}
      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
        const monthKey = `${calendarYear.year}-${String(month).padStart(2, '0')}`
        const monthData = monthDataMap.get(month)
        const totalNotes = monthData?.totalNotes || 0
        const isMonthExpanded = expansionState.expandedMonths.has(monthKey)

        const initialPos: [number, number, number] = [
          yearPosition[0],
          yearPosition[1] + 3,
          yearPosition[2],
        ]
        // 展開月・展開日に応じて位置を動的に計算
        const targetPos = calculateMonthPosition(month, yearPosition, expandedMonthsInThisYear, monthKey, expansionState.expandedDays)

        return (
          <group key={monthKey}>
            <MonthBlock
              month={month}
              monthKey={monthKey}
              label={`${month}月`}
              totalNotes={totalNotes}
              position={initialPos}
              targetPosition={targetPos}
              isExpanded={isMonthExpanded}
              onToggle={() => expansionActions.toggleMonth(monthKey)}
              visible={isYearExpanded}
            />
            {/* 月が展開されていたらカレンダーグリッドを表示 */}
            {isYearExpanded && isMonthExpanded && (
              <MonthCalendarGrid
                year={calendarYear.year}
                month={month}
                monthPosition={targetPos}
                calendarMonth={monthData}
                expansionState={expansionState}
                expansionActions={expansionActions}
                onSelectNote={onSelectNote}
              />
            )}
          </group>
        )
      })}
    </>
  )
}

export function Calendar3DScene({
  hierarchy,
  expansionState,
  expansionActions,
  onSelectNote,
}: Props) {
  const isTouchDevice = useIsTouchDevice()

  // 年間隔は固定（月は上に持ち上がるので広げる必要なし）
  const yearSpacing = YEAR_SPACING_X_BASE

  return (
    <Canvas
      camera={{ position: [0, 30, 60], fov: 60 }}
      style={{ background: '#0a0f1a' }}
      shadows
    >
      <Suspense fallback={<LoadingIndicator />}>
        <Stars
          radius={300}
          depth={100}
          count={3000}
          factor={4}
          saturation={0}
          fade
          speed={0.3}
        />

        <Lighting />
        <Floor />

        {/* 年ブロック群 */}
        {hierarchy.years.map((calendarYear, yearIndex) => {
          const yearPosition: [number, number, number] = [
            yearIndex * yearSpacing - ((hierarchy.years.length - 1) * yearSpacing) / 2,
            0,
            0,
          ]
          const isYearExpanded = expansionState.expandedYears.has(calendarYear.year)

          return (
            <group key={calendarYear.year}>
              <YearBlock
                year={calendarYear.year}
                totalNotes={calendarYear.totalNotes}
                position={yearPosition}
                isExpanded={isYearExpanded}
                onToggle={() => expansionActions.toggleYear(calendarYear.year)}
              />
              <YearContent
                calendarYear={calendarYear}
                yearPosition={yearPosition}
                expansionState={expansionState}
                expansionActions={expansionActions}
                onSelectNote={onSelectNote}
              />
            </group>
          )
        })}

        {/* コントロール */}
        {isTouchDevice ? <TouchControls /> : <TimelinePlayerControls />}
      </Suspense>
    </Canvas>
  )
}
