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

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4 text-center">
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p className="mb-6 text-gray-400">
          This app is only available within Farcaster.
        </p>
        <div className="p-4 bg-gray-800 rounded-lg">
          <p className="text-sm">Please open this Mini App from a Farcaster client like Warpcast.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
