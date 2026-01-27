import { Share2, Users, TrendingUp, Award } from "lucide-react";
import { useFarcaster } from "../context/FarcasterContext";
import sdk from "@farcaster/miniapp-sdk";

export function Stats() {
  const { context } = useFarcaster();
  
  // Mock Data
  const stats = {
    reputation: 850,
    archetype: "Builder",
    followers: {
      total: 12500,
      new: 124,
      whales: 15,
      mutuals: 850
    }
  };

  const handleShare = () => {
    const text = `Check out my MilkyFarcaster stats! Reputation: ${stats.reputation} | Archetype: ${stats.archetype}`;
    const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`;
    sdk.actions.openUrl(url);
  };

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
               <p className="text-gray-400 text-xs uppercase">Global Rank</p>
               <p className="text-2xl font-bold text-white">#420</p>
             </div>
          </div>

          <div className="space-y-3">
             <div className="flex items-center justify-between text-sm">
                <div className="flex items-center text-gray-300">
                   <Users size={16} className="mr-2" />
                   <span>Followers</span>
                </div>
                <span className="font-bold">{stats.followers.total.toLocaleString()}</span>
             </div>
             <div className="flex items-center justify-between text-sm">
                <div className="flex items-center text-green-400">
                   <TrendingUp size={16} className="mr-2" />
                   <span>New (24h)</span>
                </div>
                <span className="font-bold text-green-400">+{stats.followers.new}</span>
             </div>
             <div className="flex items-center justify-between text-sm">
                <div className="flex items-center text-purple-400">
                   <Award size={16} className="mr-2" />
                   <span>Whales</span>
                </div>
                <span className="font-bold text-purple-400">{stats.followers.whales}</span>
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

      {/* Additional Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
           <h3 className="text-gray-400 text-sm mb-1">Casts</h3>
           <p className="text-2xl font-bold">1,234</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
           <h3 className="text-gray-400 text-sm mb-1">Likes Given</h3>
           <p className="text-2xl font-bold">8.5k</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
           <h3 className="text-gray-400 text-sm mb-1">Recasts</h3>
           <p className="text-2xl font-bold">450</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
           <h3 className="text-gray-400 text-sm mb-1">Mentions</h3>
           <p className="text-2xl font-bold">89</p>
        </div>
      </div>
    </div>
  );
}
