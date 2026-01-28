import { useState, useEffect } from "react";
import { Gamepad2, Gift, XCircle, Trophy, Loader2, Brain, CheckCircle, Share2 } from "lucide-react";
import { useFarcaster } from "../context/FarcasterContext";
import sdk from "@farcaster/miniapp-sdk";

type Reward = { type: string, amount: number } | null;

const QUIZ_QUESTIONS = [
  {
    id: 1,
    question: "What Layer 2 network is this app built on?",
    options: ["Optimism", "Arbitrum", "Base", "Polygon"],
    answer: "Base" 
  },
  {
    id: 2,
    question: "What is the primary color of the Base logo?",
    options: ["Red", "Blue", "Green", "Orange"],
    answer: "Blue"
  },
  {
    id: 3,
    question: "When was Base Mainnet launched?",
    options: ["2021", "2022", "2023", "2024"],
    answer: "2023"
  }
];

export function Play() {
  const { context } = useFarcaster();
  
  // Spin State
  const [canSpin, setCanSpin] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [reward, setReward] = useState<Reward>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [nextSpinTime, setNextSpinTime] = useState<number>(0);
  
  // Quiz State
  const [activeTab, setActiveTab] = useState<'spin' | 'quiz'>('spin');
  const [quizStatus, setQuizStatus] = useState<'intro' | 'playing' | 'submitting' | 'results' | 'cooldown'>('intro');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [quizScore, setQuizScore] = useState<{score: number, xp: number, total: number} | null>(null);
  const [aiCastText, setAiCastText] = useState("");
  const [nextQuizTime, setNextQuizTime] = useState<number>(0);
  const [quizTimeLeft, setQuizTimeLeft] = useState("");

  useEffect(() => {
    // Check spin status on mount
    setCanSpin(true);
    
    const interval = setInterval(() => {
        const now = Date.now();
        if (nextSpinTime > 0) {
             const diff = nextSpinTime - now;
             if (diff <= 0) {
                 setCanSpin(true);
                 setTimeLeft("");
             } else {
                 setCanSpin(false);
                 setTimeLeft(formatTime(diff));
             }
        }
        
        if (nextQuizTime > 0) {
            const diff = nextQuizTime - now;
            if (diff <= 0) {
                if (quizStatus === 'cooldown') setQuizStatus('intro');
                setQuizTimeLeft("");
            } else {
                setQuizStatus('cooldown');
                setQuizTimeLeft(formatTime(diff));
            }
        }
    }, 1000);

    return () => clearInterval(interval);
  }, [nextSpinTime, nextQuizTime, quizStatus]);

  const formatTime = (ms: number) => {
      const hours = Math.floor(ms / (1000 * 60 * 60));
      const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((ms % (1000 * 60)) / 1000);
      return `${hours}h ${minutes}m ${seconds}s`;
  };

  const generateAiCast = async (context: string) => {
    setAiCastText("Generating catchy cast... 🤖");
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_cast_text',
          context
        })
      });
      const data = await res.json();
      if (data.content) setAiCastText(data.content);
    } catch (e) {
      console.error(e);
      setAiCastText(`I just played on MilkyFarcaster! ${context} @milkyfarcaster`);
    }
  };

  const spin = async () => {
    if (!canSpin || isSpinning) return;
    setIsSpinning(true);
    setReward(null);
    
    try {
      const res = await fetch('/api/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid: context?.user.fid, game: 'spin' })
      });
      
      const data = await res.json();

      if (res.status === 429) {
        setNextSpinTime(data.nextSpin);
        setCanSpin(false);
        setIsSpinning(false);
        return;
      }

      if (!res.ok) throw new Error(data.error);

      // Simulate spin delay for effect
      setTimeout(() => {
        setReward(data.result);
        setNextSpinTime(data.nextSpin);
        setCanSpin(false);
        setIsSpinning(false);
        
        if (data.result.type !== "nothing") {
             generateAiCast(`I won ${data.result.amount} ${data.result.type === 'xp' ? 'XP' : '$MILKY'} on the Daily Spin! 🎰`);
        }
      }, 2000);

    } catch (e) {
      console.error(e);
      setIsSpinning(false);
    }
  };

  const startQuiz = () => {
    setQuizStatus('playing');
    setCurrentQuestion(0);
    setSelectedAnswers([]);
  };

  const handleAnswer = (answer: string) => {
    const newAnswers = [...selectedAnswers, answer];
    setSelectedAnswers(newAnswers);
    
    if (currentQuestion < QUIZ_QUESTIONS.length - 1) {
        setCurrentQuestion(currentQuestion + 1);
    } else {
        submitQuiz(newAnswers);
    }
  };

  const submitQuiz = async (answers: string[]) => {
    setQuizStatus('submitting');
    try {
        const res = await fetch('/api/play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                fid: context?.user.fid, 
                game: 'quiz',
                answers 
            })
        });
        
        const data = await res.json();
        
        if (res.status === 429) {
            setNextQuizTime(data.nextPlay);
            setQuizStatus('cooldown');
            return;
        }

        setQuizScore({
            score: data.score,
            xp: data.xpEarned,
            total: data.totalQuestions
        });
        setNextQuizTime(data.nextPlay);
        setQuizStatus('results');
        
        generateAiCast(`I scored ${data.score}/${data.totalQuestions} on the Milky Trivia Quiz! 🧠`);

    } catch (e) {
        console.error(e);
        setQuizStatus('intro'); // Reset on error
    }
  };

  const handleShare = (text: string) => {
      const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=https://milky-farcaster.vercel.app/`;
      sdk.actions.openUrl(url);
  };

  return (
    <div className="p-4 flex flex-col h-full space-y-6 pb-24">
      <div className="flex justify-center space-x-4 bg-gray-800 p-1 rounded-xl mx-auto">
        <button 
          onClick={() => setActiveTab('spin')}
          className={`px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'spin' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
        >
          Daily Spin
        </button>
        <button 
          onClick={() => setActiveTab('quiz')}
          className={`px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'quiz' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
        >
          Quiz
        </button>
      </div>

      {activeTab === 'spin' && (
        <div className="flex flex-col items-center justify-center text-center space-y-8 py-8">
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
                    reward.type === "xp" ? <Gift size={64} className="text-yellow-400" /> :
                    reward.type === "token" ? <Trophy size={64} className="text-blue-400" /> :
                    <XCircle size={64} className="text-red-400" />
                ) : (
                    <Gamepad2 size={64} className="text-purple-500" />
                )}
             </div>
          </div>

          {reward && !isSpinning && (
              <div className="animate-in zoom-in fade-in duration-300 w-full max-w-xs">
                  <h2 className="text-2xl font-bold mb-1">
                      {reward.type === "xp" && `You won ${reward.amount} XP!`}
                      {reward.type === "token" && `You won ${reward.amount} $MILKY!`}
                      {reward.type === "nothing" && "Better luck next time!"}
                  </h2>
                  <p className="text-sm text-gray-400 mb-4">Come back tomorrow</p>
                  
                  {reward.type !== "nothing" && (
                      <button 
                        onClick={() => handleShare(aiCastText)}
                        disabled={!aiCastText || aiCastText.includes("Generating")}
                        className="w-full bg-white text-purple-900 font-bold py-3 rounded-xl flex items-center justify-center space-x-2 hover:bg-gray-100 transition-colors disabled:opacity-50"
                      >
                          <Share2 size={18} />
                          <span>{aiCastText.includes("Generating") ? "Generating Cast..." : "Cast Win"}</span>
                      </button>
                  )}
              </div>
          )}

          {!canSpin && !isSpinning && !reward && (
            <div className="bg-gray-800 px-6 py-3 rounded-xl border border-gray-700">
               <p className="text-gray-400 text-sm mb-1">Next Spin In</p>
               <p className="text-xl font-mono font-bold text-white">{timeLeft || "Calculating..."}</p>
            </div>
          )}

          {!reward && (
            <button 
                onClick={spin}
                disabled={!canSpin || isSpinning}
                className="w-full max-w-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95"
            >
                {isSpinning ? "Spinning..." : "SPIN NOW"}
            </button>
          )}
        </div>
      )}

      {activeTab === 'quiz' && (
        <div className="flex flex-col items-center justify-center text-center space-y-6 py-8 w-full max-w-md mx-auto">
           
           {quizStatus === 'intro' && (
             <>
                <div className="bg-blue-900/30 p-6 rounded-full">
                   <Brain size={64} className="text-blue-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">Milky Trivia</h2>
                  <p className="text-gray-400">Answer 3 questions to earn XP.</p>
                </div>
                {quizTimeLeft ? (
                    <div className="bg-gray-800 px-6 py-3 rounded-xl border border-gray-700">
                        <p className="text-gray-400 text-sm mb-1">Next Quiz In</p>
                        <p className="text-xl font-mono font-bold text-white">{quizTimeLeft}</p>
                    </div>
                ) : (
                    <button 
                    onClick={startQuiz}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95"
                    >
                    START QUIZ
                    </button>
                )}
             </>
           )}

           {quizStatus === 'playing' && (
             <div className="w-full animate-in slide-in-from-right duration-300">
                <div className="flex justify-between text-xs text-gray-400 mb-4 font-mono">
                    <span>Question {currentQuestion + 1}/{QUIZ_QUESTIONS.length}</span>
                </div>
                <h3 className="text-xl font-bold mb-6 text-left">
                    {QUIZ_QUESTIONS[currentQuestion].question}
                </h3>
                <div className="space-y-3">
                    {QUIZ_QUESTIONS[currentQuestion].options.map((opt) => (
                        <button 
                           key={opt} 
                           onClick={() => handleAnswer(opt)}
                           className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 p-4 rounded-xl text-left font-semibold transition-colors flex justify-between items-center group"
                        >
                           <span>{opt}</span>
                           <CheckCircle size={16} className="opacity-0 group-hover:opacity-50" />
                        </button>
                    ))}
                </div>
             </div>
           )}

           {quizStatus === 'submitting' && (
               <div className="flex flex-col items-center">
                   <Loader2 size={48} className="animate-spin text-blue-500 mb-4" />
                   <p>Checking Answers...</p>
               </div>
           )}

           {quizStatus === 'results' && quizScore && (
               <div className="w-full animate-in zoom-in fade-in duration-500 bg-gray-800 p-8 rounded-2xl border border-blue-500/30">
                   <Trophy size={64} className="text-yellow-400 mx-auto mb-4" />
                   <h2 className="text-3xl font-bold mb-2">
                       {quizScore.score}/{quizScore.total} Correct
                   </h2>
                   <p className="text-gray-400 mb-6">
                       You earned <span className="text-green-400 font-bold">+{quizScore.xp} XP</span>
                   </p>
                   
                   <button 
                        onClick={() => handleShare(aiCastText)}
                        disabled={!aiCastText || aiCastText.includes("Generating")}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center space-x-2 disabled:opacity-50"
                   >
                        <Share2 size={18} />
                        <span>{aiCastText.includes("Generating") ? "Generating Cast..." : "Cast Score"}</span>
                   </button>
                   
                   <button 
                        onClick={() => setQuizStatus('intro')}
                        className="mt-4 text-sm text-gray-500 hover:text-gray-300"
                   >
                        Back to Menu
                   </button>
               </div>
           )}
           
           {quizStatus === 'cooldown' && (
                <div className="text-center">
                    <h2 className="text-xl font-bold mb-2">Cooldown Active</h2>
                    <p className="text-gray-400 mb-4">You've already played today.</p>
                    <div className="bg-gray-800 px-6 py-3 rounded-xl border border-gray-700 inline-block">
                        <p className="text-gray-400 text-sm mb-1">Next Quiz In</p>
                        <p className="text-xl font-mono font-bold text-white">{quizTimeLeft}</p>
                    </div>
                    <button 
                        onClick={() => setQuizStatus('intro')}
                        className="block w-full mt-6 text-blue-400 font-bold"
                    >
                        Back
                    </button>
                </div>
           )}
        </div>
      )}
    </div>
  );
}
