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
        
        // MOCK for local development if not in Farcaster
        if (!context && import.meta.env.DEV) {
           console.log("Dev mode: Mocking Farcaster Context");
           const mockContext: Context.MiniAppContext = {
             user: {
               fid: 12345,
               username: "milky-dev",
               displayName: "Milky Dev",
               pfpUrl: "https://warpcast.com/avatar.png",
             },
             client: {
               clientFid: 1,
               added: true,
             }
           };
           setContext(mockContext);
           setIsAuthenticated(true);
        } else if (context) {
          setContext(context);
          setIsAuthenticated(true);
        }
        
        sdk.actions.ready();
      } catch (error) {
        console.error("Failed to initialize Farcaster SDK:", error);
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
