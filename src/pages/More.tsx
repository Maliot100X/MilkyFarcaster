import { useState } from "react";
import { Search, Skull, Trophy, Bell, Settings as SettingsIcon, ChevronRight } from "lucide-react";

export function More() {
  const [coinSearch, setCoinSearch] = useState("");
  const [deathStatus, setDeathStatus] = useState<"idle" | "dead">("idle");

  const handleDeclareDead = () => {
    if (!coinSearch) return;
    setDeathStatus("dead");
    setTimeout(() => setDeathStatus("idle"), 3000);
  };

  return (
    <div className="p-4 space-y-6 pb-20">
      <h1 className="text-2xl font-bold">More Features</h1>

      {/* Coin Death Counter */}
      <div className="bg-red-900/20 border border-red-900/50 rounded-xl p-4">
         <div className="flex items-center space-x-2 mb-4">
            <Skull className="text-red-500" />
            <h2 className="text-lg font-bold text-red-100">Coin Death Counter</h2>
         </div>
         <p className="text-sm text-gray-400 mb-4">Search a coin and declare it dead to the community.</p>
         
         <div className="flex space-x-2">
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
             <div className="mt-4 bg-red-500/20 text-red-300 p-2 rounded text-center text-sm animate-pulse border border-red-500/50">
                 💀 {coinSearch} has been declared DEAD! 💀
             </div>
         )}
      </div>

      {/* Menu List */}
      <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
         <div className="p-4 flex items-center justify-between border-b border-gray-700 hover:bg-gray-750 cursor-pointer">
            <div className="flex items-center space-x-3">
               <Trophy className="text-yellow-500" size={20} />
               <span>Leaderboards</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-500">
               <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">Soon</span>
               <ChevronRight size={16} />
            </div>
         </div>
         
         <div className="p-4 flex items-center justify-between border-b border-gray-700 hover:bg-gray-750 cursor-pointer">
            <div className="flex items-center space-x-3">
               <Bell className="text-blue-500" size={20} />
               <span>Notifications</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-500">
               <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">Soon</span>
               <ChevronRight size={16} />
            </div>
         </div>

         <div className="p-4 flex items-center justify-between hover:bg-gray-750 cursor-pointer">
            <div className="flex items-center space-x-3">
               <SettingsIcon className="text-gray-400" size={20} />
               <span>Settings</span>
            </div>
            <ChevronRight size={16} className="text-gray-500" />
         </div>
      </div>
      
      <div className="text-center text-xs text-gray-600 mt-8">
         MilkyFarcaster v0.1.0 (Phase 1)
      </div>
    </div>
  );
}
