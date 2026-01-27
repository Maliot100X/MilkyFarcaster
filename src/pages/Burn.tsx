import { useState, useEffect } from "react";
import sdk from "@farcaster/miniapp-sdk";
import { Flame, Share2, Loader2, ArrowRight, Wallet } from "lucide-react";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt, useBalance } from "wagmi";
import { parseEther, formatEther } from "viem";
import { useFarcaster } from "../context/FarcasterContext";

export function Burn() {
  const [amount, setAmount] = useState<string>("0.001");
  const [status, setStatus] = useState<"idle" | "burning" | "confirming" | "revealed" | "error">("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const { context } = useFarcaster();
  const selectedToken = { symbol: 'ETH' };
  
  const { address, isConnected } = useAccount();
  const { data: hash, error: sendError, isPending: isSending, sendTransaction } = useSendTransaction();
  const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: hash,
  });

  const { data: balance } = useBalance({
    address: address,
  });

  useEffect(() => {
    if (hash) {
      setTxHash(hash);
      setStatus("confirming");
    }
  }, [hash]);

  useEffect(() => {
    if (isConfirmed && hash && context?.user.fid) {
      // Call backend to verify burn and award XP
      fetch('/api/burn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: hash, fid: context.user.fid })
      })
      .then(res => res.json())
      .then(data => {
        console.log("Burn verified:", data);
        setStatus("revealed");
      })
      .catch(err => {
        console.error("Verification failed:", err);
        setStatus("revealed"); // Show reveal anyway, maybe show error warning
      });
    } else if (isConfirmed) {
       setStatus("revealed");
    }
  }, [isConfirmed, hash, context?.user.fid]);

  useEffect(() => {
    if (sendError) {
      setStatus("error");
    }
  }, [sendError]);

  const handleBurn = async () => {
    if (!isConnected || !amount) return;
    setStatus("burning");
    
    try {
      sendTransaction({
        to: "0x000000000000000000000000000000000000dEaD",
        value: parseEther(amount),
      });
    } catch (e) {
      console.error(e);
      setStatus("error");
    }
  };

  const handleShare = () => {
    const text = `I just burned ${amount} ${selectedToken.symbol} on Base and revealed a secret! @milkyfarcaster`;
    const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`;
    sdk.actions.openUrl(url);
  };

  const reset = () => {
    setStatus("idle");
    setTxHash(null);
  };

  if (!isConnected) {
    return (
      <div className="p-4 flex flex-col h-full items-center justify-center text-center">
        <Wallet size={48} className="text-gray-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Connect Wallet</h2>
        <p className="text-gray-400 mb-4">You need to connect a wallet to burn tokens.</p>
        <button 
          onClick={() => sdk.actions.openUrl("https://warpcast.com/settings/wallets")} // Fallback or use ConnectButton
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold"
        >
          Check Wallet Connection
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col h-full min-h-[80vh] items-center justify-center text-center">
      <div className="mb-8">
        <div className="w-24 h-24 bg-orange-900/30 rounded-full flex items-center justify-center border-4 border-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.5)] mx-auto mb-4">
          <Flame size={48} className={`text-orange-500 ${status === 'burning' || status === 'confirming' ? 'animate-pulse' : ''}`} />
        </div>
        <h1 className="text-2xl font-bold">Burn ETH</h1>
        <p className="text-gray-400">Sacrifice ETH on Base to reveal secrets</p>
      </div>

      {status === "idle" || status === "error" ? (
        <div className="w-full max-w-xs space-y-4">
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
             <div className="flex justify-between text-xs text-gray-400 mb-2">
                <span>Amount (ETH)</span>
                <span>Bal: {balance?.value ? parseFloat(formatEther(balance.value)).toFixed(4) : '0.00'} {balance?.symbol}</span>
             </div>
             <input 
               type="number" 
               step="0.0001"
               value={amount} 
               onChange={(e) => setAmount(e.target.value)}
               className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white text-center text-xl font-bold focus:outline-none focus:border-orange-500"
             />
          </div>
          
          {status === "error" && (
            <div className="text-red-500 text-sm bg-red-900/20 p-2 rounded">
              Transaction failed. Please try again.
            </div>
          )}

          <button 
            onClick={handleBurn}
            disabled={isSending || !amount}
            className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center space-x-2"
          >
            <Flame size={20} />
            <span>{isSending ? "Confirm in Wallet..." : "BURN IT ALL"}</span>
          </button>
        </div>
      ) : null}

      {(status === "burning" || status === "confirming") && (
        <div className="space-y-4">
          <div className="flex flex-col items-center">
             <Loader2 size={48} className="animate-spin text-orange-500 mb-4" />
             <p className="text-lg font-bold">
               {status === "burning" ? "Confirming in Wallet..." : "Waiting for Receipt..."}
             </p>
             <p className="text-sm text-gray-500 font-mono mt-2">Base Network</p>
             {txHash && (
               <a 
                 href={`https://basescan.org/tx/${txHash}`}
                 target="_blank"
                 rel="noopener noreferrer"
                 className="text-xs text-blue-400 hover:underline mt-2 flex items-center"
               >
                 View on Basescan <ArrowRight size={10} className="ml-1" />
               </a>
             )}
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
              <div className="bg-gray-800/50 rounded p-2 text-xs font-mono text-green-400 mb-2 truncate">
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
               className="bg-gray-700 text-white font-bold py-3 rounded-xl"
             >
               Burn Again
             </button>
           </div>
        </div>
      )}
    </div>
  );
}
