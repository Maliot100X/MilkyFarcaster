import { useState } from "react";
import sdk from "@farcaster/miniapp-sdk";
import { Flame, Share2, Loader2, ArrowRight } from "lucide-react";

export function Burn() {
  const [amount, setAmount] = useState<number>(100);
  const [status, setStatus] = useState<"idle" | "burning" | "revealed">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleBurn = async () => {
    setStatus("burning");
    
    // Simulate TX
    setTimeout(() => {
      setTxHash("0x71c...39d"); // Mock hash
      
      // Simulate Reveal
      setTimeout(() => {
        setStatus("revealed");
      }, 1500);
    }, 2000);
  };

  const handleShare = () => {
    const text = `I just burned ${amount} $MILKY and revealed a secret! @milkyfarcaster`;
    const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`;
    sdk.actions.openUrl(url);
  };

  const reset = () => {
    setStatus("idle");
    setTxHash(null);
  };

  return (
    <div className="p-4 flex flex-col h-full min-h-[80vh] items-center justify-center text-center">
      <div className="mb-8">
        <div className="w-24 h-24 bg-orange-900/30 rounded-full flex items-center justify-center border-4 border-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.5)] mx-auto mb-4">
          <Flame size={48} className={`text-orange-500 ${status === 'burning' ? 'animate-pulse' : ''}`} />
        </div>
        <h1 className="text-2xl font-bold">Burn $MILKY</h1>
        <p className="text-gray-400">Sacrifice tokens to reveal secrets</p>
      </div>

      {status === "idle" && (
        <div className="w-full max-w-xs space-y-4">
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
             <label className="block text-sm text-gray-400 mb-2">Amount to Burn</label>
             <input 
               type="number" 
               value={amount} 
               onChange={(e) => setAmount(Number(e.target.value))}
               className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white text-center text-xl font-bold focus:outline-none focus:border-orange-500"
             />
          </div>
          
          <button 
            onClick={handleBurn}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center space-x-2"
          >
            <Flame size={20} />
            <span>BURN IT ALL</span>
          </button>
        </div>
      )}

      {status === "burning" && (
        <div className="space-y-4">
          <div className="flex flex-col items-center">
             <Loader2 size={48} className="animate-spin text-orange-500 mb-4" />
             <p className="text-lg font-bold">Submitting Transaction...</p>
             <p className="text-sm text-gray-500 font-mono mt-2">Base Network</p>
          </div>
        </div>
      )}

      {status === "revealed" && (
        <div className="w-full max-w-xs space-y-6 animate-in fade-in zoom-in duration-500">
           <div className="bg-gradient-to-br from-purple-900 to-gray-900 p-6 rounded-xl border border-purple-500 shadow-xl">
              <h2 className="text-xl font-bold text-purple-300 mb-2">Mystery Revealed!</h2>
              <div className="h-32 bg-black/50 rounded-lg mb-4 flex items-center justify-center">
                 <span className="text-4xl">🌌</span>
              </div>
              <p className="text-sm text-gray-300 mb-4">You discovered a fragment of the Milky Way map.</p>
              <div className="bg-gray-800/50 rounded p-2 text-xs font-mono text-green-400 mb-2">
                 Tx: {txHash}
              </div>
              <div className="bg-yellow-900/30 text-yellow-500 rounded p-2 text-sm font-bold">
                 +150 XP Earned
              </div>
           </div>

           <div className="grid grid-cols-2 gap-3">
             <button 
               onClick={handleShare}
               className="bg-white text-black font-bold py-3 rounded-xl flex items-center justify-center space-x-2"
             >
               <Share2 size={18} />
               <span>Share</span>
             </button>
             <button 
               onClick={reset}
               className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl flex items-center justify-center space-x-2"
             >
               <span>Burn Again</span>
               <ArrowRight size={18} />
             </button>
           </div>
        </div>
      )}
    </div>
  );
}
