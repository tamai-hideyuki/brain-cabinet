import { Text } from '../../atoms/Text'
import { Button } from '../../atoms/Button'
import './ConfirmModal.css'

type ConfirmModalProps = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
  confirming?: boolean
}

export const ConfirmModal = ({
  title,
  message,
  confirmLabel = '確認',
  cancelLabel = 'キャンセル',
  variant = 'default',
  onConfirm,
  onCancel,
  confirming = false,
}: ConfirmModalProps) => {
  return (
    <div className="confirm-modal__backdrop" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal__header">
          <Text variant="subtitle">{title}</Text>
        </div>
        <div className="confirm-modal__body">
          <Text variant="body">{message}</Text>
        </div>
        <div className="confirm-modal__actions">
          <Button variant="ghost" onClick={onCancel} disabled={confirming}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'primary' : 'secondary'}
            onClick={onConfirm}
            disabled={confirming}
          >
            {confirming ? '処理中...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
