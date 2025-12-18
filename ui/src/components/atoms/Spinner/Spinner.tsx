import './Spinner.css'

type SpinnerProps = {
  size?: 'sm' | 'md' | 'lg'
}

export const Spinner = ({ size = 'md' }: SpinnerProps) => (
  <div className={`spinner spinner--${size}`} />
)
