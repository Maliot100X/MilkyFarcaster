import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Providers } from "./context/Providers";
import { AuthGuard } from "./components/AuthGuard";
import { BottomNav } from "./components/BottomNav";
import { Home } from "./pages/Home";
import { Burn } from "./pages/Burn";
import { Play } from "./pages/Play";
import { Stats } from "./pages/Stats";
import { More } from "./pages/More";
import { Shop } from "./pages/Shop";
import { AI } from "./pages/AI";
import { Profile } from "./pages/Profile";

function AppContent() {
  return (
    <div className="bg-gray-900 min-h-screen text-white pb-24 relative">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/burn" element={<Burn />} />
        <Route path="/play" element={<Play />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/ai" element={<AI />} />
        <Route path="/more" element={<More />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
      <BottomNav />
    </div>
  );
}

function App() {
  return (
    <Providers>
      <BrowserRouter>
        <AuthGuard>
          <AppContent />
        </AuthGuard>
      </BrowserRouter>
    </Providers>
  );
}

export default App;
