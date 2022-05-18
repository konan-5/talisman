import { classNames } from "@talisman/util/classNames"
import { useMemo } from "react"
import styled from "styled-components"
import htmlParser from "html-react-parser"
import hljs from "highlight.js/lib/core"
import yaml from "highlight.js/lib/languages/yaml"
import json from "highlight.js/lib/languages/json"

// only support yaml and json, prevents importing all languages which makes the bundle size huge
hljs.registerLanguage("yaml", yaml)
hljs.registerLanguage("json", json)

const Highlight = ({ code }: { code: string }) => {
  const output = useMemo(() => hljs.highlightAuto(code).value, [code])

  return (
    <pre>
      <code>{htmlParser(output)}</code>
    </pre>
  )
}

const Container = styled.div`
  pre {
    overflow-x: auto;
    background: var(--color-background-muted-3x);
    padding: 1.6rem;
    color: var(--color-mid);

    .hljs-string,
    .hljs-number {
      color: var(--color-foreground);
    }

    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
        "Courier New", monospace;
    }
  }
`

type CodeBlockProps = {
  className?: string
  code: string
}

export const CodeBlock = ({ className, code }: CodeBlockProps) => {
  return (
    <Container className={classNames("code-block", className)}>
      <Highlight code={code} />
    </Container>
  )
}
