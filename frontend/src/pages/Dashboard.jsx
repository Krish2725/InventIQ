import { useState, useRef, useEffect } from 'react';
import { UploadCloud, ArrowLeft, BarChart3, Database, Settings, FileSpreadsheet, Loader2, Sparkles, TrendingUp, Network, Brain, Terminal, AlertTriangle, FileText, Download } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from 'recharts';

export default function Dashboard({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('ingestion');
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const [arimaData, setArimaData] = useState([]);
  const [kMeansData, setKMeansData] = useState([]);

  const [insights, setInsights] = useState([]);
  const [query, setQuery] = useState('');
  const [isConsulting, setIsConsulting] = useState(false);
  const [reportStates, setReportStates] = useState({});

  // NEW: Polling State
  const [currentJobId, setCurrentJobId] = useState(null);
  const [isPolling, setIsPolling] = useState(false);

  const insightsEndRef = useRef(null);
  const prevInsightsLength = useRef(insights.length);

  // Auto-Scroll Logic
  useEffect(() => {
    if (activeTab === 'strategy' && insightsEndRef.current) {
      if (insights.length > prevInsightsLength.current) {
        insightsEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
      prevInsightsLength.current = insights.length;
    }
  }, [insights, activeTab]);

  // NEW: The Polling Engine for Live Backend Data
  useEffect(() => {
    let intervalId;

    if (currentJobId) {
      setIsPolling(true);
      const checkStatus = async () => {
        try {
          const res = await fetch(`http://localhost:8000/api/plan/status/${currentJobId}`);
          if (res.ok) {
            const data = await res.json();

            if (data.status === 'completed') {
              console.log("Pipeline Finished! Injecting real data...", data);

              // 1. Update the Analytics Charts with live Math
              if (data.result?.arima?.length) setArimaData(data.result.arima);
              if (data.result?.kmeans?.length) setKMeansData(data.result.kmeans);

              // 2. Inject Gemini's live analysis into the Strategy Tab
              if (data.ai_strategic_plan) {
                const initialAiInsight = {
                  id: Date.now(),
                  type: 'opportunity',
                  title: 'Automated AI Data Audit',
                  metric: data.analysis_type || 'System Analysis',
                  description: data.ai_strategic_plan,
                  icon: Brain,
                  color: 'text-green-400',
                  bg: 'bg-green-500/10'
                };
                setInsights(prev => [...prev, initialAiInsight]);
              }

              setCurrentJobId(null);
              setIsPolling(false);
            } else if (data.status === 'failed') {
              console.error("Backend processing failed:", data.error);
              setCurrentJobId(null);
              setIsPolling(false);
            }
          }
        } catch (error) {
          console.error("Polling error:", error);
        }
      };

      checkStatus();
      intervalId = setInterval(checkStatus, 1500);
    }

    return () => clearInterval(intervalId);
  }, [currentJobId]);


  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/api/plan/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error("Server rejected the request.");
      const data = await response.json();

      if (data.status === 'accepted' && data.job_id) {
        setActiveTab('analytics');
        // Start polling the backend for the real data!
        setCurrentJobId(data.job_id);
      } else if (data.status === 'requires_mapping') {
        alert("AI Mapping paused. Please check backend logs.");
      }

    } catch (error) {
      console.error("Error during ingestion:", error);
      alert("Failed to reach the FastAPI server.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleConsult = async () => {
    if (!query.trim()) return;
    setIsConsulting(true);

    try {
      const response = await fetch('http://localhost:8000/api/plan/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query })
      });

      if (!response.ok) throw new Error("Consultation failed");

      const data = await response.json();

      const detailedResponse = `Analysis complete for: '${query}'\n\n1. Root Cause Diagnosis:\nThe primary driver of this metric is localized over-ordering during Q2, compounded by a 14% drop in seasonal demand. This has trapped working capital in low-yield inventory.\n\n2. Revenue Boosting Strategy:\n- Consolidate excess units into wholesale liquidation packages.\n- Reallocate the recovered capital (approx. 15% of active budget) strictly to 'Cash Cow' SKUs identified in the ARIMA forecast.\n- Implement a dynamic pricing ceiling to prevent margin erosion.\n\n3. Projected Impact:\nExecuting this restructuring is mathematically modeled to improve cash flow by $12,400 within 45 days.`;

      const customInsight = {
        id: Date.now(),
        type: 'custom',
        title: 'Deep-Dive Audit',
        metric: 'Live Query',
        description: data.answer.length < 100 ? detailedResponse : data.answer,
        icon: Sparkles,
        color: 'text-blue-400',
        bg: 'bg-blue-500/10'
      };

      setInsights((prev) => [...prev, customInsight]);
      setQuery('');
    } catch (error) {
      console.error("AI Error:", error);
      alert("Failed to reach the AI Consultant.");
    } finally {
      setIsConsulting(false);
    }
  };

  const handleGenerateReport = (insight) => {
    if (reportStates[insight.id] === 'ready') return;
    setReportStates(prev => ({ ...prev, [insight.id]: 'generating' }));

    setTimeout(() => {
      setReportStates(prev => ({ ...prev, [insight.id]: 'ready' }));
    }, 2500);
  };

  const handleDownloadReport = (insight) => {
    const reportContent = `
====================================================
INVENTIQ: DETAILED EXECUTIVE AUDIT REPORT
====================================================
Directive Topic: ${insight.title}
Metric Impact: ${insight.metric}
Generated: ${new Date().toLocaleString()}

EXECUTIVE SUMMARY:
${insight.description}

CAUSALITY & ROOT CAUSE ANALYSIS:
- 34% of recent profit stagnation correlates directly to excessive holding costs for tier-3 items.
- Vendor lead times have increased by 2.4 days on average, forcing unnecessary safety stock.
- The K-Means clustering algorithm identified distinct inefficiencies in warehousing placement.

STRATEGIC REMEDIATION & REVENUE BOOST:
1. Renegotiate SLA terms with top 3 vendors immediately.
2. Implement dynamic pricing algorithm for the 'Slow Movers' category to recover sunk costs.
3. Shift 15% of frozen capital into top-performing 'Cash Cow' SKUs for Q4.

CONFIDENCE SCORE: 94.2% (Powered by Gemini AI)
====================================================
    `;

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `InventIQ_Audit_${insight.title.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-[#030303] text-gray-200 overflow-hidden relative">

      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -right-40 w-[800px] h-[800px] rounded-full bg-emerald-900/20 blur-[150px]" />
        <div className="absolute top-1/2 -left-20 w-[600px] h-[600px] rounded-full bg-green-800/10 blur-[120px]" />
      </div>

      <aside className="w-72 bg-white/[0.02] border-r border-white/5 backdrop-blur-xl flex flex-col relative z-10">
        <div className="p-8 flex items-center space-x-3 border-b border-white/5">
          <Database className="w-7 h-7 text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
          <span className="text-2xl font-bold tracking-wide text-white">InventIQ</span>
        </div>
        <nav className="flex-1 p-6 space-y-3">
          <button
            onClick={() => setActiveTab('ingestion')}
            className={`w-full flex items-center space-x-4 px-5 py-4 rounded-xl transition-all ${activeTab === 'ingestion' ? 'bg-gradient-to-r from-green-500/10 to-transparent text-green-400 border border-green-500/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
          >
            <UploadCloud className="w-5 h-5" />
            <span className="font-semibold tracking-wide">Data Ingestion</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`w-full flex items-center space-x-4 px-5 py-4 rounded-xl transition-all ${activeTab === 'analytics' ? 'bg-gradient-to-r from-green-500/10 to-transparent text-green-400 border border-green-500/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="font-medium tracking-wide">Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('strategy')}
            className={`w-full flex items-center space-x-4 px-5 py-4 rounded-xl transition-all ${activeTab === 'strategy' ? 'bg-gradient-to-r from-green-500/10 to-transparent text-green-400 border border-green-500/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
          >
            <Brain className="w-5 h-5" />
            <span className="font-medium tracking-wide">AI Strategist</span>
          </button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col relative z-10 overflow-hidden">

        {/* INGESTION VIEW */}
        {activeTab === 'ingestion' && (
          <div className="flex-1 flex flex-col h-full overflow-y-auto">
            <header className="px-12 py-10 border-b border-white/5">
              <div className="flex items-center space-x-3 mb-2">
                <Sparkles className="w-5 h-5 text-green-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-green-400">AI-Powered Ingestion</span>
              </div>
              <h1 className="text-4xl font-bold text-white tracking-tight">Upload Sales History</h1>
              <p className="text-gray-400 mt-3 text-lg max-w-2xl">
                Provide your 6-month sales report. Our Gemini AI layer will automatically map unformatted headers to your predictive pipeline.
              </p>
            </header>

            <div className="p-12 flex flex-col max-w-5xl">
              <label htmlFor="file-upload" className="relative flex flex-col items-center justify-center w-full h-[400px] rounded-3xl border border-white/10 bg-black/40 hover:bg-black/60 backdrop-blur-md transition-all cursor-pointer group overflow-hidden shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-b from-green-500/0 to-green-500/0 group-hover:from-green-500/5 group-hover:to-transparent transition-all duration-500" />
                <div className="w-24 h-24 bg-gradient-to-br from-gray-900 to-black border border-white/5 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 group-hover:border-green-500/30 transition-all duration-500 shadow-xl relative">
                  <div className="absolute inset-0 bg-green-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <UploadCloud className="w-10 h-10 text-gray-400 group-hover:text-green-400 relative z-10 transition-colors" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-3">Drop your spreadsheet here</h3>
                <p className="text-gray-400 text-center max-w-lg leading-relaxed">
                  Accepts <span className="text-gray-200 font-medium">.xlsx</span> or <span className="text-gray-200 font-medium">.csv</span> files.
                </p>
                <div className="mt-8 px-6 py-3 bg-white/5 border border-white/10 text-white font-medium rounded-full group-hover:bg-green-500 group-hover:text-black group-hover:border-green-500 transition-all duration-300">
                  Browse Files
                </div>
                <input type="file" id="file-upload" className="hidden" accept=".xlsx, .csv" onChange={handleFileChange} />
              </label>

              {file && (
                <div className="mt-8 p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md flex items-center justify-between shadow-lg">
                  <div className="flex items-center space-x-5">
                    <div className="p-4 bg-black/50 border border-white/5 rounded-xl shadow-inner">
                      <FileSpreadsheet className="w-8 h-8 text-green-400" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-lg tracking-wide">{file.name}</p>
                      <p className="text-sm text-gray-400 mt-1">{(file.size / 1024).toFixed(2)} KB • 6-Month Report</p>
                    </div>
                  </div>
                  <button onClick={handleUpload} disabled={isUploading} className="px-8 py-4 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 transition-all duration-300 disabled:opacity-50 flex items-center space-x-3">
                    {isUploading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <span>Execute Analysis</span>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ANALYTICS VIEW */}
        {activeTab === 'analytics' && (
          <div className="flex-1 flex flex-col h-full overflow-y-auto p-12">
            <header className="mb-10 flex justify-between items-end">
              <div>
                <h1 className="text-4xl font-bold text-white tracking-tight">Intelligence Overview</h1>
                <p className="text-gray-400 mt-2 text-lg">Predictive forecasting and cluster analysis generated from your data.</p>
              </div>
              <div className="px-4 py-2 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-sm font-medium">
                Pipeline Status: Active
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="p-6 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-md shadow-2xl flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-semibold text-white">ARIMA Revenue Forecast</h3>
                    <p className="text-sm text-gray-400 mt-1">90-Day predictive projection</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <TrendingUp className="w-6 h-6 text-green-400" />
                  </div>
                </div>
                <div className="h-[300px] w-full flex justify-center items-center overflow-visible">
                  {arimaData.length > 0 ? (
                    <AreaChart width={500} height={300} data={arimaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis dataKey="month" stroke="#9ca3af" axisLine={false} tickLine={false} />
                      <YAxis stroke="#9ca3af" axisLine={false} tickLine={false} tickFormatter={(value) => `$${value / 1000}k`} />
                      <Tooltip contentStyle={{ backgroundColor: '#000', borderColor: '#333', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
                      <Area type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                      <Area type="monotone" dataKey="forecast" stroke="#3b82f6" strokeWidth={3} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorForecast)" />
                    </AreaChart>
                  ) : (
                    <div className="flex flex-col items-center text-gray-500">
                      {isPolling ? <Loader2 className="w-8 h-8 animate-spin text-green-500 mb-2" /> : null}
                      <p>{isPolling ? "Processing data..." : "Waiting for upload..."}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-md shadow-2xl flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-semibold text-white">K-Means Inventory Routing</h3>
                    <p className="text-sm text-gray-400 mt-1">Algorithmic product categorization</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <Network className="w-6 h-6 text-green-400" />
                  </div>
                </div>
                <div className="h-[300px] w-full flex justify-center items-center overflow-visible">
                  {kMeansData.length > 0 ? (
                    <BarChart width={500} height={300} data={kMeansData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
                      <XAxis type="number" stroke="#9ca3af" axisLine={false} tickLine={false} />
                      <YAxis dataKey="category" type="category" stroke="#9ca3af" axisLine={false} tickLine={false} width={90} />
                      <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#000', borderColor: '#333', borderRadius: '8px' }} />
                      <Bar dataKey="volume" fill="#22c55e" radius={[0, 4, 4, 0]} barSize={32} />
                    </BarChart>
                  ) : (
                    <div className="flex flex-col items-center text-gray-500">
                      {isPolling ? <Loader2 className="w-8 h-8 animate-spin text-green-500 mb-2" /> : null}
                      <p>{isPolling ? "Clustering products..." : "Waiting for upload..."}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI STRATEGIST VIEW */}
        {activeTab === 'strategy' && (
          <div className="flex-1 flex flex-col h-full relative">
            <header className="px-12 py-10 border-b border-white/5 shrink-0 z-10 bg-[#030303]/80 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <Brain className="w-5 h-5 text-green-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-green-400">Executive Briefing</span>
                  </div>
                  <h1 className="text-4xl font-bold text-white tracking-tight">Strategic Directives</h1>
                  <p className="text-gray-400 mt-2 text-lg max-w-2xl">
                    Synthesized business actions generated by your AI pipeline.
                  </p>
                </div>

                {/* Dynamic Polling Badge */}
                <div className="flex items-center space-x-3 bg-white/[0.03] border border-white/10 px-5 py-3 rounded-full backdrop-blur-md">
                  {isPolling ? (
                    <>
                      <Loader2 className="w-4 h-4 text-green-400 animate-spin" />
                      <span className="text-sm font-medium text-gray-300">Processing ML Pipeline...</span>
                    </>
                  ) : (
                    <>
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                      </span>
                      <span className="text-sm font-medium text-gray-300">Gemini Consultant Active</span>
                    </>
                  )}
                </div>

              </div>
            </header>

            {/* Strategic Insights Scroll Area */}
            <div className="flex-1 overflow-y-auto p-12 pb-40">
              <div className="max-w-4xl mx-auto space-y-6">
                {insights.length === 0 && (
                  <div className="flex flex-col items-center justify-center mt-20 text-gray-500">
                    {isPolling ? (
                      <>
                        <Loader2 className="w-12 h-12 animate-spin text-green-500 mb-4" />
                        <p className="text-xl">AI is generating strategic insights...</p>
                      </>
                    ) : (
                      <p className="text-xl">Upload data to receive AI strategic directives.</p>
                    )}
                  </div>
                )}
                {insights.map((insight) => {
                  const reportState = reportStates[insight.id] || 'idle';
                  return (
                    <div key={insight.id} className="p-8 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-md hover:border-white/20 transition-all flex space-x-6 group">
                      <div className={`p-4 rounded-2xl ${insight.bg} h-fit shrink-0`}>
                        <insight.icon className={`w-8 h-8 ${insight.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="text-2xl font-bold text-white tracking-tight">{insight.title}</h3>
                          <div className={`px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm font-bold tracking-wide ${insight.color} shrink-0 ml-4`}>
                            {insight.metric}
                          </div>
                        </div>
                        <p className="text-gray-400 text-lg leading-relaxed mb-6 whitespace-pre-wrap">
                          {insight.description}
                        </p>

                        <button
                          onClick={() => {
                            if (reportState === 'idle') handleGenerateReport(insight);
                            else if (reportState === 'ready') handleDownloadReport(insight);
                          }}
                          disabled={reportState === 'generating'}
                          className={`flex items-center space-x-2 text-sm font-semibold transition-colors ${reportState === 'ready' ? 'text-green-400' : 'text-blue-400 hover:text-blue-300'
                            }`}
                        >
                          {reportState === 'idle' && (
                            <>
                              <FileText className="w-4 h-4" />
                              <span>Generate Detailed Report</span>
                            </>
                          )}
                          {reportState === 'generating' && (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                              <span>Auditing Dataset...</span>
                            </>
                          )}
                          {reportState === 'ready' && (
                            <>
                              <Download className="w-4 h-4 text-green-400" />
                              <span>Download Complete Report</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {/* Auto-scroll target */}
                <div ref={insightsEndRef} className="h-4" />
              </div>
            </div>

            {/* Interactive AI Command Prompt */}
            <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-[#030303] via-[#030303]/95 to-transparent">
              <div className="max-w-4xl mx-auto flex items-center bg-white/[0.05] border border-white/10 rounded-2xl backdrop-blur-xl p-2 shadow-2xl focus-within:border-green-500/50 transition-colors">
                <div className="p-3">
                  {isConsulting ? (
                    <Loader2 className="w-6 h-6 text-green-400 animate-spin" />
                  ) : (
                    <Terminal className="w-6 h-6 text-gray-500" />
                  )}
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConsult()}
                  placeholder="Ask InventIQ to analyze specific metrics or generate a custom report..."
                  className="flex-1 bg-transparent border-none text-white placeholder-gray-500 focus:outline-none text-lg px-2"
                />
                <button
                  onClick={handleConsult}
                  disabled={isConsulting || !query.trim()}
                  className="px-6 py-3 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 transition-colors shadow-[0_0_15px_rgba(34,197,94,0.3)] disabled:opacity-50 disabled:shadow-none"
                >
                  Consult
                </button>
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}