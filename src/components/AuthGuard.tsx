import { useFarcaster } from "../context/FarcasterContext";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useFarcaster();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // For Phase 2, we allow web access even if not authenticated via Farcaster
  // The app pages will handle "Connect Wallet" state individually.
  return <>{children}</>;
}
