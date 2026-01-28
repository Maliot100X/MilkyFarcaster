import { useState, useEffect } from "react";
import { useFarcaster } from "../context/FarcasterContext";
import { Flame, Gamepad2, Wallet, Clock, Zap, Loader2, LogOut, RefreshCcw } from "lucide-react";
import { useAccount, useDisconnect, useConnect } from "wagmi";

export function Profile() {
  const { context } = useFarcaster();
  const { address, isConnected, connector } = useAccount();
  const { disconnect } = useDisconnect();
  const { connectors, connect } = useConnect();
  
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showWalletSelector, setShowWalletSelector] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!context?.user.fid) return;
      try {
        const res = await fetch(`/api/stats?fid=${context.user.fid}`);
        if (res.ok) {
          const data = await res.json();
          setProfileData(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [context?.user.fid]);

  if (loading) {
      return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;
  }

  const { gameData, user: neynarUser } = profileData || {};
  const { xp, level, title, totalBurnedUsd, totalSwappedUsd, recentActivity, rank } = gameData || { xp: 0, level: 1, title: 'Novice', totalBurnedUsd: '0.00', totalSwappedUsd: '0.00', recentActivity: [], rank: '-' };
  
  // XP Progress Calculation
  const currentLevelBaseXp = Math.pow(level - 1, 2) * 100;
  const nextLevelXp = Math.pow(level, 2) * 100;
  const progress = Math.min(100, Math.max(0, ((xp - currentLevelBaseXp) / (nextLevelXp - currentLevelBaseXp)) * 100));

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header Profile */}
      <div className="flex flex-col items-center space-y-3 relative">
        <div className="relative">
             <img 
               src={neynarUser?.pfp_url || context?.user.pfpUrl || "https://placehold.co/400"} 
               alt="Avatar" 
               className="w-24 h-24 rounded-full border-4 border-blue-500 shadow-lg shadow-blue-500/20"
             />
             <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full border border-gray-900">
                 Lvl {level}
             </div>
        </div>
        
        <div className="text-center">
          <h1 className="text-2xl font-bold">{neynarUser?.display_name || context?.user.displayName || "User"}</h1>
          <p className="text-gray-400">@{neynarUser?.username || context?.user.username || "username"}</p>
        </div>
        
        {/* Wallet Info & Switching */}
        <div className="w-full max-w-xs">
          {!isConnected ? (
             <button 
               onClick={() => setShowWalletSelector(!showWalletSelector)}
               className="w-full bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center space-x-2"
             >
               <Wallet size={16} />
               <span>Connect Wallet</span>
             </button>
          ) : (
             <div className="bg-gray-800 p-3 rounded-xl border border-gray-700 flex items-center justify-between">
                <div className="flex items-center space-x-2 overflow-hidden">
                    <Wallet size={16} className="text-green-400 flex-shrink-0" />
                    <div className="flex flex-col min-w-0">
                        <span className="text-xs text-gray-400">Connected with {connector?.name}</span>
                        <span className="text-xs font-mono text-white truncate w-32">
                           {address}
                        </span>
                    </div>
                </div>
                <div className="flex space-x-2">
                    <button onClick={() => setShowWalletSelector(!showWalletSelector)} className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600">
                        <RefreshCcw size={14} />
                    </button>
                    <button onClick={() => disconnect()} className="p-2 bg-red-900/30 text-red-400 rounded-lg hover:bg-red-900/50">
                        <LogOut size={14} />
                    </button>
                </div>
             </div>
          )}

          {/* Wallet Selector Dropdown */}
          {showWalletSelector && (
              <div className="mt-2 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden animate-in slide-in-from-top-2">
                  <p className="text-xs text-gray-400 p-3 bg-gray-900/50">Select Wallet</p>
                  {connectors.map((connector) => (
                      <button
                          key={connector.id}
                          onClick={() => {
                              connect({ connector });
                              setShowWalletSelector(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-700 border-t border-gray-700 flex items-center justify-between group"
                      >
                          <span className="font-bold text-sm">{connector.name}</span>
                          {connector.id === 'injected' && <Wallet size={14} className="text-gray-500 group-hover:text-white" />}
                          {connector.id === 'coinbaseWalletSDK' && <Zap size={14} className="text-blue-500" />}
                      </button>
                  ))}
              </div>
          )}
        </div>
      </div>

      {/* Stats Card */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl border border-gray-700 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Rank Title</span>
            <span className="text-xl font-bold text-white">{title}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Total XP</span>
            <span className="text-sm font-bold text-blue-400">{xp.toLocaleString()}</span>
          </div>
        </div>
        
        <div className="relative pt-1">
          <div className="flex mb-2 items-center justify-between">
            <span className="text-xs font-semibold text-blue-400">
                Progress to Level {level + 1}
            </span>
            <span className="text-xs font-semibold text-white">
                {Math.round(progress)}%
            </span>
          </div>
          <div className="overflow-hidden h-3 mb-4 text-xs flex rounded-full bg-gray-700">
            <div style={{ width: `${progress}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-500"></div>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-700 grid grid-cols-3 gap-2 text-center">
            <div>
                <p className="text-xs text-gray-400 mb-1">Burned Value</p>
                <p className="text-lg font-bold text-orange-500">${totalBurnedUsd}</p>
            </div>
            <div>
                <p className="text-xs text-gray-400 mb-1">Swapped Value</p>
                <p className="text-lg font-bold text-green-500">${totalSwappedUsd}</p>
            </div>
            <div>
                <p className="text-xs text-gray-400 mb-1">Global Rank</p>
                <p className="text-lg font-bold text-purple-500">#{rank || '-'}</p>
            </div>
        </div>

        {/* Prizes Info */}
        <div className="mt-4 bg-black/20 p-3 rounded-lg text-xs text-gray-400 text-center border border-white/5">
            <p className="font-bold text-yellow-500 mb-1 uppercase tracking-wide">🏆 Season Prizes</p>
            <div className="flex justify-between items-center text-[10px] space-x-1">
                <span>🥇 $50 + Boost</span>
                <span>🥈 $25 + Boost</span>
                <span>🥉 Free Sub</span>
            </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div>
        <h2 className="text-lg font-bold mb-4 flex items-center space-x-2">
            <Clock size={18} className="text-gray-400" />
            <span>Recent Activity</span>
        </h2>
        {recentActivity && recentActivity.length > 0 ? (
            <div className="space-y-3">
            {recentActivity.map((activity: any) => (
                <div key={activity.id} className="bg-gray-800/50 p-4 rounded-xl flex items-center justify-between border border-gray-700/50">
                <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${activity.type === 'burn' ? 'bg-orange-900/30 text-orange-500' : 'bg-purple-900/30 text-purple-500'}`}>
                    {activity.type === 'burn' ? <Flame size={18} /> : <Gamepad2 size={18} />}
                    </div>
                    <div>
                    <p className="font-medium text-sm text-gray-200">{activity.description}</p>
                    <p className="text-xs text-gray-500">{activity.timestamp}</p>
                    </div>
                </div>
                {activity.amount && <span className="text-orange-400 font-bold text-sm">-{parseFloat(activity.amount).toFixed(2)}</span>}
                {activity.reward && <span className="text-green-400 font-bold text-sm">+{activity.reward} XP</span>}
                </div>
            ))}
            </div>
        ) : (
            <div className="text-center py-8 text-gray-500 bg-gray-900/50 rounded-xl border border-dashed border-gray-700">
                <p>No recent activity.</p>
                <p className="text-xs mt-1">Start burning or playing!</p>
            </div>
        )}
      </div>
    </div>
  );
}
