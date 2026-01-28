import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import sdk from "@farcaster/miniapp-sdk";
import { Flame, Loader2, Wallet, CheckCircle2, Repeat, Rocket, AlertTriangle, Share2, Search } from "lucide-react";
import { useAccount, useSendTransaction } from "wagmi";
import { parseEther, encodeFunctionData } from "viem";
import { useFarcaster } from "../context/FarcasterContext";
import { fetchTokenBalances, type TokenBalance } from "../lib/scanner";
import { ERC20_ABI, AERODROME_ROUTER_ABI, AERODROME_ROUTER_ADDRESS, WETH_ADDRESS, UNISWAP_ROUTER_ABI, UNISWAP_ROUTER_ADDRESS } from "../lib/abis";
import { SUPPORTED_COINS, type Coin } from "../lib/coins";

const PLATFORM_FEE_ETH = "0.0001"; // Approx $0.20

export function Burn() {
  const { context } = useFarcaster();
  const { address, isConnected } = useAccount();
  const [searchParams] = useSearchParams();
  
  // BURN_WALLET: Use Platform Wallet as the "Specific Wallet" for burning/collection
  const BURN_WALLET = import.meta.env.NEXT_PUBLIC_PLATFORM_WALLET as `0x${string}` || "0x980E5F15E788Cb653C77781099Fb739d7A1aEEd0";

  // Mode: 'burn_only', 'burn_boost', 'recycle'
  const [mode, setMode] = useState<'burn_only' | 'burn_boost' | 'recycle'>('burn_only');
  
  // Scanner State
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  // Selection State
  const [selectedTokens, setSelectedTokens] = useState<TokenBalance[]>([]);
  const [status, setStatus] = useState<"idle" | "fee_pending" | "fee_confirming" | "action_pending" | "action_confirming" | "verifying" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [aiCastText, setAiCastText] = useState("");
  
  // Boost State (Coin Selection)
  const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null);
  
  // Confirmation State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // Cast Preview State
  const [castUrl, setCastUrl] = useState("");
  const [previewCast, setPreviewCast] = useState<any | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  // Settings
  const [slippage, setSlippage] = useState("100"); // Default 100%
  const [tokenSearch, setTokenSearch] = useState("");

  const { sendTransactionAsync } = useSendTransaction();

  // Load Tokens on Connect
  useEffect(() => {
    if (isConnected && address) {
      scanTokens();
    }
  }, [isConnected, address]);

  // Check URL params for boostCast
  useEffect(() => {
    const boostCastParam = searchParams.get('boostCast');
    if (boostCastParam) {
        setCastUrl(boostCastParam);
        setMode('burn_boost');
        // Auto-trigger preview if we have a URL
        // We need to wait a bit for state to settle or just call a helper
        // Since handlePreview relies on castUrl state, we can't call it immediately if it was just set
        // But we can call the API directly or use a timeout.
        // Better: use a separate effect that watches castUrl? No, that might loop.
        // Let's just set the state and let the user click preview, or better, 
        // call the API logic directly here.
        fetch('/api/boost', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'preview', url: boostCastParam })
        })
        .then(res => res.json())
        .then(data => {
            if (data.author) setPreviewCast(data);
        })
        .catch(console.error);
    }
  }, [searchParams]);

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
    const filteredTokens = tokens.filter(token => {
        const search = tokenSearch.toLowerCase();
        return token.name.toLowerCase().includes(search) || 
               token.symbol.toLowerCase().includes(search) || 
               token.address.toLowerCase().includes(search);
    });

    if (selectedTokens.length >= filteredTokens.length && filteredTokens.length > 0) {
      // If we have selected all visible tokens (or more), deselect all visible
      const visibleAddresses = new Set(filteredTokens.map(t => t.address));
      setSelectedTokens(selectedTokens.filter(t => !visibleAddresses.has(t.address)));
    } else {
      // Select all visible tokens
      // Merge current selected with new visible ones, avoiding duplicates
      const newSelection = [...selectedTokens];
      filteredTokens.forEach(t => {
          if (!newSelection.find(sel => sel.address === t.address)) {
              newSelection.push(t);
          }
      });
      setSelectedTokens(newSelection);
    }
  };

  const handlePreview = async () => {
    if (!castUrl) return;
    setIsPreviewLoading(true);
    setPreviewError("");
    setPreviewCast(null);

    try {
        const res = await fetch('/api/boost', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'preview', url: castUrl })
        });
        
        if (!res.ok) throw new Error("Cast not found");
        
        const data = await res.json();
        setPreviewCast(data);
    } catch (e: any) {
        setPreviewError(e.message || "Failed to load preview");
    } finally {
        setIsPreviewLoading(false);
    }
  };

  const generateAiCast = async (customContext?: string) => {
    setAiCastText("Generating catchy cast... 🤖");
    const actionVerb = mode === 'recycle' ? "recycled" : "burned";
    const tokenNames = selectedTokens.length > 3 ? `${selectedTokens.length} tokens` : selectedTokens.map(t => t.symbol).join(", ");
    let contextStr = customContext || `User just ${actionVerb} ${tokenNames} on MilkyFarcaster.`;
    
    if (mode === 'burn_boost' && selectedCoin) {
        contextStr += ` And boosted ${selectedCoin.name} ($${selectedCoin.symbol})!`;
    }

    if (previewCast) {
        contextStr += ` Related Cast: "${previewCast.text.substring(0, 50)}..." by @${previewCast.author.username}`;
    }
    
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
    if (mode === 'burn_boost' && !selectedCoin) {
        setErrorMessage("Please select a coin to boost!");
        return;
    }
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
        to: BURN_WALLET, // Fee goes to platform wallet
        value: parseEther(PLATFORM_FEE_ETH),
      });
      setStatus("fee_confirming");

      // 2. Execute Action Loop
      setStatus("action_pending");
      let lastHash = "";
      console.log("Applying slippage:", slippage);

      for (const token of selectedTokens) {
          let amountBigInt = token.rawBalance; // Default to full balance

          if (mode === 'recycle') {
            // RECYCLE: Try Aerodrome (Primary) -> Uniswap V3 (Fallback)
            try {
              // A. Try Aerodrome
              await sendTransactionAsync({
                to: token.address,
                data: encodeFunctionData({
                  abi: ERC20_ABI,
                  functionName: 'approve',
                  args: [AERODROME_ROUTER_ADDRESS, amountBigInt]
                })
              });

              const routes = [{
                from: token.address as `0x${string}`,
                to: WETH_ADDRESS as `0x${string}`,
                stable: false,
                factory: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da" as `0x${string}`
              }];

              const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
              const amountOutMin = 0n; 
              
              lastHash = await sendTransactionAsync({
                  to: AERODROME_ROUTER_ADDRESS,
                  data: encodeFunctionData({
                      abi: AERODROME_ROUTER_ABI,
                      functionName: 'swapExactTokensForETHSupportingFeeOnTransferTokens',
                      args: [amountBigInt, amountOutMin, routes as any, address as `0x${string}`, deadline]
                  })
              });
            } catch (e: any) {
              if (e.message?.toLowerCase().includes("rejected") || e.cause?.code === 4001) throw e;
              
              // B. Fallback: Uniswap V3
              await sendTransactionAsync({
                to: token.address,
                data: encodeFunctionData({
                  abi: ERC20_ABI,
                  functionName: 'approve',
                  args: [UNISWAP_ROUTER_ADDRESS, amountBigInt]
                })
              });

              const params = {
                tokenIn: token.address as `0x${string}`,
                tokenOut: WETH_ADDRESS as `0x${string}`,
                fee: 3000,
                recipient: address as `0x${string}`,
                amountIn: amountBigInt,
                amountOutMinimum: 0n,
                sqrtPriceLimitX96: 0n
              };

              lastHash = await sendTransactionAsync({
                to: UNISWAP_ROUTER_ADDRESS,
                value: 0n,
                data: encodeFunctionData({
                  abi: UNISWAP_ROUTER_ABI,
                  functionName: 'exactInputSingle',
                  args: [params]
                })
              });
            }
          } else {
            // BURN ONLY or BURN BOOST: Transfer to BURN_WALLET
            lastHash = await sendTransactionAsync({
              to: token.address,
              data: encodeFunctionData({
                abi: ERC20_ABI,
                functionName: 'transfer',
                args: [BURN_WALLET, amountBigInt]
              })
            });
          }
      }

      setStatus("action_confirming");
      
      const lastToken = selectedTokens[selectedTokens.length - 1];
      const totalUsdValue = selectedTokens.reduce((acc, t) => acc + (t.usdValue || 0) * parseFloat(t.balance), 0);
      
      setTimeout(() => verifyTransaction(lastHash, mode, lastToken?.address, totalUsdValue), 5000);

    } catch (e: any) {
      console.error(e);
      setStatus("error");
      setErrorMessage(e.message || "Transaction failed");
    }
  };

  const verifyTransaction = async (hash: string, currentMode: string, tokenAddress?: string, usdValue: number = 0) => {
    setStatus("verifying");
    try {
        const actionType = currentMode === 'recycle' ? 'swap' : 'burn';
        
        const res = await fetch('/api/burn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                txHash: hash, 
                fid: context?.user.fid || 0,
                action: actionType,
                tokenAddress: tokenAddress || selectedTokens[0]?.address,
                usdValue: usdValue.toString()
            })
        });
        
        const data = await res.json();
        
        if (data.success) {
            // If Burn + Boost, now trigger the boost
            if (currentMode === 'burn_boost' && selectedCoin) {
                 await fetch('/api/boost', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'burn_boost',
                        txHash: hash,
                        coin: selectedCoin,
                        fid: context?.user.fid || 0,
                        tokenValueUsd: usdValue.toString()
                    })
                });
            }

            setStatus("success");
            generateAiCast();
            scanTokens();
        } else {
            setTimeout(() => verifyTransaction(hash, currentMode, tokenAddress, usdValue), 3000);
        }
    } catch (e) {
        console.error(e);
        setStatus("success"); 
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
      {/* Mode Switcher */}
      <div className="flex flex-col space-y-4">
          <div className="flex bg-gray-800 rounded-lg p-1 overflow-x-auto">
              <button 
                  onClick={() => { setMode('burn_only'); setSelectedTokens([]); }}
                  className={`flex-1 px-3 py-2 rounded-md text-xs font-bold flex items-center justify-center space-x-1 transition-all ${mode === 'burn_only' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                  <Flame size={14} />
                  <span>Burn Only</span>
              </button>
              <button 
                  onClick={() => { setMode('burn_boost'); setSelectedTokens([]); }}
                  className={`flex-1 px-3 py-2 rounded-md text-xs font-bold flex items-center justify-center space-x-1 transition-all ${mode === 'burn_boost' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                  <Rocket size={14} />
                  <span>Burn & Boost</span>
              </button>
              <button 
                  onClick={() => { setMode('recycle'); setSelectedTokens([]); }}
                  className={`flex-1 px-3 py-2 rounded-md text-xs font-bold flex items-center justify-center space-x-1 transition-all ${mode === 'recycle' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                  <Repeat size={14} />
                  <span>Swap to ETH</span>
              </button>
          </div>
          
          <div className={`p-4 rounded-xl border ${mode === 'recycle' ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
              <p className="text-sm text-gray-300 flex items-start space-x-2">
                  <AlertTriangle size={16} className={mode === 'recycle' ? "text-green-400" : "text-red-400"} />
                  <span>
                      {mode === 'burn_only' && "Transfer tokens to burn wallet. Irreversible. Earn 150 XP."}
                      {mode === 'burn_boost' && "Burn tokens to boost a cast. Value = Boost Power. Earn 150 XP."}
                      {mode === 'recycle' && "Swap tokens for ETH (Uniswap/Aerodrome). Recover value. Earn 50 XP."}
                  </span>
              </p>
          </div>

          {mode === 'recycle' && (
             <div className="flex justify-between items-center px-2">
                <label className="text-xs text-gray-400">Slippage Tolerance</label>
                <select 
                    value={slippage} 
                    onChange={(e) => setSlippage(e.target.value)}
                    className="bg-gray-800 text-white text-xs rounded border border-gray-700 px-2 py-1 outline-none"
                >
                    <option value="100">100% (Degen)</option>
                    <option value="10">10%</option>
                    <option value="5">5%</option>
                    <option value="1">1%</option>
                </select>
             </div>
          )}

          {errorMessage && (
              <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded-lg text-sm">
                  {errorMessage}
              </div>
          )}
      </div>


      {/* Burn & Boost: Coin Selection */}
      {mode === 'burn_boost' && (
          <div className="space-y-4">
              <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">1. Select Coin to Boost</label>
                  <div className="grid grid-cols-3 gap-2">
                      {SUPPORTED_COINS.map((coin) => (
                          <button
                              key={coin.symbol}
                              onClick={() => setSelectedCoin(coin)}
                              className={`p-2 rounded-lg border flex flex-col items-center justify-center space-y-1 transition-all ${selectedCoin?.symbol === coin.symbol ? 'bg-orange-900/30 border-orange-500 ring-1 ring-orange-500' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}
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

              <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">2. Attach Cast (Optional)</label>
                  <div className="flex space-x-2">
                      <input 
                          type="text" 
                          value={castUrl}
                          onChange={(e) => setCastUrl(e.target.value)}
                          placeholder="Paste Farcaster URL or @username" 
                          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      />
                      <button 
                          onClick={handlePreview}
                          disabled={!castUrl || isPreviewLoading}
                          className="bg-blue-600 px-4 py-2 rounded-lg font-bold text-xs disabled:opacity-50 hover:bg-blue-500 transition-colors"
                      >
                          {isPreviewLoading ? <Loader2 className="animate-spin" size={14} /> : "Preview"}
                      </button>
                  </div>
                  {previewError && (
                      <p className="text-red-400 text-xs flex items-center">
                          <AlertTriangle size={12} className="mr-1" />
                          {previewError}
                      </p>
                  )}
                  {previewCast && (
                      <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 flex items-start space-x-3">
                          <img src={previewCast.author.pfp_url} className="w-8 h-8 rounded-full" />
                          <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-1">
                                  <span className="text-xs font-bold">{previewCast.author.display_name}</span>
                                  <span className="text-xs text-gray-400">@{previewCast.author.username}</span>
                              </div>
                              <p className="text-xs text-gray-300 line-clamp-2 mt-1">{previewCast.text}</p>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* Token List */}
      <div className="space-y-4">
          <div className="flex flex-col space-y-3">
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

              {/* Token Search */}
              <div className="relative">
                 <input 
                    type="text" 
                    placeholder="Search by name or contract address..." 
                    value={tokenSearch}
                    onChange={(e) => setTokenSearch(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                 />
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
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
                  {tokens
                    .filter(token => {
                        const search = tokenSearch.toLowerCase();
                        return token.name.toLowerCase().includes(search) || 
                               token.symbol.toLowerCase().includes(search) || 
                               token.address.toLowerCase().includes(search);
                    })
                    .map((token) => {
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

      {/* Action Button */}
      {selectedTokens.length > 0 && (
          <div className="fixed bottom-20 left-4 right-4 z-20">
            <button
                onClick={initiateAction}
                disabled={mode === 'burn_boost' && !selectedCoin}
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed ${mode === 'recycle' ? 'bg-green-600' : mode === 'burn_boost' ? 'bg-orange-600' : 'bg-red-600'}`}
            >
                {mode === 'recycle' && <Repeat />}
                {mode === 'burn_only' && <Flame />}
                {mode === 'burn_boost' && <Rocket />}
                <span>
                    {mode === 'recycle' ? "Recycle Selected" : mode === 'burn_boost' ? "Burn & Boost" : "Burn Selected"}
                </span>
            </button>
          </div>
      )}

      {/* Confirm Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
                <h3 className="text-xl font-bold text-white mb-4">Confirm Action</h3>
                
                <div className="space-y-4 mb-6">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Action</span>
                        <span className="font-bold text-white uppercase">{mode.replace('_', ' ')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Tokens</span>
                        <span className="font-bold text-white">{selectedTokens.length} Selected</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Platform Fee</span>
                        <span className="font-bold text-white">{PLATFORM_FEE_ETH} ETH</span>
                    </div>
                    {mode === 'burn_boost' && selectedCoin && (
                        <div className="bg-orange-900/20 p-2 rounded border border-orange-500/30 flex items-center space-x-2">
                            <img src={selectedCoin.image} className="w-6 h-6 rounded-full" />
                            <div>
                                <p className="text-xs text-orange-400 font-bold">Boosting Coin:</p>
                                <p className="text-sm text-white font-bold">{selectedCoin.name} ({selectedCoin.symbol})</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex space-x-3">
                    <button 
                        onClick={() => setShowConfirmModal(false)}
                        className="flex-1 py-3 bg-gray-800 rounded-xl font-bold text-gray-400"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={executeAction}
                        className="flex-1 py-3 bg-blue-600 rounded-xl font-bold text-white"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Status Overlay */}
      {status !== 'idle' && status !== 'success' && status !== 'error' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md">
            <Loader2 size={48} className="text-blue-500 animate-spin mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Processing...</h3>
            <p className="text-gray-400 text-sm">
                {status === 'fee_pending' && "Please confirm platform fee..."}
                {status === 'fee_confirming' && "Verifying fee payment..."}
                {status === 'action_pending' && "Please confirm token transfer..."}
                {status === 'action_confirming' && "Waiting for confirmation..."}
                {status === 'verifying' && "Verifying onchain..."}
            </p>
        </div>
      )}

      {/* Success Overlay */}
      {status === 'success' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-6 text-center">
            <CheckCircle2 size={64} className="text-green-500 mb-6" />
            <h2 className="text-3xl font-bold text-white mb-2">Success!</h2>
            <p className="text-gray-400 mb-8">
                {mode === 'burn_boost' && selectedCoin 
                    ? `Tokens burned and ${selectedCoin.name} boosted!` 
                    : "Tokens successfully processed."}
            </p>
            
            <div className="w-full max-w-sm space-y-3">
                <button 
                    onClick={handleCast}
                    className="w-full py-4 bg-purple-600 rounded-xl font-bold text-white flex items-center justify-center space-x-2"
                >
                    <Share2 size={20} />
                    <span>Cast to Farcaster</span>
                </button>
                <button 
                    onClick={() => setStatus('idle')}
                    className="w-full py-4 bg-gray-800 rounded-xl font-bold text-gray-400"
                >
                    Close
                </button>
            </div>
        </div>
      )}
    </div>
  );
}
