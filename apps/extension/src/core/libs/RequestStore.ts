import type { Port, Resolver } from "@core/types"
import { ReplaySubject } from "rxjs"
import { genericSubscription } from "@core/handlers/subscriptions"
import { MessageTypesWithSubscriptions } from "@core/types"
import { v4 } from "uuid"

interface BaseRequest<T> {
  reject: (error: Error) => void
  resolve: (result: T) => void
  id: string
}

export type TRespondableRequest<TRequest, TResponse> = BaseRequest<TResponse> & TRequest

type NewRequestCallbackFn<TRequest> = (request?: TRequest) => void
type CompletedRequestCallbackFn<TRequest, TResponse> = (
  request: TRequest,
  response?: TResponse
) => void

export abstract class RequestStore<TRequest extends { id: string; [key: string]: any }, TResponse> {
  // `requests` is the primary list of items that need responding to by the user
  protected readonly requests: Record<string, TRespondableRequest<TRequest, TResponse>> = {}
  // `observable` is kept up to date with the list of requests, and ensures that the front end
  // can easily set up a subscription to the data, and the state can show the correct message on the icon
  readonly observable = new ReplaySubject<TRequest[]>(1)

  #onNewRequestCallback?: NewRequestCallbackFn<TRequest>
  onRequestCompletedCallback?: CompletedRequestCallbackFn<TRequest, TResponse>
  /**
   * @param onNewRequestCallback - callback to be run when a new request is added to the queue
   */
  constructor(
    onNewRequestCallback: NewRequestCallbackFn<TRequest>,
    onRequestCompletedCallback?: CompletedRequestCallbackFn<TRequest, TResponse>
  ) {
    this.#onNewRequestCallback = onNewRequestCallback
    this.onRequestCompletedCallback = onRequestCompletedCallback
  }

  public get allRequests(): TRespondableRequest<TRequest, TResponse>[] {
    return Object.values(this.requests)
  }

  public clearRequests() {
    Object.keys(this.requests).forEach((key) => delete this.requests[key])
    this.observable.next(this.getAllRequests())
  }

  protected createRequest(requestOptions: Omit<TRequest, "id">): Promise<TResponse> {
    const id = v4()
    return new Promise((resolve, reject): void => {
      const newRequest = {
        id,
        ...requestOptions,
      } as TRequest
      this.requests[id] = {
        ...newRequest,
        ...this.completeRequest(id, resolve, reject),
      } as TRespondableRequest<TRequest, TResponse>
      this.observable.next(this.getAllRequests())
      this.#onNewRequestCallback && this.#onNewRequestCallback(newRequest)
    })
  }

  public subscribe<TMessageType extends MessageTypesWithSubscriptions>(id: string, port: Port) {
    return genericSubscription<TMessageType>(id, port, this.observable)
  }

  private completeRequest = (
    id: string,
    resolve: (result: TResponse) => void,
    reject: (error: Error) => void
  ): Resolver<TResponse> => {
    const complete = (response?: TResponse): void => {
      const request = this.requests[id]
      delete this.requests[id]
      this.observable.next(this.getAllRequests())
      this.onRequestCompletedCallback && this.onRequestCompletedCallback(request, response)
    }

    return {
      reject: (error: Error): void => {
        complete()
        reject(error)
      },
      resolve: (result: TResponse): void => {
        complete(result)
        resolve(result)
      },
    }
  }

  public getRequestCount(): number {
    return Object.keys(this.requests).length
  }

  public getRequest(id: string): TRespondableRequest<TRequest, TResponse> {
    return this.requests[id]
  }

  public getAllRequests(): TRequest[] {
    return this.allRequests.map(this.mapRequestToData)
  }

  protected abstract mapRequestToData(request: TRespondableRequest<TRequest, TResponse>): TRequest
}
