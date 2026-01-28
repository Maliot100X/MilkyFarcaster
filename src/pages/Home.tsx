import { useState, useEffect } from "react";
import { Zap, Clock, ExternalLink, Search, Loader2, Share2, AlertCircle } from "lucide-react";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
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

const PLATFORM_WALLET = import.meta.env.NEXT_PUBLIC_PLATFORM_WALLET as `0x${string}` || "0x0000000000000000000000000000000000000000";

export function Home() {
  const { context } = useFarcaster();
  const [boosts, setBoosts] = useState<BoostedCast[]>([]);
  const [isLoadingBoosts, setIsLoadingBoosts] = useState(true);
  
  // Preview State
  const [previewUrl, setPreviewUrl] = useState("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewCast, setPreviewCast] = useState<any | null>(null);
  const [previewError, setPreviewError] = useState("");

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
          context: `User boosted a cast on MilkyFarcaster: "${contextText.substring(0, 50)}..."`
        })
      });
      const data = await res.json();
      if (data.content) setAiCastText(data.content);
    } catch (e) {
      setAiCastText(`I just boosted a cast on @milkyfarcaster! Check out the Boost Feed! 🚀`);
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

  const handlePreview = async () => {
    if (!previewUrl) return;
    setIsPreviewLoading(true);
    setPreviewError("");
    setPreviewCast(null);
    setBoostSuccess(false);

    try {
        const res = await fetch('/api/boost', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'preview', url: previewUrl })
        });
        
        if (!res.ok) throw new Error("Invalid URL or Cast not found");
        
        const data = await res.json();
        setPreviewCast(data);
    } catch (e: any) {
        setPreviewError(e.message || "Failed to load preview");
    } finally {
        setIsPreviewLoading(false);
    }
  };

  const handleBoost = async (type: 'paid' | 'free', duration: '10m' | '30m' = '10m') => {
      if (!previewCast) return;
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
                  cast: previewCast,
                  duration: type === 'free' ? '10m' : duration,
                  fid: context?.user.fid || 0
              })
          });

          if (!res.ok) {
              const errData = await res.json();
              throw new Error(errData.error || "Verification failed");
          }
          
          setBoostSuccess(true);
          generateAiCast(previewCast.text);
          setPreviewCast(null);
          setPreviewUrl("");
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
            Live Promoted Casts
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
                <p className="text-sm mt-1">Be the first to promote your cast!</p>
            </div>
        ) : (
            boosts.map((boost) => (
                <div key={boost.id} className="bg-gray-800 border border-yellow-500/30 rounded-xl p-4 shadow-lg shadow-yellow-900/10 relative overflow-hidden transition-all hover:border-yellow-500/60">
                    <div className="absolute top-0 right-0 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-bl-lg flex items-center space-x-1 z-10">
                        <Clock size={10} />
                        <Countdown target={boost.boosted_until} />
                    </div>
                    
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
                </div>
            ))
        )}
      </div>

      {/* Boost CTA / Create */}
      <div className="bg-gradient-to-br from-blue-900 to-purple-900 rounded-xl p-6 border border-blue-500/30 mt-8 shadow-xl">
        <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
            <Search className="text-blue-300" />
            <span>Boost Your Cast</span>
        </h2>
        
        {boostSuccess ? (
            <div className="text-center py-6 animate-in zoom-in">
                <div className="bg-green-500/20 text-green-400 p-4 rounded-full inline-block mb-3">
                    <Zap size={32} fill="currentColor" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Cast Boosted!</h3>
                <p className="text-sm text-gray-300 mb-4">Your cast is now live on the feed.</p>
                <button 
                    onClick={() => handleShareBoost(aiCastText)}
                    disabled={!aiCastText || aiCastText.includes("Generating")}
                    className="bg-white text-blue-900 font-bold px-6 py-3 rounded-xl flex items-center justify-center space-x-2 w-full hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                    <Share2 size={18} />
                    <span>{aiCastText.includes("Generating") ? "Generating Cast..." : "Cast Update"}</span>
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
                    <label className="text-xs text-gray-400 mb-1 block">Farcaster Cast URL</label>
                    <div className="flex space-x-2">
                        <input 
                            type="text" 
                            value={previewUrl}
                            onChange={(e) => setPreviewUrl(e.target.value)}
                            placeholder="https://warpcast.com/..." 
                            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        />
                        <button 
                            onClick={handlePreview}
                            disabled={!previewUrl || isPreviewLoading}
                            className="bg-blue-600 px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50 hover:bg-blue-500 transition-colors"
                        >
                            {isPreviewLoading ? <Loader2 className="animate-spin" size={16} /> : "Preview"}
                        </button>
                    </div>
                    {previewError && (
                        <p className="text-red-400 text-xs mt-2 flex items-center">
                            <AlertCircle size={12} className="mr-1" />
                            {previewError}
                        </p>
                    )}
                </div>

                {previewCast && (
                    <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 animate-in slide-in-from-top-2">
                        <div className="flex items-center space-x-2 mb-2">
                            <img src={previewCast.author.pfp_url} className="w-6 h-6 rounded-full" />
                            <span className="text-sm font-bold">{previewCast.author.username}</span>
                        </div>
                        <p className="text-xs text-gray-300 line-clamp-3 mb-3">{previewCast.text}</p>
                        
                        <div className="grid grid-cols-2 gap-3 mt-4">
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
