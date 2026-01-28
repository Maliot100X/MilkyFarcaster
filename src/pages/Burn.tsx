import { useState } from "react";
import sdk from "@farcaster/miniapp-sdk";
import { Flame, Loader2, Wallet, AlertTriangle, CheckCircle2, Share2, Search } from "lucide-react";
import { useAccount, useSendTransaction, useReadContracts, useReadContract } from "wagmi";
import { parseEther, parseUnits, formatUnits, erc20Abi, encodeFunctionData } from "viem";
import { useFarcaster } from "../context/FarcasterContext";

// Hardcoded "Trash" Coins for Base Mainnet
const TRASH_TOKENS = [
  { symbol: "DEGEN", name: "Degen", address: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed" as `0x${string}`, decimals: 18 },
  { symbol: "TOSHI", name: "Toshi", address: "0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4" as `0x${string}`, decimals: 18 },
  { symbol: "BRETT", name: "Brett", address: "0x532f27101965dd16442E59d40670FaF5eBB142E4" as `0x${string}`, decimals: 18 },
  { symbol: "TYBG", name: "Base God", address: "0x0d97F261b1e88845184f678e2d1e7a98D9FD38dE" as `0x${string}`, decimals: 18 },
];

const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";
// $0.20 approx in ETH (assuming $2500/ETH -> 0.00008, using 0.0001 for safety/simplicity)
const PLATFORM_FEE_ETH = "0.0001"; 

export function Burn() {
  const { context } = useFarcaster();
  const { address, isConnected } = useAccount();
  const PLATFORM_WALLET = import.meta.env.NEXT_PUBLIC_PLATFORM_WALLET as `0x${string}` || "0x0000000000000000000000000000000000000000";

  // State
  const [selectedToken, setSelectedToken] = useState<typeof TRASH_TOKENS[0] | null>(null);
  const [customTokenAddress, setCustomTokenAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [burnStatus, setBurnStatus] = useState<"idle" | "fee_pending" | "fee_confirming" | "burn_pending" | "burn_confirming" | "verifying" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [aiCastText, setAiCastText] = useState("");

  // Transaction Hooks
  const { sendTransactionAsync } = useSendTransaction();

  // Fetch Balances for Hardcoded Tokens
  const { data: balances, refetch: refetchBalances } = useReadContracts({
    contracts: TRASH_TOKENS.map(t => ({
      address: t.address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    })),
    query: {
        enabled: !!address,
    }
  });

  // Fetch Custom Token Details if provided
  const { data: customDecimals } = useReadContract({
      address: customTokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: 'decimals',
      query: { enabled: !!customTokenAddress && customTokenAddress.startsWith('0x') && customTokenAddress.length === 42 }
  });
  const { data: customSymbol } = useReadContract({
      address: customTokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: 'symbol',
      query: { enabled: !!customTokenAddress && customTokenAddress.startsWith('0x') && customTokenAddress.length === 42 }
  });
  const { data: customBalance } = useReadContract({
      address: customTokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
      query: { enabled: !!customTokenAddress && customTokenAddress.startsWith('0x') && customTokenAddress.length === 42 && !!address }
  });

  // Handle Token Selection
  const handleSelectToken = (token: typeof TRASH_TOKENS[0]) => {
      setSelectedToken(token);
      setCustomTokenAddress("");
      setAmount("");
      setBurnStatus("idle");
  };

  const handleUseCustomToken = () => {
      if (customTokenAddress && customSymbol && customDecimals) {
          setSelectedToken({
              symbol: customSymbol as string,
              name: "Custom",
              address: customTokenAddress as `0x${string}`,
              decimals: Number(customDecimals)
          });
      }
  };

  // Main Burn Flow
  const handleBurnSequence = async () => {
    if (!isConnected || !selectedToken || !amount) return;
    setErrorMessage("");
    
    try {
        // Step 1: Pay Platform Fee
        setBurnStatus("fee_pending");
        console.log("Paying platform fee to:", PLATFORM_WALLET);
        
        await sendTransactionAsync({
            to: PLATFORM_WALLET,
            value: parseEther(PLATFORM_FEE_ETH),
        });
        
        setBurnStatus("fee_confirming");
        
        // Step 2: Burn Token (Transfer to DEAD)
        setBurnStatus("burn_pending");
        const burnAmountBigInt = parseUnits(amount, selectedToken.decimals);
        
        const burnHash = await sendTransactionAsync({
            to: selectedToken.address,
            data: encodeFunctionData({
                abi: erc20Abi,
                functionName: 'transfer',
                args: [DEAD_ADDRESS, burnAmountBigInt]
            })
        }); 
        
        setBurnStatus("burn_confirming");

        // Wait for Burn Receipt
        setTimeout(() => verifyBurn(burnHash, selectedToken.address), 5000);

    } catch (error: any) {
        console.error(error);
        setBurnStatus("error");
        setErrorMessage(error.message || "Transaction failed");
    }
  };

  const handleBurnAll = async () => {
      if (!isConnected || !balances) return;
      
      const tokensToBurn = TRASH_TOKENS.map((token, idx) => {
          const bal = balances[idx]?.result as bigint;
          return { ...token, balance: bal };
      }).filter(t => t.balance && t.balance > 0n);

      if (tokensToBurn.length === 0) {
          setErrorMessage("No trash tokens found to burn.");
          return;
      }

      setErrorMessage("");
      setBurnStatus("fee_pending");

      try {
          // 1. Pay Fee (Once for the batch)
          await sendTransactionAsync({
              to: PLATFORM_WALLET,
              value: parseEther(PLATFORM_FEE_ETH),
          });

          setBurnStatus("burn_pending");

          // 2. Burn Each Token
          const burnHashes: { hash: `0x${string}`, token: `0x${string}` }[] = [];
          for (const token of tokensToBurn) {
              const hash = await sendTransactionAsync({
                  to: token.address,
                  data: encodeFunctionData({
                      abi: erc20Abi,
                      functionName: 'transfer',
                      args: [DEAD_ADDRESS, token.balance]
                  })
              });
              burnHashes.push({ hash, token: token.address });
          }

          setBurnStatus("burn_confirming");
          
          // Verify all
          setTimeout(async () => {
              setBurnStatus("verifying");
              for (const { hash, token } of burnHashes) {
                  await verifyBurn(hash, token, true);
              }
              setBurnStatus("success");
              generateAiCast(`User just burned ${tokensToBurn.length} different trash tokens in one go! Total cleanup on MilkyFarcaster!`);
          }, 5000);

      } catch (error: any) {
          console.error(error);
          setBurnStatus("error");
          setErrorMessage(error.message || "Batch burn failed");
      }
  };

  const verifyBurn = async (hash: string, tokenAddr?: string, skipAi: boolean = false) => {
      setBurnStatus("verifying");
      try {
          const res = await fetch('/api/burn', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  txHash: hash, 
                  fid: context?.user.fid || 0, // Fallback for web users
                  tokenAddress: tokenAddr || selectedToken?.address 
              })
          });
          
          const data = await res.json();
          if (data.success) {
              setBurnStatus("success"); // Note: In batch, this might be called multiple times.
              refetchBalances();
              if (!skipAi) generateAiCast();
          } else {
              // Retry verification if backend hasn't indexed yet
              setTimeout(() => verifyBurn(hash, tokenAddr, skipAi), 3000);
          }
      } catch (e) {
          console.error("Verification error", e);
          // Assuming success if tx confirmed but api fails for now
          setBurnStatus("success"); 
      }
  };

  const generateAiCast = async (customContext?: string) => {
    setAiCastText("Generating catchy cast... 🤖");
    const contextStr = customContext || `User burned ${amount} ${selectedToken?.symbol} ($${amount} USD value) on MilkyFarcaster.`;
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_cast_text',
          context: contextStr
        })
      });
      
      const data = await res.json();
      if (data.content) {
        setAiCastText(data.content);
      } else {
        throw new Error("No content returned");
      }
    } catch (e) {
      // Fallback
      const texts = [
          `I just purged my wallet! 🗑️🔥 Bye bye trash! @milkyfarcaster`,
          `Cleaned up my wallet by burning trash tokens. Feels good! 🧹✨ @milkyfarcaster`,
          `Sacrificed trash to the crypto gods. 🙏🔥 @milkyfarcaster`
      ];
      setAiCastText(texts[Math.floor(Math.random() * texts.length)]);
    }
  };

  const handleCast = () => {
      const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(aiCastText)}&embeds[]=https://milky-farcaster.vercel.app/`;
      sdk.actions.openUrl(url);
  };



  if (!isConnected) {
      return (
          <div className="p-8 flex flex-col items-center justify-center text-center h-[60vh]">
              <Wallet size={64} className="text-gray-600 mb-6" />
              <h2 className="text-2xl font-bold mb-2">Connect Wallet</h2>
              <p className="text-gray-400 mb-6 max-w-xs">Connect your wallet to start burning trash tokens and earning XP.</p>
              <button 
                  onClick={() => sdk.actions.openUrl("https://warpcast.com/settings/wallets")}
                  className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg shadow-blue-900/20"
              >
                  Connect
              </button>
          </div>
      );
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="flex items-center space-x-3">
          <div className="bg-orange-500/20 p-2 rounded-lg">
              <Flame className="text-orange-500" size={24} />
          </div>
          <div>
              <h1 className="text-2xl font-bold">Incinerator</h1>
              <p className="text-xs text-gray-400">Burn ERC20 tokens • Earn XP</p>
          </div>
      </div>

      {/* Token Selection */}
      <div className="space-y-4">
          <h3 className="font-bold text-gray-400 text-sm uppercase tracking-wider">Select Token to Burn</h3>
          
          <div className="grid grid-cols-2 gap-3">
              {TRASH_TOKENS.map((token, idx) => {
                  const balance = balances?.[idx]?.result;
                  const fmtBalance = balance ? formatUnits(balance as bigint, token.decimals) : "0";
                  const isSelected = selectedToken?.address === token.address;
                  
                  return (
                      <button 
                          key={token.symbol}
                          onClick={() => handleSelectToken(token)}
                          className={`p-3 rounded-xl border text-left transition-all ${isSelected ? 'bg-orange-900/30 border-orange-500 ring-1 ring-orange-500' : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}
                      >
                          <div className="flex justify-between items-start mb-2">
                              <span className="font-bold text-white">{token.symbol}</span>
                              {isSelected && <CheckCircle2 size={16} className="text-orange-500" />}
                          </div>
                          <p className="text-xs text-gray-400 truncate">{token.name}</p>
                          <p className="text-sm font-mono text-gray-200 mt-1">{parseFloat(fmtBalance).toFixed(2)}</p>
                      </button>
                  );
              })}
          </div>

          {/* Custom Token Input */}
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
              <div className="flex items-center space-x-2 mb-2">
                  <Search size={16} className="text-gray-400" />
                  <span className="text-sm font-bold">Load Custom Token</span>
              </div>
              <div className="flex space-x-2">
                  <input 
                      type="text" 
                      placeholder="0x..." 
                      value={customTokenAddress}
                      onChange={(e) => setCustomTokenAddress(e.target.value)}
                      className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-orange-500"
                  />
                  <button 
                      onClick={handleUseCustomToken}
                      disabled={!customSymbol}
                      className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                  >
                      Load
                  </button>
              </div>
              {customSymbol && (
                   <div className="mt-2 text-xs text-green-400 flex items-center">
                       <CheckCircle2 size={12} className="mr-1" />
                       Found: {customSymbol} (Bal: {customBalance ? formatUnits(customBalance as bigint, Number(customDecimals)) : '0'})
                   </div>
              )}
          </div>
          
          {/* Burn All Button */}
          {!selectedToken && (
             <button
                onClick={handleBurnAll}
                className="w-full mt-4 bg-red-900/30 border border-red-800 text-red-400 font-bold py-3 rounded-xl hover:bg-red-900/50 transition-colors flex items-center justify-center space-x-2"
             >
                 <Flame size={18} />
                 <span>BURN ALL TRASH</span>
             </button>
          )}
      </div>

      {/* Batch Burn Status */}
      {!selectedToken && burnStatus !== "idle" && (
          <div className="bg-gradient-to-br from-red-900/40 to-orange-900/40 border border-red-500/30 rounded-2xl p-6 mt-4 animate-in slide-in-from-bottom-4">
              <h3 className="text-xl font-bold text-white mb-4 text-center">Batch Incineration</h3>
               <div className="flex flex-col items-center justify-center space-y-4">
                    {burnStatus === "success" ? (
                        <>
                            <CheckCircle2 size={48} className="text-green-500" />
                            <p className="text-green-400 font-bold">All Trash Burned!</p>
                             <button 
                                onClick={handleCast}
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl flex items-center justify-center space-x-2"
                            >
                                <Share2 size={20} />
                                <span>Cast Result</span>
                            </button>
                             <button 
                                onClick={() => setBurnStatus("idle")} 
                                className="mt-2 text-gray-500 text-sm hover:text-gray-300"
                            >
                                Done
                            </button>
                        </>
                    ) : (
                        <>
                             <Loader2 size={32} className="animate-spin text-orange-500" />
                             <p className="text-gray-300">
                                 {burnStatus === "fee_pending" && "Processing Fee..."}
                                 {burnStatus === "burn_pending" && "Burning Tokens..."}
                                 {burnStatus === "verifying" && "Verifying Burns..."}
                             </p>
                        </>
                    )}
               </div>
               {errorMessage && <p className="text-red-500 text-center mt-2">{errorMessage}</p>}
          </div>
      )}

      {/* Burn Action Area */}
      {selectedToken && (
          <div className="bg-gradient-to-br from-orange-900/40 to-red-900/40 border border-orange-500/30 rounded-2xl p-6 animate-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center mb-6">
                  <div>
                      <h2 className="text-3xl font-bold text-white">{amount || "0"}</h2>
                      <p className="text-orange-400 font-bold">{selectedToken.symbol}</p>
                  </div>
                  <div className="text-right">
                      <button 
                          onClick={() => {
                              // Find balance
                              if (selectedToken.name === "Custom") {
                                   setAmount(customBalance ? formatUnits(customBalance as bigint, selectedToken.decimals) : "0");
                              } else {
                                   const idx = TRASH_TOKENS.findIndex(t => t.address === selectedToken.address);
                                   const bal = balances?.[idx]?.result;
                                   if (bal) setAmount(formatUnits(bal as bigint, selectedToken.decimals));
                              }
                          }}
                          className="text-xs bg-orange-500/20 text-orange-300 px-2 py-1 rounded hover:bg-orange-500/30 transition-colors"
                      >
                          MAX
                      </button>
                  </div>
              </div>

              <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value="0" 
                  // Simple slider not linked to amount for demo, input field below
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer mb-4 hidden" 
              />
              
              <input 
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount to burn"
                  className="w-full bg-black/40 border border-orange-500/30 rounded-lg px-4 py-3 text-lg font-mono text-white mb-4 focus:outline-none focus:border-orange-500"
              />

              {burnStatus === "success" ? (
                  <div className="text-center py-4">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 text-green-500 mb-3">
                          <CheckCircle2 size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">Burn Complete!</h3>
                      <p className="text-gray-400 text-sm mb-4">You've cleaned up the chain and earned XP.</p>
                      
                      <button 
                          onClick={handleCast}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl flex items-center justify-center space-x-2"
                      >
                          <Share2 size={20} />
                          <span>Cast Result</span>
                      </button>
                      
                      <button 
                        onClick={() => { setBurnStatus("idle"); setAmount(""); }}
                        className="mt-4 text-gray-500 text-sm hover:text-gray-300"
                      >
                        Burn More
                      </button>
                  </div>
              ) : (
                  <>
                    <div className="bg-orange-950/50 rounded-lg p-3 mb-4 border border-orange-900/50">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-400">Platform Fee</span>
                            <span className="text-white font-mono">{PLATFORM_FEE_ETH} ETH</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Action</span>
                            <span className="text-red-400 font-bold">PERMANENT BURN</span>
                        </div>
                    </div>

                    <button 
                        onClick={handleBurnSequence}
                        disabled={!amount || Number(amount) <= 0 || burnStatus !== "idle"}
                        className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold py-4 rounded-xl flex items-center justify-center shadow-lg shadow-orange-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {burnStatus === "idle" && (
                            <>
                                <Flame className="mr-2 fill-white" />
                                <span>BURN TOKENS</span>
                            </>
                        )}
                        {(burnStatus === "fee_pending" || burnStatus === "fee_confirming") && (
                            <>
                                <Loader2 className="animate-spin mr-2" />
                                <span>Processing Fee...</span>
                            </>
                        )}
                        {(burnStatus === "burn_pending" || burnStatus === "burn_confirming") && (
                            <>
                                <Loader2 className="animate-spin mr-2" />
                                <span>Burning Tokens...</span>
                            </>
                        )}
                         {burnStatus === "verifying" && (
                            <>
                                <Loader2 className="animate-spin mr-2" />
                                <span>Verifying...</span>
                            </>
                        )}
                    </button>
                    
                    {errorMessage && (
                        <p className="text-red-500 text-xs text-center mt-3">{errorMessage}</p>
                    )}
                  </>
              )}
          </div>
      )}

      <div className="text-center text-xs text-gray-600 px-8">
          <p className="flex items-center justify-center">
             <AlertTriangle size={12} className="mr-1" />
             <span>Warning: Burnt tokens are sent to 0x...dEaD and cannot be recovered.</span>
          </p>
      </div>
    </div>
  );
}
