import { createContext, FC, useContext } from "react"

// This utility generates a context provider from a react hook passed as argument
// Returns an array containing the provider and the consumer hook
export const provideContext = <P, T>(useProviderContext: (props: P) => T) => {
  // automatic typing based on our hook's return type
  type ContextType = ReturnType<typeof useProviderContext>

  const Context = createContext({} as ContextType)

  const Provider: FC = ({ children, ...props }) => {
    const ctx = useProviderContext(props as P)

    return <Context.Provider value={ctx}>{children}</Context.Provider>
  }

  const useProvidedContext = () => useContext(Context)

  return [Provider, useProvidedContext] as [FC<P>, () => ContextType]
}
