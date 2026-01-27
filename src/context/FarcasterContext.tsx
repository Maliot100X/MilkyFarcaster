import { createContext, useContext, useEffect, useState } from "react";
import sdk, { type Context } from "@farcaster/miniapp-sdk";

interface FarcasterContextType {
  context: Context.MiniAppContext | undefined;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const FarcasterContext = createContext<FarcasterContextType>({
  context: undefined,
  isAuthenticated: false,
  isLoading: true,
});

export function FarcasterProvider({ children }: { children: React.ReactNode }) {
  const [context, setContext] = useState<Context.MiniAppContext | undefined>();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        // Check if running in a frame/mini-app context
        // For development in browser, we can mock if needed, but for now strict check
        const context = await sdk.context;
        
        // For production web usage (outside Farcaster), we allow null context
        if (!context) {
          console.log("Running in Web Mode (No Farcaster Context)");
          // We don't set isAuthenticated to true here, letting the app handle "Connect Wallet" state
        } else {
          setContext(context);
          setIsAuthenticated(true);
        }
        
        sdk.actions.ready();
      } catch (error) {
        console.warn("Farcaster SDK init failed (likely web mode):", error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  return (
    <FarcasterContext.Provider value={{ context, isAuthenticated, isLoading }}>
      {children}
    </FarcasterContext.Provider>
  );
}

export const useFarcaster = () => useContext(FarcasterContext);
