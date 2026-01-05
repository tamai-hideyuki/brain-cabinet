import './CountdownTimer.css'

type Props = {
  remainingSeconds: number
  isExpiringSoon?: boolean
}

export const CountdownTimer = ({ remainingSeconds, isExpiringSoon = false }: Props) => {
  const hours = Math.floor(remainingSeconds / 3600)
  const minutes = Math.floor((remainingSeconds % 3600) / 60)
  const seconds = remainingSeconds % 60

  const formatTime = () => {
    if (hours > 0) {
      return `${hours}時間${minutes}分${seconds}秒`
    }
    if (minutes > 0) {
      return `${minutes}分${seconds}秒`
    }
    return `${seconds}秒`
  }

  return (
    <span className={`countdown-timer ${isExpiringSoon ? 'countdown-timer--warning' : ''}`}>
      {formatTime()}
    </span>
  )
}
