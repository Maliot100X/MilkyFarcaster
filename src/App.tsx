import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Providers } from "./context/Providers";
import { AuthGuard } from "./components/AuthGuard";
import { BottomNav } from "./components/BottomNav";
import { Home } from "./pages/Home";
import { Burn } from "./pages/Burn";
import { Play } from "./pages/Play";
import { Stats } from "./pages/Stats";
import { More } from "./pages/More";

function AppContent() {
  return (
    <div className="bg-gray-900 min-h-screen text-white pb-24">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/burn" element={<Burn />} />
        <Route path="/play" element={<Play />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/more" element={<More />} />
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
