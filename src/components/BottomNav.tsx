import { Link, useLocation } from "react-router-dom";
import { Home, Flame, Gamepad2, BarChart2, MoreHorizontal, Bot, User } from "lucide-react";
import { cn } from "../lib/utils";

const tabs = [
  { name: "Home", path: "/", icon: Home },
  { name: "Burn", path: "/burn", icon: Flame },
  { name: "Play", path: "/play", icon: Gamepad2 },
  { name: "Stats", path: "/stats", icon: BarChart2 },
  { name: "AI", path: "/ai", icon: Bot },
  { name: "More", path: "/more", icon: MoreHorizontal },
  { name: "Profile", path: "/profile", icon: User },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around items-center h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path;
          return (
            <Link
              key={tab.name}
              to={tab.path}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full transition-colors",
                isActive ? "text-blue-500" : "text-gray-500 hover:text-gray-400"
              )}
            >
              <Icon size={24} />
              <span className="text-xs mt-1">{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
