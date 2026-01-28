import { useState, useEffect } from "react";
import { Search, Skull, Trophy, Bell, Settings as SettingsIcon, ChevronRight, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFarcaster } from "../context/FarcasterContext";

type LeaderboardEntry = {
  fid: number;
  xp: number;
};

export function More() {
  const { context } = useFarcaster();
  const navigate = useNavigate();
  const [coinSearch, setCoinSearch] = useState("");
  const [deathStatus, setDeathStatus] = useState<"idle" | "dead" | "loading" | "error">("idle");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [deadCoins, setDeadCoins] = useState<any[]>([]);

  useEffect(() => {
    // Fetch recent dead coins
    fetch('/api/graveyard')
      .then(res => res.json())
      .then(data => {
        if (data.graveyard) setDeadCoins(data.graveyard);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (showLeaderboard) {
      setLoadingLeaderboard(true);
      fetch('/api/leaderboard')
        .then(res => res.json())
        .then(data => {
            if (data.leaderboard) setLeaderboard(data.leaderboard);
        })
        .catch(console.error)
        .finally(() => setLoadingLeaderboard(false));
    }
  }, [showLeaderboard]);

  const handleDeclareDead = async () => {
    if (!coinSearch || !context?.user?.fid) return;
    setDeathStatus("loading");
    
    try {
      const res = await fetch('/api/graveyard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: coinSearch, fid: context.user.fid })
      });
      
      if (res.ok) {
        setDeathStatus("dead");
        setTimeout(() => setDeathStatus("idle"), 3000);
        // Refresh list
        fetch('/api/graveyard').then(res => res.json()).then(d => d.graveyard && setDeadCoins(d.graveyard));
      } else {
        setDeathStatus("error");
      }
    } catch (e) {
      console.error(e);
      setDeathStatus("error");
    }
  };

  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    notifications: true,
    sound: true,
    haptics: true
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="p-4 space-y-6 pb-20">
      <h1 className="text-2xl font-bold">More Features</h1>
      
      {/* Shop Link */}
      <div 
        onClick={() => navigate('/shop')}
        className="bg-gradient-to-r from-purple-900 to-blue-900 border border-purple-500/50 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:opacity-90"
      >
         <div className="flex items-center space-x-3">
            <ShoppingBag className="text-purple-300" />
            <div>
                <h2 className="font-bold text-white">Shop & Subscriptions</h2>
                <p className="text-xs text-purple-200">Get Pro features & Boosts</p>
            </div>
         </div>
         <ChevronRight className="text-purple-300" />
      </div>

      {/* Notifications */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
         <div className="flex items-center space-x-2 mb-4">
            <Bell className="text-yellow-500" />
            <h2 className="text-lg font-bold text-gray-100">Notifications</h2>
         </div>
         <div className="space-y-3">
             <div className="flex items-start space-x-3 p-3 bg-gray-900/50 rounded-lg">
                <div className="bg-blue-900/30 p-2 rounded-full"><Trophy size={14} className="text-blue-400" /></div>
                <div>
                    <p className="text-sm text-gray-200">Welcome to MilkyFarcaster Phase 2!</p>
                    <p className="text-xs text-gray-500">Just now</p>
                </div>
             </div>
             <div className="flex items-start space-x-3 p-3 bg-gray-900/50 rounded-lg">
                <div className="bg-purple-900/30 p-2 rounded-full"><ShoppingBag size={14} className="text-purple-400" /></div>
                <div>
                    <p className="text-sm text-gray-200">Shop is now open! Get your boosts.</p>
                    <p className="text-xs text-gray-500">1 hour ago</p>
                </div>
             </div>
         </div>
      </div>

      {/* Coin Death Counter */}
      <div className="bg-red-900/20 border border-red-900/50 rounded-xl p-4">
         <div className="flex items-center space-x-2 mb-4">
            <Skull className="text-red-500" />
            <h2 className="text-lg font-bold text-red-100">Coin Death Counter</h2>
         </div>
         <p className="text-sm text-gray-400 mb-4">Search a coin and declare it dead to the community.</p>
         
         <div className="flex space-x-2 mb-4">
            <div className="relative flex-1">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
               <input 
                 type="text" 
                 placeholder="Search coin (e.g. $TRASH)"
                 value={coinSearch}
                 onChange={(e) => setCoinSearch(e.target.value)}
                 className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-red-500"
               />
            </div>
            <button 
              onClick={handleDeclareDead}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-lg text-sm"
            >
              Declare Dead
            </button>
         </div>
         
         {deathStatus === "dead" && (
             <div className="mb-4 bg-red-500/20 text-red-300 p-2 rounded text-center text-sm animate-pulse border border-red-500/50">
                 💀 {coinSearch} has been declared DEAD! 💀
             </div>
         )}
         
         {/* Recent Deaths */}
         {deadCoins.length > 0 && (
            <div className="space-y-2">
                <p className="text-xs text-gray-500 uppercase font-bold">Recently Deceased</p>
                <div className="flex flex-wrap gap-2">
                    {deadCoins.map((coin: any) => (
                        <span key={coin.symbol} className="text-xs bg-gray-800 border border-red-900/30 text-gray-400 px-2 py-1 rounded">
                            {coin.symbol} (x{coin.death_count})
                        </span>
                    ))}
                </div>
            </div>
         )}
      </div>

      {/* Menu List */}
      <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
         <div 
            className="p-4 border-b border-gray-700 hover:bg-gray-750 cursor-pointer"
            onClick={() => setShowLeaderboard(!showLeaderboard)}
         >
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                   <Trophy className="text-yellow-500" size={20} />
                   <span>Leaderboards</span>
                </div>
                <ChevronRight size={16} className={`text-gray-500 transition-transform ${showLeaderboard ? 'rotate-90' : ''}`} />
            </div>
            
            {showLeaderboard && (
                <div className="mt-4 space-y-2">
                    {loadingLeaderboard ? (
                        <div className="text-center text-gray-500 py-2">Loading top players...</div>
                    ) : (
                        leaderboard.map((entry, idx) => (
                            <div key={entry.fid} className="flex items-center justify-between bg-gray-900/50 p-2 rounded">
                                <div className="flex items-center space-x-3">
                                    <div className="w-6 text-center font-bold text-gray-500">
                                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-mono text-sm">FID: {entry.fid}</span>
                                    </div>
                                </div>
                                <span className="font-bold text-yellow-500">{entry.xp} XP</span>
                            </div>
                        ))
                    )}
                </div>
            )}
         </div>

         <div className="p-4 border-b border-gray-700 hover:bg-gray-750 cursor-pointer">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                   <Bell className="text-blue-500" size={20} />
                   <span>Notifications</span>
                </div>
                <div className="flex items-center space-x-2">
                   <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">3</span>
                   <ChevronRight size={16} className="text-gray-500" />
                </div>
            </div>
         </div>

         <div className="p-4 hover:bg-gray-750 cursor-pointer" onClick={() => setShowSettings(!showSettings)}>
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                   <SettingsIcon className="text-gray-400" size={20} />
                   <span>Settings</span>
                </div>
                <ChevronRight size={16} className={`text-gray-500 transition-transform ${showSettings ? 'rotate-90' : ''}`} />
            </div>
            
            {showSettings && (
                <div className="mt-4 space-y-3 p-2 bg-gray-900/50 rounded-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">Push Notifications</span>
                        <div 
                            onClick={(e) => { e.stopPropagation(); toggleSetting('notifications'); }}
                            className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${settings.notifications ? 'bg-green-500' : 'bg-gray-600'}`}
                        >
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.notifications ? 'translate-x-4' : ''}`} />
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">Sound Effects</span>
                        <div 
                            onClick={(e) => { e.stopPropagation(); toggleSetting('sound'); }}
                            className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${settings.sound ? 'bg-green-500' : 'bg-gray-600'}`}
                        >
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.sound ? 'translate-x-4' : ''}`} />
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">Haptics</span>
                        <div 
                            onClick={(e) => { e.stopPropagation(); toggleSetting('haptics'); }}
                            className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${settings.haptics ? 'bg-green-500' : 'bg-gray-600'}`}
                        >
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.haptics ? 'translate-x-4' : ''}`} />
                        </div>
                    </div>
                    <div className="pt-2 border-t border-gray-700">
                        <p className="text-xs text-gray-500 text-center">Version 2.0.0 (Base Mainnet)</p>
                    </div>
                </div>
            )}
         </div>
      </div>
    </div>
  );
}
