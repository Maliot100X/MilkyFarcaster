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
  const formattedBalance = balance ? (Number(balance.value) / 1e18).toFixed(4) : "0.0000";

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
    <div className="p-4 space-y-6 pb-20">
      <h1 className="text-2xl font-bold flex items-center">
        <Flame className="text-orange-500 mr-2" /> Burn Lab
      </h1>

      <div className="bg-orange-900/20 border border-orange-500/50 rounded-xl p-6 text-center">
        <p className="text-gray-300 mb-2">Your Balance</p>
        <h2 className="text-3xl font-bold text-white mb-4">{formattedBalance} ETH</h2>
        
        <div className="flex items-center justify-center space-x-2 bg-black/40 p-2 rounded-lg mb-6 max-w-[200px] mx-auto">
          <input 
            type="number" 
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-transparent text-center w-24 focus:outline-none font-mono text-lg"
          />
          <span className="font-bold text-orange-400">ETH</span>
        </div>

        {status === "idle" && (
          <button 
            onClick={handleBurn}
            disabled={isSending || Number(amount) <= 0}
            className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold py-3 rounded-lg flex items-center justify-center transition-all shadow-lg shadow-orange-900/50"
          >
            {isSending ? <Loader2 className="animate-spin mr-2" /> : <Flame className="mr-2" />}
            BURN IT!
          </button>
        )}

        {status === "burning" && (
          <div className="text-orange-300 animate-pulse">
            <p>Initiating combustion...</p>
            <p className="text-xs mt-2 text-gray-500">Check your wallet to confirm</p>
          </div>
        )}

        {status === "confirming" && (
          <div className="text-yellow-400">
            <Loader2 className="animate-spin mx-auto mb-2" />
            <p>Confirming transaction...</p>
            <a 
              href={`https://basescan.org/tx/${txHash}`} 
              target="_blank" 
              rel="noreferrer"
              className="text-xs underline text-gray-500 mt-1 block"
            >
              View on Explorer
            </a>
          </div>
        )}

        {status === "revealed" && (
          <div className="animate-in zoom-in duration-300">
             <div className="bg-green-500/20 border border-green-500/50 p-4 rounded-lg mb-4">
               <h3 className="font-bold text-green-400 text-lg mb-1">Burn Successful!</h3>
               <p className="text-sm text-gray-300">You earned 500 XP and purged {amount} ETH.</p>
             </div>
             <button 
               onClick={handleShare}
               className="w-full bg-white text-black font-bold py-3 rounded-lg flex items-center justify-center"
             >
               <Share2 className="mr-2" size={18} />
               Share Verification
             </button>
             <button 
               onClick={reset}
               className="w-full mt-2 text-gray-500 text-sm hover:text-white"
             >
               Burn More
             </button>
          </div>
        )}

        {status === "error" && (
            <div className="text-red-400">
                <p>Combustion Failed.</p>
                <button onClick={reset} className="text-sm underline mt-2">Try Again</button>
            </div>
        )}
      </div>

      <div className="bg-gray-800 rounded-xl p-4">
        <h3 className="font-bold mb-2 text-gray-400 text-sm uppercase">Burn History</h3>
        <div className="space-y-2">
            <div className="flex items-center justify-between text-sm bg-gray-900/50 p-2 rounded">
                <span className="font-mono text-gray-500">0x1234...5678</span>
                <span className="text-orange-400 font-bold">0.005 ETH</span>
            </div>
            {/* Real history would come from API */}
            <div className="text-center text-xs text-gray-600 mt-2">No recent burns found</div>
        </div>
      </div>
    </div>
  );
}
