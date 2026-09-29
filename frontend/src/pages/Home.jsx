// src/pages/Home.jsx
import { Zap, ChevronRight, Network, TrendingUp, Users, ShieldAlert } from 'lucide-react';

export default function Home({ onNavigate }) {
  return (
    <div className="relative w-full overflow-hidden min-h-screen bg-black text-white font-sans selection:bg-green-500/30">
      
      {/* AMBIENT GLOW SYSTEM - Neon drifting animations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-24 -right-24 w-[700px] h-[700px] rounded-full bg-gradient-to-br from-emerald-400/40 via-green-500/30 to-transparent blur-[130px] animate-float-1 animate-pulse-glow" />
        <div className="absolute top-10 -left-32 w-[650px] h-[650px] rounded-full bg-gradient-to-tr from-green-600/35 via-emerald-500/25 to-transparent blur-[140px] animate-float-2" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] rounded-full bg-emerald-500/20 blur-[120px] animate-pulse-glow" />
      </div>
      
      {/* MAIN CONTENT - Sits on top of the glows */}
      <div className="relative z-10">
        
        {/* Top Navigation */}
        <nav className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto border-b border-white/5">
          <div className="flex items-center space-x-2">
            <Zap className="w-6 h-6 text-green-500" />
            <span className="text-xl font-semibold tracking-wide">InventIQ</span>
          </div>
          <div className="hidden md:flex space-x-8 text-sm text-gray-400">
            <button className="hover:text-white transition-colors">Product</button>
            <button className="hover:text-white transition-colors">Solutions</button>
            <button className="hover:text-white transition-colors">About</button>
          </div>
          <div className="flex items-center space-x-4">
            <button onClick={onNavigate} className="px-5 py-2 text-sm border border-gray-600 rounded-md hover:border-green-500 transition-colors">
              Log In
            </button>
            <button onClick={onNavigate} className="px-5 py-2 text-sm bg-white text-black rounded-md hover:bg-green-400 font-medium transition-colors">
              Contact Us
            </button>
          </div>
        </nav>

        {/* Hero Section */}
        <main className="flex flex-col items-center justify-center pt-32 pb-20 px-4 text-center">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight max-w-4xl leading-tight">
            Enterprise AI Architecture <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">
              to advance your operations.
            </span>
          </h1>
          <p className="mt-6 text-gray-400 max-w-2xl text-lg">
            InventIQ delivers industry-leading asynchronous machine learning pipelines, maximizing cash flow, minimizing churn risk, and driving continuous innovation for your business's success.
          </p>
          
          <div className="mt-10 flex space-x-4">
            <button onClick={onNavigate} className="px-6 py-3 border border-gray-600 hover:border-green-500 rounded-full transition-all flex items-center space-x-2 group">
              <span>Request a Demo</span>
              <ChevronRight className="w-4 h-4 text-green-500 group-hover:translate-x-1 transition-transform" />
            </button>
            <button onClick={onNavigate} className="px-6 py-3 border border-transparent text-gray-300 hover:text-white rounded-full transition-colors">
              Read more
            </button>
          </div>
        </main>

        {/* Features Grid - Restored! */}
        <section className="py-24 max-w-7xl mx-auto px-4" id="product">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-8 border border-gray-800 rounded-xl bg-gradient-to-b from-gray-900/50 to-transparent hover:border-green-500/30 transition-colors group">
              <h3 className="text-2xl font-semibold mb-3">Automated Inventory Routing</h3>
              <p className="text-gray-400 text-sm mb-8">Integrate K-Means clustering into your supply chain to instantly categorize cash cows, slow-movers, and statistical anomalies without manual spreadsheet filtering.</p>
              <div className="w-full h-40 border border-gray-800 rounded-lg flex items-center justify-center bg-black/50 group-hover:border-green-500/20 transition-colors">
                 <Network className="w-12 h-12 text-green-500/50 group-hover:text-green-400 transition-colors" />
              </div>
            </div>

            <div className="p-8 border border-gray-800 rounded-xl bg-gradient-to-b from-gray-900/50 to-transparent hover:border-green-500/30 transition-colors group">
              <h3 className="text-2xl font-semibold mb-3">Predictive Financial Forecasting</h3>
              <p className="text-gray-400 text-sm mb-8">Eliminate guesswork with multi-variate ARIMA time-series projections. Instantly generate precise Annual Run Rates (ARR) and targeted unit forecasts for procurement.</p>
              <div className="w-full h-40 border border-gray-800 rounded-lg flex items-center justify-center bg-black/50 group-hover:border-green-500/20 transition-colors relative overflow-hidden">
                 <TrendingUp className="w-12 h-12 text-green-500/50 group-hover:text-green-400 transition-colors z-10" />
                 <div className="absolute inset-0 bg-gradient-to-t from-green-500/5 to-transparent z-0"></div>
              </div>
            </div>

            <div className="p-8 border border-gray-800 rounded-xl bg-gradient-to-b from-gray-900/50 to-transparent hover:border-green-500/30 transition-colors group">
              <h3 className="text-2xl font-semibold mb-3">Behavioral Churn Mitigation</h3>
              <p className="text-gray-400 text-sm mb-8">Protect your revenue streams. Our Smart Router automatically detects behavioral data and deploys Logistic Regression to identify at-risk customer cohorts before they leave.</p>
              <div className="w-full h-40 border border-gray-800 rounded-lg flex items-center justify-center bg-black/50 group-hover:border-green-500/20 transition-colors">
                 <Users className="w-12 h-12 text-green-500/50 group-hover:text-green-400 transition-colors" />
              </div>
            </div>

            <div className="p-8 border border-gray-800 rounded-xl bg-gradient-to-b from-gray-900/50 to-transparent hover:border-green-500/30 transition-colors group">
              <h3 className="text-2xl font-semibold mb-3">Zero-Prep Data Ingestion</h3>
              <p className="text-gray-400 text-sm mb-8">Upload messy, unformatted legacy data. Our embedded Gemini AI automatically maps irregular columns to standard schemas with built-in fallback protocols.</p>
              <div className="w-full h-40 border border-gray-800 rounded-lg flex items-center justify-center bg-black/50 group-hover:border-green-500/20 transition-colors">
                 <ShieldAlert className="w-12 h-12 text-green-500/50 group-hover:text-green-400 transition-colors" />
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA - Restored! */}
        <section className="py-24 border-t border-white/5 flex flex-col items-center justify-center text-center px-4">
          <h2 className="text-3xl font-bold mb-6">Start your AI journey</h2>
          <p className="text-gray-400 max-w-xl mb-8">
            Upload your data, generate executive strategies, and visualize your operational future in seconds.
          </p>
          <button onClick={onNavigate} className="px-8 py-4 bg-green-500 text-black font-semibold rounded-md hover:bg-green-400 transition-colors">
            Access Platform
          </button>
        </section>
        
      </div>
    </div>
  );
}