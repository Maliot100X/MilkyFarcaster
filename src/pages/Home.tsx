import { useState, useEffect } from "react";
import { Zap, Clock, Search, Loader2, Share2 } from "lucide-react";
import { useAccount, useSendTransaction } from "wagmi";
import { parseEther } from "viem";
import sdk from "@farcaster/miniapp-sdk";
import { useFarcaster } from "../context/FarcasterContext";

type BoostedCast = {
  id: string;
  author_data: {
    username: string;
    pfp_url: string;
    display_name: string;
  };
  text: string;
  image?: string;
  boosted_until: number; // timestamp
  cast_url: string;
};

const PLATFORM_WALLET = import.meta.env.NEXT_PUBLIC_PLATFORM_WALLET as `0x${string}` || "0x980E5F15E788Cb653C77781099Fb739d7A1aEEd0";

import { SUPPORTED_COINS, type Coin } from "../lib/coins";

export function Home() {
  const { context } = useFarcaster();
  const [boosts, setBoosts] = useState<BoostedCast[]>([]);
  const [isLoadingBoosts, setIsLoadingBoosts] = useState(true);
  
  // Coin Boost State
  const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null);

  // Payment/Boost State
  const { isConnected } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const [isBoosting, setIsBoosting] = useState(false);
  const [boostSuccess, setBoostSuccess] = useState(false);
  const [aiCastText, setAiCastText] = useState("");
  const [subscription, setSubscription] = useState<any>(null);

  // Helper for AI Cast
  const generateAiCast = async (contextText: string) => {
    setAiCastText("Generating catchy cast... 🤖");
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_cast_text',
          context: `User boosted ${contextText} on MilkyFarcaster!`
        })
      });
      const data = await res.json();
      if (data.content) setAiCastText(data.content);
    } catch (e) {
      setAiCastText(`I just boosted ${contextText} on @milkyfarcaster! Check out the Boost Feed! 🚀`);
    }
  };


  // Fetch Boosts
  useEffect(() => {
    fetchBoosts();
    const interval = setInterval(fetchBoosts, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (context?.user?.fid) {
        fetch(`/api/stats?fid=${context.user.fid}`)
            .then(res => res.json())
            .then(data => {
                if (data.gameData?.subscription) {
                    setSubscription(data.gameData.subscription);
                }
            })
            .catch(console.error);
    }
  }, [context?.user?.fid]);

  const fetchBoosts = async () => {
    try {
        const res = await fetch('/api/boost');
        if (res.ok) {
            const data = await res.json();
            // Filter out expired (also handled by API but good for client side immediate update)
            setBoosts(data.filter((b: any) => b.boosted_until > Date.now()));
        }
    } catch (e) {
        console.error("Failed to fetch boosts");
    } finally {
        setIsLoadingBoosts(false);
    }
  };

  // Countdown Timer Logic
  useEffect(() => {
    const timer = setInterval(() => {
      // Force re-render for countdowns
      setBoosts(current => [...current]); 
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleBoost = async (type: 'paid' | 'free', duration: '10m' | '30m' = '10m') => {
      if (!selectedCoin) return;
      if (type === 'paid' && !isConnected) return;
      
      setIsBoosting(true);
      
      try {
          let hash = 'FREE_BOOST';

          if (type === 'paid') {
            const price = duration === '10m' ? '0.0003' : '0.001'; // Approx $1 and $3
            // 1. Send Payment
            hash = await sendTransactionAsync({
                to: PLATFORM_WALLET,
                value: parseEther(price)
            });
          }

          // 2. Verify & Store on Backend
          const res = await fetch('/api/boost', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  action: 'boost',
                  txHash: hash,
                  coin: selectedCoin, // Send selected coin
                  duration: type === 'free' ? '10m' : duration,
                  fid: context?.user.fid || 0
              })
          });

          if (!res.ok) {
              const errData = await res.json();
              throw new Error(errData.error || "Verification failed");
          }
          
          setBoostSuccess(true);
          generateAiCast(`${selectedCoin.name} ($${selectedCoin.symbol})`);
          setSelectedCoin(null);
          fetchBoosts(); // Refresh list

      } catch (e: any) {
          console.error(e);
          alert(`Boost failed: ${e.message}`);
      } finally {
          setIsBoosting(false);
      }
  };

  const handleShareBoost = (text: string) => {
      const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=https://milky-farcaster.vercel.app/`;
      sdk.actions.openUrl(url);
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
         <h1 className="text-2xl font-bold flex items-center space-x-2">
            <Zap className="text-yellow-400" fill="currentColor" />
            <span>Boost Feed</span>
         </h1>
         <div className="bg-yellow-900/30 border border-yellow-500/50 px-3 py-1 rounded-full text-xs text-yellow-200 animate-pulse">
            Live Boosts
         </div>
      </div>

      {/* Boosted Casts List */}
      <div className="space-y-4 min-h-[200px]">
        {isLoadingBoosts ? (
            <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-gray-500" />
            </div>
        ) : boosts.length === 0 ? (
            <div className="text-center py-10 text-gray-500 bg-gray-900/50 rounded-xl border border-dashed border-gray-700">
                <p>No active boosts right now.</p>
                <p className="text-sm mt-1">Be the first to promote your cast or coin!</p>
            </div>
        ) : (
            boosts.map((boost) => {
                const isCoin = boost.cast_url.startsWith('coin:');
                return (
                <div key={boost.id} className={`bg-gray-800 border ${isCoin ? 'border-orange-500/50' : 'border-yellow-500/30'} rounded-xl p-4 shadow-lg relative overflow-hidden transition-all hover:border-opacity-100`}>
                    <div className={`absolute top-0 right-0 ${isCoin ? 'bg-orange-600' : 'bg-yellow-500'} text-black text-xs font-bold px-2 py-1 rounded-bl-lg flex items-center space-x-1 z-10`}>
                        <Clock size={10} />
                        <Countdown target={boost.boosted_until} />
                    </div>
                    
                    {isCoin ? (
                        <div className="flex items-center space-x-4 mt-2">
                             <img src={boost.author_data.pfp_url} className="w-14 h-14 rounded-full border-2 border-orange-500 p-1" />
                             <div>
                                 <h3 className="font-bold text-xl text-white">{boost.author_data.display_name}</h3>
                                 <p className="text-sm text-gray-400 font-mono">${boost.author_data.username}</p>
                                 <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-orange-900/50 text-orange-200 border border-orange-500/30">
                                     🔥 TRENDING COIN
                                 </div>
                             </div>
                        </div>
                    ) : (
                        <div className="flex items-start space-x-3 mt-2">
                            <img src={boost.author_data.pfp_url} alt={boost.author_data.username} className="w-10 h-10 rounded-full border border-gray-600" />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-1">
                                    <p className="font-bold text-sm truncate">{boost.author_data.display_name}</p>
                                    <p className="text-gray-400 font-normal text-xs truncate">@{boost.author_data.username}</p>
                                </div>
                                <p className="text-gray-200 mt-1 text-sm break-words line-clamp-3">{boost.text}</p>
                                {boost.image && <img src={boost.image} alt="Cast media" className="mt-2 rounded-lg w-full object-cover max-h-48" />}
                            </div>
                        </div>
                    )}
                </div>
                );
            })
        )}
      </div>

      {/* Boost CTA / Create */}
      <div className="bg-gradient-to-br from-blue-900 to-purple-900 rounded-xl p-6 border border-blue-500/30 mt-8 shadow-xl">
        <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
            <Search className="text-blue-300" />
            <span>Boost a Coin</span>
        </h2>
        
        {boostSuccess ? (
            <div className="text-center py-6 animate-in zoom-in">
                <div className="bg-green-500/20 text-green-400 p-4 rounded-full inline-block mb-3">
                    <Zap size={32} fill="currentColor" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Coin Boosted!</h3>
                <p className="text-sm text-gray-300 mb-4">Your boost is now live on the feed.</p>
                <button 
                    onClick={() => handleShareBoost(aiCastText)}
                    disabled={!aiCastText || aiCastText.includes("Generating")}
                    className="bg-white text-blue-900 font-bold px-6 py-3 rounded-xl flex items-center justify-center space-x-2 w-full hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                    <Share2 size={18} />
                    <span>{aiCastText.includes("Generating") ? "Generating Cast..." : "Share Update"}</span>
                </button>
                <button 
                    onClick={() => setBoostSuccess(false)}
                    className="mt-4 text-xs text-blue-300 hover:text-white"
                >
                    Boost Another
                </button>
            </div>
        ) : (
            <div className="space-y-4">
                <div>
                    <label className="text-xs text-gray-400 mb-2 block uppercase font-bold">Select Coin</label>
                    <div className="grid grid-cols-3 gap-2">
                        {SUPPORTED_COINS.map((coin) => (
                            <button
                                key={coin.symbol}
                                onClick={() => setSelectedCoin(coin)}
                                className={`p-2 rounded-lg border flex flex-col items-center justify-center space-y-1 transition-all ${selectedCoin?.symbol === coin.symbol ? 'bg-blue-900/50 border-blue-500 ring-1 ring-blue-500' : 'bg-gray-900 border-gray-700 hover:bg-gray-800'}`}
                            >
                                <img src={coin.image} alt={coin.name} className="w-8 h-8 rounded-full" />
                                <div className="text-center">
                                    <p className="text-xs font-bold text-white">{coin.symbol}</p>
                                    <p className="text-[10px] text-gray-400">{coin.name}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {selectedCoin && (
                    <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 animate-in slide-in-from-top-2">
                        <div className="flex items-center space-x-2 mb-4">
                            <img src={selectedCoin.image} className="w-8 h-8 rounded-full" />
                            <div>
                                <h3 className="text-sm font-bold text-white">{selectedCoin.name}</h3>
                                <p className="text-xs text-gray-400">${selectedCoin.symbol}</p>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            {subscription?.status === 'active' && (
                                <button 
                                    onClick={() => handleBoost('free')} 
                                    disabled={isBoosting}
                                    className="col-span-2 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 py-3 rounded-lg text-sm font-bold flex items-center justify-center space-x-2 transition-all shadow-lg shadow-yellow-900/20"
                                >
                                    <Zap size={16} fill="currentColor" className="text-white" />
                                    <span className="text-white">Use Daily Free Boost (Subscriber)</span>
                                </button>
                            )}
                            <button 
                                onClick={() => handleBoost('paid', '10m')} 
                                disabled={isBoosting}
                                className="bg-green-600/20 hover:bg-green-600/30 border border-green-600/50 py-3 rounded-lg text-xs font-bold flex flex-col items-center transition-all"
                            >
                                <span className="text-green-400 text-lg">$1.00</span>
                                <span className="text-green-200">10 Minutes</span>
                            </button>
                            <button 
                                onClick={() => handleBoost('paid', '30m')} 
                                disabled={isBoosting}
                                className="bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/50 py-3 rounded-lg text-xs font-bold flex flex-col items-center transition-all"
                            >
                                <span className="text-purple-400 text-lg">$3.00</span>
                                <span className="text-purple-200">30 Minutes</span>
                            </button>
                        </div>
                        {isBoosting && (
                            <div className="text-center text-xs text-blue-300 mt-2 flex justify-center items-center">
                                <Loader2 className="animate-spin mr-1" size={12} />
                                Confirming transaction...
                            </div>
                        )}
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
}

function Countdown({ target }: { target: number }) {
    const [left, setLeft] = useState(Math.max(0, target - Date.now()));

    useEffect(() => {
        const i = setInterval(() => setLeft(Math.max(0, target - Date.now())), 1000);
        return () => clearInterval(i);
    }, [target]);

    if (left <= 0) return <span>Expired</span>;

    const mins = Math.floor(left / 60000);
    const secs = Math.floor((left % 60000) / 1000);
    return <span>{mins}m {secs}s</span>;
}
