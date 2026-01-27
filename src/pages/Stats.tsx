import { Share2, Users, TrendingUp, Award, Loader2 } from "lucide-react";
import { useFarcaster } from "../context/FarcasterContext";
import sdk from "@farcaster/miniapp-sdk";
import { useQuery } from "@tanstack/react-query";

export function Stats() {
  const { context } = useFarcaster();
  const fid = context?.user.fid;

  const { data: statsData, isLoading } = useQuery({
    queryKey: ['stats', fid],
    queryFn: async () => {
      if (!fid) throw new Error("No FID");
      const res = await fetch(`/api/stats?fid=${fid}`);
      if (!res.ok) {
         // Fallback for dev/mock if API fails (e.g. no key)
         console.warn("API Error, using fallback");
         return {
           reputation: 100,
           archetype: "Explorer",
           followers: { total: 0, new: 0, whales: 0 },
           user: { display_name: "Explorer", pfp_url: "" }
         };
      }
      return res.json();
    },
    enabled: !!fid
  });
  
  const stats = statsData?.stats || {
    reputation: 0,
    archetype: "Loading...",
    followers: { total: 0, new: 0, whales: 0 }
  };

  const handleShare = () => {
    const text = `Check out my MilkyFarcaster stats! Reputation: ${stats.reputation} | Archetype: ${stats.archetype}`;
    const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`;
    sdk.actions.openUrl(url);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 size={48} className="animate-spin text-blue-500 mb-4" />
        <p>Analyzing your legend...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 pb-20">
      <h1 className="text-2xl font-bold">Your Legend</h1>

      {/* Main Stat Card */}
      <div className="bg-gradient-to-br from-blue-900 to-gray-900 rounded-xl p-6 border border-blue-500 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
           <Award size={120} />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center space-x-4 mb-6">
            <img 
              src={context?.user.pfpUrl || "https://placehold.co/400"} 
              alt="Avatar" 
              className="w-20 h-20 rounded-full border-4 border-blue-400 shadow-lg"
            />
            <div>
              <h2 className="text-xl font-bold">{context?.user.displayName}</h2>
              <div className="inline-block bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm font-mono mt-1 border border-blue-500/50">
                {stats.archetype}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
             <div className="bg-black/30 p-3 rounded-lg">
               <p className="text-gray-400 text-xs uppercase">Reputation</p>
               <p className="text-2xl font-bold text-white">{stats.reputation}</p>
             </div>
             <div className="bg-black/30 p-3 rounded-lg">
               <p className="text-gray-400 text-xs uppercase">Growth</p>
               <p className="text-2xl font-bold text-white">{stats.growth || "+0%"}</p>
             </div>
          </div>

          <div className="space-y-3">
             <div className="flex items-center justify-between text-sm">
                <div className="flex items-center text-gray-300">
                   <Users size={16} className="mr-2" />
                   <span>Followers</span>
                </div>
                <span className="font-bold">{statsData?.user?.follower_count?.toLocaleString() || 0}</span>
             </div>
             <div className="flex items-center justify-between text-sm">
                <div className="flex items-center text-green-400">
                   <TrendingUp size={16} className="mr-2" />
                   <span>Following</span>
                </div>
                <span className="font-bold text-green-400">{statsData?.user?.following_count?.toLocaleString() || 0}</span>
             </div>
          </div>
        </div>
      </div>

      <button 
        onClick={handleShare}
        className="w-full bg-white text-black font-bold py-4 rounded-xl shadow-lg flex items-center justify-center space-x-2 transition-transform active:scale-95"
      >
        <Share2 size={20} />
        <span>Share Stat Card</span>
      </button>
    </div>
  );
}
