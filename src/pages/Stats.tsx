import { Share2, Users, TrendingUp, Award, Loader2, Trophy, Medal } from "lucide-react";
import { useFarcaster } from "../context/FarcasterContext";
import sdk from "@farcaster/miniapp-sdk";
import { useQuery } from "@tanstack/react-query";

export function Stats() {
  const { context } = useFarcaster();
  const fid = context?.user.fid;

  // 1. Fetch User Stats (Personal Legend)
  const { data: statsData, isLoading: isStatsLoading } = useQuery({
    queryKey: ['stats', fid],
    queryFn: async () => {
      if (!fid) throw new Error("No FID");
      const res = await fetch(`/api/stats?fid=${fid}`);
      if (!res.ok) {
         console.warn("API Error, using fallback");
         return {
           reputation: 100,
           archetype: "Explorer",
           followers: { total: 0, new: 0, whales: 0 },
           user: { display_name: "Explorer", pfp_url: "" },
           gameData: { rank: 0, xp: 0, level: 1 }
         };
      }
      return res.json();
    },
    enabled: !!fid
  });

  // 2. Fetch Global Leaderboard
  const { data: leaderboardData, isLoading: isLeaderboardLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const res = await fetch('/api/leaderboard');
      if (!res.ok) throw new Error("Leaderboard fetch failed");
      return res.json();
    }
  });
  
  const stats = statsData?.stats || {
    reputation: 0,
    archetype: "Loading...",
    followers: { total: 0, new: 0, whales: 0 }
  };

  const gameData = statsData?.gameData || {
      xp: 0,
      level: 1,
      rank: 0,
      title: "Novice"
  };

  const leaderboard = leaderboardData?.leaderboard || [];

  const handleShare = () => {
    const text = `I'm ranked #${gameData.rank} on MilkyFarcaster! XP: ${gameData.xp} | Archetype: ${stats.archetype}`;
    const url = `https://milky-farcaster.vercel.app/`;
    sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(url)}`);
  };

  if (isStatsLoading || isLeaderboardLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 size={48} className="animate-spin text-blue-500 mb-4" />
        <p>Analyzing the galaxy...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Stats & Rankings</h1>
        <button 
            onClick={handleShare}
            className="p-2 bg-blue-600 rounded-full hover:bg-blue-700 transition-colors"
        >
            <Share2 size={20} />
        </button>
      </div>

      {/* Main Stat Card (User Legend) */}
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
              <div className="flex items-center gap-2 mt-1">
                 <span className="bg-blue-500/20 text-blue-300 px-3 py-0.5 rounded-full text-sm font-mono border border-blue-500/50">
                    {gameData.title}
                 </span>
                 <span className="bg-purple-500/20 text-purple-300 px-3 py-0.5 rounded-full text-sm font-mono border border-purple-500/50">
                    Lvl {gameData.level}
                 </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
             <div className="bg-black/30 p-3 rounded-lg text-center">
               <p className="text-gray-400 text-[10px] uppercase">Global Rank</p>
               <p className="text-xl font-bold text-yellow-400">#{gameData.rank > 0 ? gameData.rank : '-'}</p>
             </div>
             <div className="bg-black/30 p-3 rounded-lg text-center">
               <p className="text-gray-400 text-[10px] uppercase">Total XP</p>
               <p className="text-xl font-bold text-white">{gameData.xp.toLocaleString()}</p>
             </div>
             <div className="bg-black/30 p-3 rounded-lg text-center">
               <p className="text-gray-400 text-[10px] uppercase">Reputation</p>
               <p className="text-xl font-bold text-blue-300">{stats.reputation}</p>
             </div>
          </div>

          <div className="space-y-2">
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

      {/* Global Leaderboard */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center">
            <Trophy className="mr-2 text-yellow-500" /> Global Leaderboard
        </h2>
        
        <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
            {leaderboard.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                    No heroes yet. Be the first!
                </div>
            ) : (
                <div className="divide-y divide-gray-700">
                    {leaderboard.map((user: any, index: number) => {
                        const rank = index + 1;
                        let rankIcon = <span className="font-mono text-gray-400 w-6 text-center">{rank}</span>;
                        let rowClass = "p-4 flex items-center hover:bg-gray-700/50 transition-colors";
                        
                        if (rank === 1) {
                            rankIcon = <Trophy size={24} className="text-yellow-400 w-6" />;
                            rowClass += " bg-yellow-900/10";
                        } else if (rank === 2) {
                            rankIcon = <Medal size={24} className="text-gray-300 w-6" />;
                            rowClass += " bg-gray-900/10";
                        } else if (rank === 3) {
                            rankIcon = <Medal size={24} className="text-amber-600 w-6" />;
                            rowClass += " bg-amber-900/10";
                        }

                        const isMe = user.fid === fid;

                        return (
                            <div key={user.fid} className={`${rowClass} ${isMe ? 'bg-blue-900/20 border-l-4 border-blue-500' : ''}`}>
                                <div className="mr-4 flex justify-center w-8 font-bold text-lg">
                                    {rankIcon}
                                </div>
                                <img 
                                    src={user.pfp_url || "https://placehold.co/100"} 
                                    alt={user.username}
                                    className="w-10 h-10 rounded-full border border-gray-600 mr-3"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center">
                                        <p className="font-bold truncate text-white">
                                            {user.display_name}
                                        </p>
                                        {isMe && <span className="ml-2 text-[10px] bg-blue-600 px-1.5 py-0.5 rounded text-white">YOU</span>}
                                    </div>
                                    <p className="text-xs text-gray-400 truncate">@{user.username}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-yellow-400">{user.xp?.toLocaleString()} XP</p>
                                    <p className="text-xs text-gray-500">Level {Math.floor(Math.sqrt((user.xp || 0) / 100)) + 1}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
