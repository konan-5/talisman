import type { MessageTypes, RequestTypes, ResponseType, Port, RequestSignatures } from "@core/types"
import State from "@core/handlers/State"
import { ExtensionStore, TabStore, Store } from "@core/handlers/stores"

interface THandler {
  handle<TMessageType extends MessageTypes>(
    id: string,
    type: TMessageType,
    request: RequestTypes[TMessageType],
    port: Port,
    url?: string
  ): Promise<ResponseType<TMessageType>>
}

abstract class BaseHandler<TStore extends Store> implements THandler {
  #state: State
  #stores: TStore

  constructor(state: State, stores: TStore) {
    this.#state = state
    this.#stores = stores
  }

  protected get state() {
    return this.#state
  }

  protected get stores() {
    return this.#stores
  }

  abstract handle<TMessageType extends keyof RequestSignatures>(
    id: string,
    type: TMessageType,
    request: RequestTypes[TMessageType],
    port: Port,
    url?: string
  ): Promise<ResponseType<TMessageType>>
}

export abstract class TabsHandler extends BaseHandler<TabStore> {
  abstract handle<TMessageType extends keyof RequestSignatures>(
    id: string,
    type: TMessageType,
    request: RequestTypes[TMessageType],
    port: Port,
    url: string
  ): Promise<ResponseType<TMessageType>>
}

export abstract class ExtensionHandler extends BaseHandler<ExtensionStore> {
  /*
  // This handler should be used on the extension side only, because it
  // provides access to the passowrd store which contains sensitive data.
  */
  abstract handle<TMessageType extends keyof RequestSignatures>(
    id: string,
    type: TMessageType,
    request: RequestTypes[TMessageType],
    port: Port
  ): Promise<ResponseType<TMessageType>>
}
