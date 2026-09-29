// src/App.jsx
import { useState } from 'react';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';

function App() {
  // This state tells React which page to show. It starts on 'home'.
  const [currentView, setCurrentView] = useState('home');

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-green-500/30">
      {currentView === 'home' ? (
        <Home onNavigate={() => setCurrentView('dashboard')} />
      ) : (
        <Dashboard onNavigate={() => setCurrentView('home')} />
      )}
    </div>
  );
}

export default App;