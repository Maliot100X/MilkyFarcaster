import { useFarcaster } from "../context/FarcasterContext";
import { mockUserData } from "../mocks/userData";
import { Link } from "react-router-dom";
import { Flame, Gamepad2 } from "lucide-react";

export function Home() {
  const { context } = useFarcaster();
  const { xp, level, title, nextLevelXp, activities } = mockUserData;
  const progress = (xp / nextLevelXp) * 100;

  return (
    <div className="p-4 space-y-6">
      {/* Header Profile */}
      <div className="flex items-center space-x-4">
        <img 
          src={context?.user.pfpUrl || "https://placehold.co/400"} 
          alt="Avatar" 
          className="w-16 h-16 rounded-full border-2 border-blue-500"
        />
        <div>
          <h1 className="text-xl font-bold">{context?.user.displayName || "User"}</h1>
          <p className="text-gray-400">@{context?.user.username || "username"}</p>
        </div>
      </div>

      {/* Stats Card */}
      <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-400">Level {level}</span>
          <span className="text-sm text-blue-400 font-bold">{title}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2.5 mb-2">
          <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>{xp} XP</span>
          <span>{nextLevelXp} XP</span>
        </div>
      </div>

      {/* CTAs */}
      <div className="grid grid-cols-2 gap-4">
        <Link to="/burn" className="bg-orange-900/50 hover:bg-orange-900/70 border border-orange-700 p-4 rounded-xl flex flex-col items-center justify-center transition-colors">
          <Flame className="text-orange-500 mb-2" size={32} />
          <span className="font-bold">Burn</span>
        </Link>
        <Link to="/play" className="bg-purple-900/50 hover:bg-purple-900/70 border border-purple-700 p-4 rounded-xl flex flex-col items-center justify-center transition-colors">
          <Gamepad2 className="text-purple-500 mb-2" size={32} />
          <span className="font-bold">Play</span>
        </Link>
      </div>

      {/* Activity Feed */}
      <div>
        <h2 className="text-lg font-bold mb-3">Recent Activity</h2>
        <div className="space-y-3">
          {activities.map((activity) => (
            <div key={activity.id} className="bg-gray-800 p-3 rounded-lg flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-full ${activity.type === 'burn' ? 'bg-orange-900/50 text-orange-500' : 'bg-purple-900/50 text-purple-500'}`}>
                   {activity.type === 'burn' ? <Flame size={16} /> : <Gamepad2 size={16} />}
                </div>
                <div>
                  <p className="font-medium text-sm">{activity.description}</p>
                  <p className="text-xs text-gray-500">{activity.timestamp}</p>
                </div>
              </div>
              {activity.amount && <span className="text-orange-400 font-bold text-sm">-{activity.amount}</span>}
              {activity.reward && <span className="text-green-400 font-bold text-sm">+{activity.reward}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
