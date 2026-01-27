import { useState, useRef, useEffect } from "react";
import { Bot, Send, Sparkles, Zap } from "lucide-react";
import { useFarcaster } from "../context/FarcasterContext";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export function AI() {
  const { context } = useFarcaster();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: `Hi ${context?.user?.displayName || 'there'}! I'm MilkyBot. I can help you with Farcaster questions, or you can ask me to run MoltBot tasks.` }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"chat" | "moltbot">("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // Determine endpoint based on mode
      const endpoint = mode === 'moltbot' ? '/api/moltbot' : '/api/ai';
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          userContext: {
            fid: context?.user?.fid,
            username: context?.user?.username
          }
        })
      });

      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to fetch response');

      setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 p-4 shadow-md border-b border-gray-700 flex justify-between items-center z-10">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${mode === 'moltbot' ? 'bg-gradient-to-br from-purple-600 to-pink-600' : 'bg-gradient-to-br from-blue-500 to-cyan-500'}`}>
            {mode === 'moltbot' ? <Zap size={24} className="text-white" /> : <Bot size={24} className="text-white" />}
          </div>
          <div>
            <h1 className="font-bold text-lg">{mode === 'moltbot' ? 'MoltBot Agent' : 'MilkyBot AI'}</h1>
            <p className="text-xs text-gray-400 flex items-center">
              <Sparkles size={10} className="mr-1" /> 
              {mode === 'moltbot' ? 'Automated Task Runner' : 'Assistant'}
            </p>
          </div>
        </div>
        
        {/* Mode Toggles */}
        <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
          <button
            onClick={() => setMode("chat")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === "chat" 
                ? "bg-blue-600 text-white shadow-sm" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setMode("moltbot")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === "moltbot" 
                ? "bg-purple-600 text-white shadow-sm" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            MoltBot
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900/50">
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[80%] p-3 rounded-2xl ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : 'bg-gray-800 text-gray-100 rounded-bl-none border border-gray-700'
              }`}
            >
              <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 p-3 rounded-2xl rounded-bl-none border border-gray-700 flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={mode === 'moltbot' ? "Ask MoltBot to run a task..." : "Ask MilkyBot anything..."}
            className="flex-1 bg-gray-900 text-white border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed p-3 rounded-xl transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
