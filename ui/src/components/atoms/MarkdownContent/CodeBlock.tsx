import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useTheme } from '../../../hooks/useTheme'

type CodeBlockProps = {
  language: string
  children: string
}

export const CodeBlock = ({ language, children }: CodeBlockProps) => {
  const { theme } = useTheme()

  return (
    <SyntaxHighlighter
      style={theme === 'dark' ? oneDark : oneLight}
      language={language}
      PreTag="div"
    >
      {children}
    </SyntaxHighlighter>
  )
}
