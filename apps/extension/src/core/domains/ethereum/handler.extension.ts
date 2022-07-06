import { getUnlockedPairFromAddress } from "@core/handlers/helpers"
import { createSubscription, unsubscribe } from "@core/handlers/subscriptions"
import {
  ETH_ERROR_EIP1993_USER_REJECTED,
  EthProviderRpcError,
  EthRequestArguments,
  EthRequestSignatures,
} from "@core/injectEth/types"
import { talismanAnalytics } from "@core/libs/Analytics"
import { db } from "@core/libs/db"
import { ExtensionHandler } from "@core/libs/Handler"
import { watchEthereumTransaction } from "@core/notifications"
import {
  AnyEthRequestChainId,
  CustomEvmNetwork,
  CustomNativeToken,
  EthApproveSignAndSend,
  MessageTypes,
  Port,
  RequestIdOnly,
  RequestTypes,
  ResponseType,
  WatchAssetRequest,
} from "@core/types"
import type { TransactionRequest } from "@ethersproject/providers"
import { SignTypedDataVersion } from "@metamask/eth-sig-util"
import { assert, u8aToHex } from "@polkadot/util"
import { BigNumber, ethers } from "ethers"
import type { UnsignedTransaction } from "ethers"
import { formatUnits, parseUnits, serializeTransaction } from "ethers/lib/utils"
import isString from "lodash/isString"

import { encodeTextData, encodeTypedData, legacyToBuffer } from "./helpers"
import { getProviderForEvmNetworkId } from "./networksStore"

// turns errors into short and human readable message.
// main use case is teling the user why a transaction failed without going into details and clutter the UI
const getHumanReadableErrorMessage = (error: unknown) => {
  const { code, reason } = error as { code?: string; reason?: string }
  if (reason) return reason
  if (code === ethers.errors.INSUFFICIENT_FUNDS) return "Insufficient balance"
  if (code === ethers.errors.CALL_EXCEPTION) return "Contract method failed"
  if (code === ethers.errors.NETWORK_ERROR) return "Network error"
  if (code === ethers.errors.NONCE_EXPIRED) return "Nonce expired"
  if (code === ethers.errors.UNSUPPORTED_OPERATION) return "Unsupported operation"
  if (code === ethers.errors.NOT_IMPLEMENTED) return "Not implemented"
  if (code === ethers.errors.TIMEOUT) return "Timeout exceeded"
  if (code === ethers.errors.UNEXPECTED_ARGUMENT) return "Unexpected argument"
  if (code === ethers.errors.BUFFER_OVERRUN) return "Buffer overrun"
  if (code === ethers.errors.MISSING_ARGUMENT) return "Missing argument"
  if (code === ethers.errors.UNEXPECTED_ARGUMENT) return "Unexpected argument"
  if (code === ethers.errors.INVALID_ARGUMENT) return "Invalid argument"
  if (code === ethers.errors.SERVER_ERROR) return "Server error"

  // let the catch block decide what to display
  return undefined
}

type UnsignedTxWithGas = Omit<TransactionRequest, "gasLimit"> & { gas: string }

const txRequestToUnsignedTx = (tx: TransactionRequest | UnsignedTxWithGas): UnsignedTransaction => {
  // we're using EIP1559 so gasPrice must be removed
  // eslint-disable-next-line prefer-const
  let { from, gasPrice, ...unsignedTx } = tx
  if ("gas" in unsignedTx) {
    const { gas, ...rest1 } = unsignedTx as UnsignedTxWithGas
    unsignedTx = { ...rest1, gasLimit: BigNumber.from(gas ?? "250000") }
  }

  if (unsignedTx.nonce) {
    const { nonce, ...rest2 } = unsignedTx
    if (BigNumber.isBigNumber(nonce)) {
      unsignedTx = { nonce: nonce.toNumber(), ...rest2 }
    } else if (isString(nonce)) {
      unsignedTx = { nonce: parseInt(nonce), ...rest2 }
    }
  }
  return unsignedTx as UnsignedTransaction
}

export class EthHandler extends ExtensionHandler {
  private async signAndSendApprove({
    id,
    maxFeePerGas: strMaxFeePerGas = formatUnits(2, "gwei"),
    maxPriorityFeePerGas: strMaxPriorityFeePerGas = formatUnits(0, "gwei"),
  }: EthApproveSignAndSend): Promise<boolean> {
    try {
      const queued = this.state.requestStores.signing.getEthSignAndSendRequest(id)
      assert(queued, "Unable to find request")
      const { request, resolve, reject, ethChainId } = queued

      const provider = await getProviderForEvmNetworkId(ethChainId)
      assert(provider, "Unable to find provider for chain " + ethChainId)

      const nonce = await provider.getTransactionCount(queued.account.address)
      const maxFeePerGas = parseUnits(strMaxFeePerGas, "wei")
      const maxPriorityFeePerGas = parseUnits(strMaxPriorityFeePerGas, "wei")

      const goodTx = txRequestToUnsignedTx({
        maxFeePerGas,
        maxPriorityFeePerGas,
        nonce,
        type: 2,
        ...request,
      })

      const serialisedTx = serializeTransaction(goodTx)
      try {
        // eslint-disable-next-line no-var
        var pair = getUnlockedPairFromAddress(queued.account.address)
      } catch (error) {
        this.stores.password.clearPassword()
        reject(
          error instanceof Error ? error : new Error(typeof error === "string" ? error : undefined)
        )
        return false
      }
      const signature = await pair.sign(serialisedTx)

      const serialisedSignedTx = serializeTransaction(goodTx, signature)
      const { chainId, hash } = await provider.sendTransaction(serialisedSignedTx)

      // notify user about transaction progress
      if (await this.stores.settings.get("allowNotifications"))
        watchEthereumTransaction(chainId, hash)

      resolve(hash)

      talismanAnalytics.captureDelayed("sign transaction approve", {
        type: "evm sign and send",
        dapp: queued.url,
        chain: queued.ethChainId,
      })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err, { err })
      const msg = getHumanReadableErrorMessage(err)
      if (msg) throw new Error(msg)
      throw err
    }
    return true
  }

  private async signApprove({ id }: RequestIdOnly): Promise<boolean> {
    try {
      const queued = this.state.requestStores.signing.getEthSignRequest(id)

      assert(queued, "Unable to find request")

      const { method, request, reject, resolve } = queued

      try {
        // eslint-disable-next-line no-var
        var pair = getUnlockedPairFromAddress(queued.account.address)
      } catch (error) {
        this.stores.password.clearPassword()
        reject(
          error instanceof Error ? error : new Error(typeof error === "string" ? error : undefined)
        )
        return false
      }

      let messageToSign: Uint8Array
      if (method === "personal_sign") {
        messageToSign = encodeTextData(legacyToBuffer(request as string), true)
      } else if (method === "eth_signTypedData_v3") {
        messageToSign = encodeTypedData(JSON.parse(request as string), SignTypedDataVersion.V3)
      } else if (method === "eth_signTypedData_v4") {
        messageToSign = encodeTypedData(JSON.parse(request as string), SignTypedDataVersion.V4)
      } else {
        throw new Error(`Unsupported method : ${method}`)
      }

      const signature = await pair.sign(messageToSign)
      resolve(u8aToHex(signature))

      talismanAnalytics.captureDelayed("sign transaction approve", {
        type: "evm sign",
        method,
        dapp: queued.url,
        chain: queued.ethChainId,
      })

      return true
    } catch (err) {
      const msg = getHumanReadableErrorMessage(err)
      if (msg) throw new Error(msg)
      throw err
    }
  }

  private signingCancel({ id }: RequestIdOnly): boolean {
    const queued = this.state.requestStores.signing.getEthRequest(id)

    assert(queued, "Unable to find request")

    const { reject } = queued

    reject(new EthProviderRpcError("Cancelled", ETH_ERROR_EIP1993_USER_REJECTED))
    talismanAnalytics.capture("sign transaction reject", {
      type: "evm sign",
      dapp: queued.url,
      chain: queued.ethChainId,
    })

    return true
  }

  private ethNetworkAddCancel({ id }: RequestIdOnly): boolean {
    const queued = this.state.requestStores.networks.getRequest(id)

    assert(queued, "Unable to find request")

    const { reject } = queued

    reject(new EthProviderRpcError("Rejected", ETH_ERROR_EIP1993_USER_REJECTED))

    return true
  }

  private async ethNetworkAddApprove({ id }: RequestIdOnly): Promise<boolean> {
    const queued = this.state.requestStores.networks.getRequest(id)

    assert(queued, "Unable to find request")

    const { network, resolve } = queued
    const networkId = parseInt(network.chainId, 16)
    const newToken: CustomNativeToken | null = network.nativeCurrency
      ? {
          id: `${networkId}-native-${network.nativeCurrency.symbol}`.toLowerCase(),
          type: "native",
          isTestnet: false,
          symbol: network.nativeCurrency.symbol,
          decimals: network.nativeCurrency.decimals,
          existentialDeposit: "0",
          evmNetwork: { id: parseInt(network.chainId, 16) },
          isCustom: true,
        }
      : null

    const newNetwork: CustomEvmNetwork = {
      id: networkId,
      isTestnet: false,
      sortIndex: null,
      name: network.chainName,
      nativeToken: newToken ? { id: newToken.id } : null,
      tokens: [],
      explorerUrl: (network.blockExplorerUrls || [])[0],
      rpcs: (network.rpcUrls || []).map((url) => ({ url, isHealthy: true })),
      isHealthy: true,
      substrateChain: null,
      isCustom: true,
      explorerUrls: network.blockExplorerUrls || [],
      iconUrls: network.iconUrls || [],
    }

    await db.transaction("rw", db.evmNetworks, db.tokens, async () => {
      await db.evmNetworks.put(newNetwork)
      if (newToken) await db.tokens.put(newToken)
    })

    talismanAnalytics.capture("add network evm", { network: network.chainName, isCustom: false })

    resolve(null)

    return true
  }

  private ethWatchAssetRequestCancel({ id }: RequestIdOnly): boolean {
    const queued = this.state.requestStores.evmAssets.getRequest(id)

    assert(queued, "Unable to find request")

    const { reject } = queued

    reject(new EthProviderRpcError("Rejected", ETH_ERROR_EIP1993_USER_REJECTED))

    return true
  }

  private async ethWatchAssetRequestApprove({ id }: RequestIdOnly): Promise<boolean> {
    const queued = this.state.requestStores.evmAssets.getRequest(id)

    assert(queued, "Unable to find request")
    const { resolve, token } = queued

    await db.tokens.put(token)
    talismanAnalytics.capture("add asset evm", {
      contractAddress: token.contractAddress,
      symbol: token.symbol,
      network: token.evmNetwork,
      isCustom: true,
    })

    resolve(true)

    return true
  }

  private async ethRequest<TEthMessageType extends keyof EthRequestSignatures>(
    id: string,
    chainId: number,
    request: EthRequestArguments<TEthMessageType>
  ): Promise<unknown> {
    const provider = await getProviderForEvmNetworkId(chainId)
    assert(provider, `No healthy RPCs available for provider for chain ${chainId}`)
    const result = await provider.send(request.method, request.params as unknown as any[])
    // eslint-disable-next-line no-console
    console.debug(request.method, request.params, result)
    return result
  }

  public async handle<TMessageType extends MessageTypes>(
    id: string,
    type: TMessageType,
    request: RequestTypes[TMessageType],
    port: Port
  ): Promise<ResponseType<TMessageType>> {
    switch (type) {
      case "pri(eth.signing.approveSignAndSend)":
        return this.signAndSendApprove(request as EthApproveSignAndSend)

      case "pri(eth.signing.approveSign)":
        return await this.signApprove(request as RequestIdOnly)

      case "pri(eth.signing.cancel)":
        return this.signingCancel(request as RequestIdOnly)

      // --------------------------------------------------------------------
      // ethereum watch asset requests handlers -----------------------------
      // --------------------------------------------------------------------
      case "pri(eth.watchasset.requests.cancel)":
        return this.ethWatchAssetRequestCancel(request as RequestIdOnly)

      case "pri(eth.watchasset.requests.approve)":
        return this.ethWatchAssetRequestApprove(request as RequestIdOnly)

      case "pri(eth.watchasset.requests.subscribe)":
        return this.state.requestStores.evmAssets.subscribe<"pri(eth.watchasset.requests.subscribe)">(
          id,
          port
        )

      case "pri(eth.watchasset.requests.subscribe.byid)": {
        const cb = createSubscription<"pri(eth.watchasset.requests.subscribe.byid)">(id, port)
        const subscription = this.state.requestStores.evmAssets.observable.subscribe(
          (reqs: WatchAssetRequest[]) => {
            const watchAssetRequest = reqs.find((req) => req.id === (request as RequestIdOnly).id)
            if (watchAssetRequest) cb(watchAssetRequest)
          }
        )

        port.onDisconnect.addListener((): void => {
          unsubscribe(id)
          subscription.unsubscribe()
        })
        return true
      }

      // --------------------------------------------------------------------
      // ethereum network handlers ------------------------------------------
      // --------------------------------------------------------------------
      case "pri(eth.networks.add.cancel)":
        return this.ethNetworkAddCancel(request as RequestIdOnly)

      case "pri(eth.networks.add.approve)":
        return this.ethNetworkAddApprove(request as RequestIdOnly)

      case "pri(eth.networks.add.requests)":
        return this.state.requestStores.networks.getAllRequests()

      case "pri(eth.networks.add.subscribe)":
        return this.state.requestStores.networks.subscribe<"pri(eth.networks.add.subscribe)">(
          id,
          port
        )

      case "pri(eth.networks.subscribe)":
        return this.stores.evmNetworks.hydrateStore()

      case "pri(eth.networks.add.custom)": {
        const newNetwork = request as RequestTypes["pri(eth.networks.add.custom)"]

        const existing = await db.evmNetworks.get(newNetwork.id)
        if (existing && !("isCustom" in existing && existing.isCustom === true)) {
          throw new Error(`Failed to override built-in Talisman network`)
        }

        newNetwork.isCustom = true
        await db.transaction("rw", db.evmNetworks, async () => await db.evmNetworks.put(newNetwork))
        talismanAnalytics.capture("add network evm", { network: newNetwork.name, isCustom: true })
        return true
      }

      case "pri(eth.networks.removeCustomNetwork)": {
        const id = parseInt(
          (request as RequestTypes["pri(eth.networks.removeCustomNetwork)"]).id,
          10
        )

        await db.transaction("rw", db.evmNetworks, async () => await db.evmNetworks.delete(id))

        return true
      }

      case "pri(eth.networks.clearCustomNetworks)": {
        await Promise.all([
          // TODO: Only clear custom evm network native tokens,
          // this call will also clear custom erc20 tokens on non-custom evm networks
          this.stores.evmNetworks.clearCustom(),
          this.stores.tokens.clearCustom(),
        ])

        return true
      }

      case "pri(eth.request)": {
        const { chainId: ethChainId, ...rest } = request as AnyEthRequestChainId
        return this.ethRequest(id, ethChainId, rest) as any
      }
    }
    throw new Error(`Unable to handle message of type ${type}`)
  }
}
