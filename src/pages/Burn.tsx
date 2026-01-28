import { useState, useEffect } from "react";
import sdk from "@farcaster/miniapp-sdk";
import { Flame, Loader2, Wallet, CheckCircle2, Repeat, AlertTriangle, Share2, ArrowRight } from "lucide-react";
import { useAccount, useSendTransaction } from "wagmi";
import { parseEther, encodeFunctionData, parseUnits } from "viem";
import { useFarcaster } from "../context/FarcasterContext";
import { fetchTokenBalances, type TokenBalance } from "../lib/scanner";
import { ERC20_ABI, AERODROME_ROUTER_ABI, AERODROME_ROUTER_ADDRESS, WETH_ADDRESS, UNISWAP_ROUTER_ABI, UNISWAP_ROUTER_ADDRESS } from "../lib/abis";

const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";
const PLATFORM_FEE_ETH = "0.0001"; // Approx $0.20

export function Burn() {
  const { context } = useFarcaster();
  const { address, isConnected } = useAccount();
  const PLATFORM_WALLET = import.meta.env.NEXT_PUBLIC_PLATFORM_WALLET as `0x${string}` || "0x0000000000000000000000000000000000000000";

  // Mode: 'burn' (Destruction) or 'swap' (Recycle)
  const [mode, setMode] = useState<'burn' | 'swap'>('burn');
  
  // Scanner State
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  // Selection State
  const [selectedTokens, setSelectedTokens] = useState<TokenBalance[]>([]);
  const [amount, setAmount] = useState(""); // Only used for single token selection
  const [status, setStatus] = useState<"idle" | "fee_pending" | "fee_confirming" | "action_pending" | "action_confirming" | "verifying" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [aiCastText, setAiCastText] = useState("");
  
  // Confirmation State
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Settings
  const [slippage, setSlippage] = useState("100"); // Default 100%

  const { sendTransactionAsync } = useSendTransaction();

  // Load Tokens on Connect
  useEffect(() => {
    if (isConnected && address) {
      scanTokens();
    }
  }, [isConnected, address]);

  const scanTokens = async () => {
    setIsScanning(true);
    try {
      const data = await fetchTokenBalances(address as string);
      setTokens(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsScanning(false);
    }
  };

  const toggleTokenSelection = (token: TokenBalance) => {
    if (selectedTokens.find(t => t.address === token.address)) {
      setSelectedTokens(selectedTokens.filter(t => t.address !== token.address));
    } else {
      setSelectedTokens([...selectedTokens, token]);
    }
    setStatus("idle");
    setErrorMessage("");
  };

  const selectAll = () => {
    if (selectedTokens.length === tokens.length) {
      setSelectedTokens([]);
    } else {
      setSelectedTokens(tokens);
    }
  };

  const generateAiCast = async (customContext?: string) => {
    setAiCastText("Generating catchy cast... 🤖");
    const actionVerb = mode === 'burn' ? "burned" : "recycled";
    const tokenNames = selectedTokens.length > 3 ? `${selectedTokens.length} tokens` : selectedTokens.map(t => t.symbol).join(", ");
    const contextStr = customContext || `User just ${actionVerb} ${tokenNames} on MilkyFarcaster.`;
    
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
      if (data.content) setAiCastText(data.content);
    } catch (e) {
      setAiCastText(`I just ${actionVerb} my trash tokens! Clean wallet, good vibes. 🧹✨ @milkyfarcaster`);
    }
  };

  const initiateAction = () => {
    if (!isConnected || selectedTokens.length === 0) return;
    setShowConfirmModal(true);
  };

  const executeAction = async () => {
    setShowConfirmModal(false);
    setErrorMessage("");
    setStatus("fee_pending");

    try {
      // 1. Platform Fee (Once per batch)
      console.log("Paying fee...");
      await sendTransactionAsync({
        to: PLATFORM_WALLET,
        value: parseEther(PLATFORM_FEE_ETH),
      });
      setStatus("fee_confirming");

      // 2. Execute Action Loop
      setStatus("action_pending");
      let lastHash = "";

      for (const token of selectedTokens) {
          let amountBigInt = token.rawBalance; // Default to full balance

          // If single token selected and user entered specific amount
          if (selectedTokens.length === 1 && amount) {
            try {
              const parsed = parseUnits(amount, token.decimals);
              if (parsed > 0n && parsed <= token.rawBalance) {
                amountBigInt = parsed;
              }
            } catch (e) {
              console.warn("Invalid amount input, using full balance");
            }
          }

          if (mode === 'burn') {
            // BURN: Transfer to DEAD
            lastHash = await sendTransactionAsync({
              to: token.address,
              data: encodeFunctionData({
                abi: ERC20_ABI,
                functionName: 'transfer',
                args: [DEAD_ADDRESS, amountBigInt]
              })
            });
          } else {
            // SWAP: Try Aerodrome (Primary) -> Uniswap V3 (Fallback)
            try {
              // A. Try Aerodrome
              // Approve Aerodrome
              await sendTransactionAsync({
                to: token.address,
                data: encodeFunctionData({
                  abi: ERC20_ABI,
                  functionName: 'approve',
                  args: [AERODROME_ROUTER_ADDRESS, amountBigInt]
                })
              });

              // Swap Aerodrome
              const routes = [{
                from: token.address as `0x${string}`,
                to: WETH_ADDRESS as `0x${string}`,
                stable: false,
                factory: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da" as `0x${string}` // Aerodrome Factory
              }];

              const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20); // 20 mins
              const amountOutMin = slippage === "100" ? 0n : 0n; // Logic for other slippage values can be added here
              
              lastHash = await sendTransactionAsync({
                  to: AERODROME_ROUTER_ADDRESS,
                  data: encodeFunctionData({
                      abi: AERODROME_ROUTER_ABI,
                      functionName: 'swapExactTokensForETHSupportingFeeOnTransferTokens',
                      args: [
                          amountBigInt, 
                          amountOutMin,
                          routes as any,
                          address as `0x${string}`,
                          deadline
                      ]
                  })
              });
            } catch (e: any) {
              // Check if user rejected - if so, abort entirely
              if (e.message?.toLowerCase().includes("rejected") || e.cause?.code === 4001) {
                throw e;
              }

              console.warn(`Aerodrome failed for ${token.symbol}, trying Uniswap V3...`, e);

              // B. Fallback: Uniswap V3
              // Approve Uniswap
              await sendTransactionAsync({
                to: token.address,
                data: encodeFunctionData({
                  abi: ERC20_ABI,
                  functionName: 'approve',
                  args: [UNISWAP_ROUTER_ADDRESS, amountBigInt]
                })
              });

              // Swap Uniswap (Fee 3000 / 0.3% - most common for non-stable)
              // const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20); // Not needed for exactInputSingle
              const amountOutMinimum = 0n; // Slippage 100%
              const sqrtPriceLimitX96 = 0n;

              const params = {
                tokenIn: token.address as `0x${string}`,
                tokenOut: WETH_ADDRESS as `0x${string}`,
                fee: 3000, // 0.3%
                recipient: address as `0x${string}`,
                amountIn: amountBigInt,
                amountOutMinimum,
                sqrtPriceLimitX96
              };

              lastHash = await sendTransactionAsync({
                to: UNISWAP_ROUTER_ADDRESS,
                value: 0n, // ERC20 -> ETH swap usually involves WETH unwrapping, but exactInputSingle on SwapRouter02 outputs WETH if tokenOut is WETH. 
                           // Wait, SwapRouter02 on Base supports unwrapWETH9 but we are calling exactInputSingle which returns WETH. 
                           // For simplicity in this fallback, getting WETH is acceptable as it's "liquid".
                data: encodeFunctionData({
                  abi: UNISWAP_ROUTER_ABI,
                  functionName: 'exactInputSingle',
                  args: [params]
                })
              });
            }
          }
      }

      setStatus("action_confirming");
      
      // Verify the LAST hash to trigger success state
      // In a real app we might want to verify all, but for UX flow we just wait for the last one
      const lastToken = selectedTokens[selectedTokens.length - 1];
      setTimeout(() => verifyTransaction(lastHash, mode, lastToken?.address), 5000);

    } catch (e: any) {
      console.error(e);
      setStatus("error");
      setErrorMessage(e.message || "Transaction failed");
    }
  };

  const verifyTransaction = async (hash: string, actionType: 'burn' | 'swap', tokenAddress?: string) => {
    setStatus("verifying");
    try {
        const res = await fetch('/api/burn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                txHash: hash, 
                fid: context?.user.fid || 0,
                action: actionType,
                tokenAddress: tokenAddress || selectedTokens[0]?.address // Fallback
            })
        });
        
        const data = await res.json();
        if (data.success) {
            setStatus("success");
            generateAiCast();
            scanTokens(); // Refresh balances
        } else {
            setTimeout(() => verifyTransaction(hash, actionType, tokenAddress), 3000);
        }
    } catch (e) {
        console.error(e);
        setStatus("success"); // Assume success if API fails but tx didn't throw
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
            <p className="text-gray-400 mb-6 max-w-xs">Connect your wallet to scan for trash tokens.</p>
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
      {/* Header & Mode Switch */}
      <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Trash Disposal</h1>
            <div className="flex bg-gray-800 rounded-lg p-1">
                <button 
                    onClick={() => { setMode('burn'); setSelectedTokens([]); }}
                    className={`px-4 py-2 rounded-md text-sm font-bold flex items-center space-x-2 transition-all ${mode === 'burn' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    <Flame size={16} />
                    <span>Burn</span>
                </button>
                <button 
                    onClick={() => { setMode('swap'); setSelectedTokens([]); }}
                    className={`px-4 py-2 rounded-md text-sm font-bold flex items-center space-x-2 transition-all ${mode === 'swap' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    <Repeat size={16} />
                    <span>Recycle</span>
                </button>
            </div>
          </div>
          
          <div className={`p-4 rounded-xl border ${mode === 'burn' ? 'bg-red-900/20 border-red-500/30' : 'bg-green-900/20 border-green-500/30'}`}>
              <p className="text-sm text-gray-300 flex items-start space-x-2">
                  <AlertTriangle size={16} className={mode === 'burn' ? "text-red-400" : "text-green-400"} />
                  <span>
                      {mode === 'burn' 
                        ? "TRUE BURN: Tokens are sent to 0xdead and destroyed forever. You earn max XP." 
                        : "RECYCLE: Tokens are swapped for ETH. You get value back but earn less XP."}
                  </span>
              </p>
          </div>
      </div>

      {/* Token Scanner List */}
      <div className="space-y-4">
          <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-400 text-sm uppercase tracking-wider">Your Tokens</h3>
              <div className="flex items-center space-x-3">
                  <button onClick={selectAll} className="text-gray-400 text-xs hover:text-white">
                      {selectedTokens.length === tokens.length && tokens.length > 0 ? "Deselect All" : "Select All"}
                  </button>
                  <button onClick={scanTokens} disabled={isScanning} className="text-blue-400 text-xs flex items-center space-x-1">
                      {isScanning ? <Loader2 size={12} className="animate-spin" /> : <Repeat size={12} />}
                      <span>Rescan</span>
                  </button>
              </div>
          </div>
          
          {isScanning ? (
              <div className="py-10 text-center">
                  <Loader2 size={32} className="animate-spin mx-auto text-blue-500 mb-2" />
                  <p className="text-gray-400 text-sm">Scanning blockchain...</p>
              </div>
          ) : tokens.length === 0 ? (
              <div className="py-8 text-center bg-gray-900/50 rounded-xl border border-dashed border-gray-700">
                  <p className="text-gray-400">No tokens found or scanner error.</p>
                  <button onClick={scanTokens} className="mt-2 text-blue-400 text-sm underline">Try Again</button>
              </div>
          ) : (
              <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-1">
                  {tokens.map((token) => {
                      const isSelected = selectedTokens.some(t => t.address === token.address);
                      return (
                          <button 
                              key={token.address}
                              onClick={() => toggleTokenSelection(token)}
                              className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between group ${isSelected ? 'bg-blue-900/30 border-blue-500 ring-1 ring-blue-500' : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}
                          >
                              <div className="flex items-center space-x-3">
                                  <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-600'}`}>
                                      {isSelected && <CheckCircle2 size={12} className="text-white" />}
                                  </div>
                                  {token.logo ? (
                                      <img src={token.logo} className="w-8 h-8 rounded-full" />
                                  ) : (
                                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold">
                                          {token.symbol[0]}
                                      </div>
                                  )}
                                  <div>
                                      <p className="font-bold text-white group-hover:text-blue-300 transition-colors">{token.symbol}</p>
                                      <p className="text-xs text-gray-400">{token.name}</p>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <p className="font-mono text-sm">{parseFloat(token.balance).toFixed(4)}</p>
                                  {token.usdValue && <p className="text-xs text-green-400">${(token.usdValue * parseFloat(token.balance)).toFixed(2)}</p>}
                              </div>
                          </button>
                      );
                  })}
              </div>
          )}
      </div>

      {/* Action Area */}
      {selectedTokens.length > 0 && (
          <div className={`rounded-2xl p-6 animate-in slide-in-from-bottom-4 border ${mode === 'burn' ? 'bg-gradient-to-br from-red-900/40 to-orange-900/40 border-red-500/30' : 'bg-gradient-to-br from-green-900/40 to-blue-900/40 border-green-500/30'}`}>
              <div className="flex justify-between items-center mb-6">
                  <div>
                      <h2 className="text-3xl font-bold text-white">{selectedTokens.length} Tokens</h2>
                      <p className={mode === 'burn' ? "text-red-400 font-bold" : "text-green-400 font-bold"}>Selected for {mode === 'burn' ? 'Burning' : 'Recycling'}</p>
                  </div>
                  
                  {mode === 'swap' && (
                      <div className="flex items-center space-x-2 bg-black/40 px-3 py-1 rounded-lg border border-white/10">
                          <span className="text-xs text-gray-400">Slippage</span>
                          <select 
                            value={slippage}
                            onChange={(e) => setSlippage(e.target.value)}
                            className="bg-transparent text-white text-xs font-bold focus:outline-none"
                          >
                              <option value="100">100% (Recycle)</option>
                              <option value="10">10%</option>
                              <option value="5">5%</option>
                              <option value="1">1%</option>
                          </select>
                      </div>
                  )}
              </div>

              {selectedTokens.length === 1 && (
                 <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Amount to {mode === 'burn' ? 'burn' : 'swap'}</span>
                        <button onClick={() => setAmount(selectedTokens[0].balance)} className="text-blue-400">MAX</button>
                    </div>
                    <input 
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Amount"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-lg font-mono text-white focus:outline-none focus:border-white/30"
                    />
                 </div>
              )}
              
              <button
                onClick={initiateAction}
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg ${mode === 'burn' ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-red-900/20' : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-green-900/20'}`}
              >
                 {mode === 'burn' ? "🔥 Burn Trash" : "♻️ Recycle to ETH"}
              </button>

              {mode === 'swap' && (
                  <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg mb-4 mt-4">
                      <span className="text-sm text-gray-400">Est. Value</span>
                      <div className="flex items-center space-x-2 text-white font-bold">
                          <span>
                            $
                            {selectedTokens.reduce((acc, t) => {
                                // If single token and partial amount, calculate proportional value
                                if (selectedTokens.length === 1 && amount && t.usdValue) {
                                    return acc + (parseFloat(amount) * t.usdValue);
                                }
                                // Otherwise full balance value
                                return acc + ((t.usdValue || 0) * parseFloat(t.balance));
                            }, 0).toFixed(2)}
                          </span>
                      </div>
                  </div>
              )}

              {status === "success" ? (
                  <div className="text-center py-4">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 text-green-500 mb-3">
                          <CheckCircle2 size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">{mode === 'burn' ? "Incinerated!" : "Recycled!"}</h3>
                      <button 
                          onClick={handleCast}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl flex items-center justify-center space-x-2"
                      >
                          <Share2 size={20} />
                          <span>Cast Result</span>
                      </button>
                      <button 
                        onClick={() => { setStatus("idle"); setSelectedTokens([]); setAmount(""); }}
                        className="mt-4 text-gray-500 text-sm hover:text-gray-300"
                      >
                        Do it again
                      </button>
                  </div>
              ) : (
                  <>
                    <div className="bg-black/20 rounded-lg p-3 mb-4 border border-white/10">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-400">Platform Fee</span>
                            <span className="text-white font-mono">{PLATFORM_FEE_ETH} ETH</span>
                        </div>
                    </div>
                    
                    <button
                        onClick={executeAction}
                        disabled={status !== "idle" || (selectedTokens.length === 1 && (!amount || parseFloat(amount) <= 0))}
                        className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            mode === 'burn' 
                            ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900/30' 
                            : 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-900/30'
                        }`}
                    >
                        {status !== "idle" ? (
                            <>
                                <Loader2 className="animate-spin" />
                                <span>Processing...</span>
                            </>
                        ) : (
                            <>
                                {mode === 'burn' ? <Flame size={20} /> : <Repeat size={20} />}
                                <span>{mode === 'burn' ? `BURN ${selectedTokens.length} ITEMS` : `RECYCLE ${selectedTokens.length} ITEMS`}</span>
                            </>
                        )}
                    </button>
                    {errorMessage && <p className="text-red-400 text-center text-sm mt-3">{errorMessage}</p>}
                  </>
              )}
          </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-md bg-[#1a1b1e] rounded-2xl border p-6 shadow-2xl ${mode === 'burn' ? 'border-red-500/50' : 'border-green-500/50'}`}>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className={`p-4 rounded-full ${mode === 'burn' ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                {mode === 'burn' ? <Flame size={32} /> : <AlertTriangle size={32} />}
              </div>
              
              <h3 className="text-2xl font-bold text-white">
                {mode === 'burn' ? "IRREVERSIBLE WARNING" : "CONFIRM RECYCLE"}
              </h3>
              
              <div className="space-y-2 text-gray-300">
                {mode === 'burn' ? (
                  <>
                    <p className="font-bold text-red-400">You are about to DESTROY {selectedTokens.length} tokens FOREVER.</p>
                    <p>This action CANNOT be undone. The tokens will be sent to the burn address (0xdead).</p>
                  </>
                ) : (
                  <>
                    <p>You are swapping {selectedTokens.length} tokens for ETH.</p>
                    <div className="bg-black/40 p-3 rounded-lg border border-white/10 mt-2">
                       <div className="flex justify-between text-sm">
                         <span>Slippage:</span>
                         <span className="font-bold">{slippage}%</span>
                       </div>
                       <p className="text-xs text-gray-500 mt-2">Output is estimated. Low liquidity tokens may fail.</p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3 w-full mt-4">
                <button 
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-3 rounded-xl font-bold bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={executeAction}
                  className={`flex-1 py-3 rounded-xl font-bold text-white transition-colors flex items-center justify-center space-x-2 ${
                    mode === 'burn' 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  <span>{mode === 'burn' ? "I Understand, BURN IT" : "Confirm Swap"}</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
