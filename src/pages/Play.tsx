import { useState, useEffect } from "react";
import { Gamepad2, Gift, XCircle, Trophy } from "lucide-react";

type Reward = "XP" | "Badge" | "Nothing";

export function Play() {
  const [canSpin, setCanSpin] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);
  const [reward, setReward] = useState<Reward | null>(null);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    // Check local storage for last spin
    const lastSpin = localStorage.getItem("lastSpin");
    if (lastSpin) {
      const diff = Date.now() - parseInt(lastSpin);
      const oneDay = 24 * 60 * 60 * 1000;
      if (diff < oneDay) {
        setCanSpin(false);
        updateTimeLeft(parseInt(lastSpin) + oneDay);
      }
    }
    
    const interval = setInterval(() => {
        const lastSpin = localStorage.getItem("lastSpin");
        if (lastSpin) {
             const nextSpin = parseInt(lastSpin) + 24 * 60 * 60 * 1000;
             updateTimeLeft(nextSpin);
        }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const updateTimeLeft = (target: number) => {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
          setCanSpin(true);
          setTimeLeft("");
      } else {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      }
  };

  const spin = () => {
    if (!canSpin) return;
    setIsSpinning(true);
    setReward(null);
    
    setTimeout(() => {
      const r = Math.random();
      let outcome: Reward = "Nothing";
      if (r < 0.5) outcome = "XP";
      else if (r < 0.8) outcome = "Badge";
      
      setReward(outcome);
      setIsSpinning(false);
      setCanSpin(false);
      localStorage.setItem("lastSpin", Date.now().toString());
    }, 2000);
  };

  return (
    <div className="p-4 flex flex-col h-full items-center justify-center text-center space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Daily Spin</h1>
        <p className="text-gray-400">Test your luck once every 24 hours</p>
      </div>

      <div className="relative w-48 h-48 flex items-center justify-center">
         <div className={`absolute inset-0 rounded-full border-4 border-purple-500 border-t-transparent ${isSpinning ? 'animate-spin' : ''}`}></div>
         <div className="bg-purple-900/20 rounded-full w-40 h-40 flex items-center justify-center">
            {isSpinning ? (
                <Gamepad2 size={64} className="text-purple-500 animate-pulse" />
            ) : reward ? (
                reward === "XP" ? <Gift size={64} className="text-yellow-400" /> :
                reward === "Badge" ? <Trophy size={64} className="text-blue-400" /> :
                <XCircle size={64} className="text-red-400" />
            ) : (
                <Gamepad2 size={64} className="text-purple-500" />
            )}
         </div>
      </div>

      {reward && !isSpinning && (
          <div className="animate-in zoom-in fade-in duration-300">
              <h2 className="text-2xl font-bold mb-1">
                  {reward === "XP" && "You won 50 XP!"}
                  {reward === "Badge" && "You unlocked a Badge!"}
                  {reward === "Nothing" && "Better luck next time!"}
              </h2>
              <p className="text-sm text-gray-400">Come back tomorrow</p>
          </div>
      )}

      <button
        onClick={spin}
        disabled={!canSpin || isSpinning}
        className={`px-8 py-4 rounded-xl font-bold text-lg shadow-lg transition-all ${
            canSpin && !isSpinning
            ? "bg-purple-600 hover:bg-purple-700 text-white active:scale-95"
            : "bg-gray-700 text-gray-500 cursor-not-allowed"
        }`}
      >
        {isSpinning ? "Spinning..." : canSpin ? "SPIN NOW" : `Cooldown: ${timeLeft}`}
      </button>
    </div>
  );
}
