import { CurrentAccountAvatar } from "@ui/domains/Account/CurrentAccountAvatar"
import { AssetDiscoveryPopupAlert } from "@ui/domains/AssetDiscovery/AssetDiscoveryPopupAlert"
import { EvmNetworkSelectPill } from "@ui/domains/Ethereum/EvmNetworkSelectPill"
import { PortfolioProvider } from "@ui/domains/Portfolio/context"
import BraveWarningPopupBanner from "@ui/domains/Settings/BraveWarning/BraveWarningPopupBanner"
import MigratePasswordAlert from "@ui/domains/Settings/MigratePasswordAlert"
import { ConnectedAccountsPill } from "@ui/domains/Site/ConnectedAccountsPill"
import { StakingBannerProvider } from "@ui/domains/Staking/context"
import { useAuthorisedSites } from "@ui/hooks/useAuthorisedSites"
import { useHasAccounts } from "@ui/hooks/useHasAccounts"
import { Suspense, useMemo } from "react"
import { Route, Routes, useLocation } from "react-router-dom"

import { useCurrentSite } from "../../context/CurrentSiteContext"
import { PopupContent, PopupHeader, PopupLayout } from "../../Layout/PopupLayout"
import { NoAccounts } from "../NoAccounts"
import { PortfolioAccounts } from "./PortfolioAccounts"
import { PortfolioAsset } from "./PortfolioAsset"
import { PortfolioAssets } from "./PortfolioAssets"

const AccountAvatar = () => {
  const location = useLocation()

  // do now show it on portfolio's home
  if (location.pathname === "/portfolio") return null

  return (
    <div className="text-xl">
      <CurrentAccountAvatar withTooltip />
    </div>
  )
}

const PortfolioContent = () => (
  <>
    <Routes>
      <Route path="assets" element={<PortfolioAssets />} />
      <Route path=":symbol" element={<PortfolioAsset />} />
      <Route path="" element={<PortfolioAccounts />} />
    </Routes>
    <Suspense fallback={null}>
      <BraveWarningPopupBanner />
      <MigratePasswordAlert />
    </Suspense>
  </>
)

export const Portfolio = () => {
  const currentSite = useCurrentSite()
  const authorisedSites = useAuthorisedSites()
  const isAuthorised = useMemo(
    () => currentSite?.id && authorisedSites[currentSite?.id],
    [authorisedSites, currentSite?.id]
  )
  const hasAccounts = useHasAccounts()
  return (
    <PortfolioProvider>
      <StakingBannerProvider>
        {/* share layout to prevent sidebar flickering when navigating between the 2 pages */}
        <PopupLayout withBottomNav>
          {isAuthorised ? (
            <header className="my-8 flex h-[3.6rem] w-full shrink-0 items-center justify-between gap-4 px-12">
              <ConnectedAccountsPill />
              <EvmNetworkSelectPill />
            </header>
          ) : (
            <PopupHeader right={<AccountAvatar />}>
              <ConnectedAccountsPill />
            </PopupHeader>
          )}
          <PopupContent>
            {hasAccounts === false ? <NoAccounts /> : <PortfolioContent />}
          </PopupContent>
          <AssetDiscoveryPopupAlert />
        </PopupLayout>
      </StakingBannerProvider>
    </PortfolioProvider>
  )
}
