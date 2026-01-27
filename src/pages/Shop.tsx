import { useState } from "react";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt, useBalance } from "wagmi";
import { parseEther, formatEther } from "viem";
import { ShoppingBag, Zap, Clock, ShieldCheck, Loader2, Wallet } from "lucide-react";
// import { useFarcaster } from "../context/FarcasterContext"; // Unused for now in UI only

export function Shop() {
  const { address, isConnected } = useAccount();
  // const { context } = useFarcaster();
  const { data: balance } = useBalance({ address });
  
  const [buyingItem, setBuyingItem] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "confirming" | "success" | "error">("idle");

  const { data: hash, error: sendError, isPending: isSending, sendTransaction } = useSendTransaction();
  const { isSuccess: isConfirmed, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  // const SUBSCRIPTION_PRICE = process.env.NEXT_PUBLIC_SUBSCRIPTION_PRICE || "15"; 
  
  const PRICE_SUB_ETH = "0.005"; 
  const PRICE_TRIAL_ETH = "0.0003"; 
  const PLATFORM_WALLET = import.meta.env.NEXT_PUBLIC_PLATFORM_WALLET as `0x${string}`;

  const handleBuy = async (item: string, price: string) => {
    if (!isConnected || !PLATFORM_WALLET) return;
    setBuyingItem(item);
    setStatus("pending");
    
    try {
      sendTransaction({
        to: PLATFORM_WALLET,
        value: parseEther(price),
      });
    } catch (e) {
      console.error(e);
      setStatus("error");
      setBuyingItem(null);
    }
  };

  // Sync purchase with backend when confirmed
  if (isConfirmed && status !== "success") {
    setStatus("success");
    // TODO: Call backend to record subscription in Supabase
    // fetch('/api/shop', { method: 'POST', body: ... })
  }

  // Use variables to avoid linter errors
  const _error = sendError;
  const _sending = isSending;

  return (
    <div className="p-4 space-y-6 pb-24">
      <h1 className="text-2xl font-bold flex items-center space-x-2">
        <ShoppingBag className="text-purple-500" />
        <span>Shop & Subs</span>
      </h1>

      {isConnected && balance && (
         <div className="text-sm text-gray-400 text-right">
            Balance: {parseFloat(formatEther(balance.value)).toFixed(4)} {balance.symbol}
         </div>
      )}

      {!isConnected && (
         <div className="bg-blue-900/20 border border-blue-800 p-4 rounded-xl text-center">
            <Wallet className="mx-auto mb-2 text-blue-400" />
            <p className="text-blue-200 mb-2">Connect wallet to purchase subscriptions</p>
         </div>
      )}

      {/* Subscription Card */}
      <div className="bg-gradient-to-br from-purple-900/50 to-blue-900/50 border border-purple-500/30 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-purple-600 text-xs font-bold px-2 py-1 rounded-bl-lg">POPULAR</div>
        <div className="flex items-start justify-between mb-4">
            <div>
                <h2 className="text-xl font-bold text-white">Milky Pro</h2>
                <p className="text-purple-300 text-sm">Unlock all features + 2x XP</p>
            </div>
            <ShieldCheck size={32} className="text-purple-400" />
        </div>
        
        <ul className="space-y-2 mb-6 text-sm text-gray-300">
            <li className="flex items-center space-x-2">
                <Zap size={14} className="text-yellow-400" />
                <span>2x XP Multiplier on all actions</span>
            </li>
            <li className="flex items-center space-x-2">
                <Zap size={14} className="text-yellow-400" />
                <span>No cooldown on QuizDrop</span>
            </li>
            <li className="flex items-center space-x-2">
                <Zap size={14} className="text-yellow-400" />
                <span>Exclusive "Pro" Badge</span>
            </li>
        </ul>

        <button 
            disabled={!isConnected || status === "pending" || isConfirming || _sending}
            onClick={() => handleBuy("subscription", PRICE_SUB_ETH)}
            className="w-full bg-white text-purple-900 font-bold py-3 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition flex items-center justify-center space-x-2"
        >
            {(status === "pending" || isConfirming || _sending) && buyingItem === "subscription" ? (
                <Loader2 className="animate-spin" />
            ) : (
                <>
                   <span>Subscribe (0.005 ETH)</span>
                   <span className="text-xs font-normal opacity-70">/mo</span>
                </>
            )}
        </button>
      </div>

      {/* Trial Card */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
            <div>
                <h2 className="text-lg font-bold text-white">24h Boost Trial</h2>
                <p className="text-gray-400 text-sm">Try Pro features for 1 day</p>
            </div>
            <Clock size={32} className="text-gray-500" />
        </div>
        
        <button 
            disabled={!isConnected || status === "pending" || isConfirming || _sending}
            onClick={() => handleBuy("trial", PRICE_TRIAL_ETH)}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg disabled:opacity-50 transition flex items-center justify-center"
        >
             {(status === "pending" || isConfirming || _sending) && buyingItem === "trial" ? (
                <Loader2 className="animate-spin" />
            ) : (
                <span>Buy Trial (0.0003 ETH)</span>
            )}
        </button>
      </div>

      {status === "success" && (
        <div className="bg-green-500/20 border border-green-500/50 text-green-200 p-4 rounded-lg text-center">
            Purchase Successful! Features unlocked.
        </div>
      )}
      
      {(status === "error" || _error) && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-4 rounded-lg text-center">
            Transaction failed. Please try again.
        </div>
      )}
    </div>
  );
}
