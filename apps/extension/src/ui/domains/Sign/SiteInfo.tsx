import { FC } from "react"
import styled from "styled-components"
import { useFaviconUrl } from "@ui/hooks/useFaviconUrl"
import { classNames } from "@talisman/util/classNames"
import { stripUrl } from "@core/util/stripUrl"

const Container = styled.div`
  text-align: center;
  .favicon {
    width: 4rem;
    height: 4rem;
    margin-bottom: 1.2rem;
    opacity: 0;
    transition: opacity var(--transition-speed-fast) ease-in-out;
  }
  .favicon.show {
    opacity: 1;
  }
  p {
    font-size: var(--font-size-small);
    line-height: var(--font-size-small);
    margin: 0;
  }
`

type SiteInfoProps = {
  siteUrl?: string
}

export const SiteInfo: FC<SiteInfoProps> = ({ siteUrl = "" }) => {
  const favicon = useFaviconUrl(siteUrl)
  const domain = stripUrl(siteUrl)

  if (!siteUrl || domain.err) return null

  return (
    <Container className="site-info">
      <img className={classNames("favicon inline-block", favicon && "show")} src={favicon} alt="" />
      <p>{domain.val}</p>
    </Container>
  )
}
