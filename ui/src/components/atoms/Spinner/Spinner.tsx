import './Spinner.css'

type SpinnerProps = {
  size?: 'sm' | 'md' | 'lg'
}

export const Spinner = ({ size = 'md' }: SpinnerProps) => (
  <div class={`spinner spinner--${size}`} />
)
