import React, { useEffect } from 'react';
import { CineMateProvider, useCineMate } from './context/CineMateContext';
import { Navbar } from './components/navigation/Navbar';
import { SettingsModal } from './components/common/SettingsModal';
import { LandingPage } from './pages/LandingPage';
import { CreateRoomPage } from './pages/CreateRoomPage';
import { JoinRoomPage } from './pages/JoinRoomPage';
import { LobbyPage } from './pages/LobbyPage';
import { MovieRoomPage } from './pages/MovieRoomPage';
import { WatchlistPage } from './pages/WatchlistPage';
import { SummaryPage } from './pages/SummaryPage';

const AppContent: React.FC = () => {
  const { currentView, setCurrentView } = useCineMate();

  // Check URL hash or query params on initial load
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('room=')) {
      setCurrentView('join-room');
    } else {
      const params = new URLSearchParams(window.location.search);
      if (params.get('room')) {
        setCurrentView('join-room');
      }
    }
  }, [setCurrentView]);

  return (
    <div className="min-h-screen bg-[#0B0A10] text-[#F7F5FA] flex flex-col font-sans transition-colors duration-300">
      {/* Navbar (Hidden in fullscreen Movie Room to maximize cinematic immersion) */}
      {currentView !== 'movie-room' && <Navbar />}

      {/* Main View Router */}
      <main className="flex-1 flex flex-col">
        {currentView === 'landing' && <LandingPage />}
        {currentView === 'create-room' && <CreateRoomPage />}
        {currentView === 'join-room' && <JoinRoomPage />}
        {currentView === 'lobby' && <LobbyPage />}
        {currentView === 'movie-room' && <MovieRoomPage />}
        {currentView === 'watchlist' && <WatchlistPage />}
        {currentView === 'summary' && <SummaryPage />}
      </main>

      {/* Global Settings Modal */}
      <SettingsModal />
    </div>
  );
};

export function App() {
  return (
    <CineMateProvider>
      <AppContent />
    </CineMateProvider>
  );
}

export default App;
