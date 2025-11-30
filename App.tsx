import React, { useState, useEffect, useRef } from 'react';
import { 
  Briefcase, 
  Wallet, 
  FileSignature, 
  RefreshCcw,
  LayoutDashboard,
  Users,
  Trophy,
  Pencil,
  AlertCircle,
  Wifi,
  WifiOff,
  List,
  Columns,
  TrendingUp,
  Medal,
  CalendarCheck,
  Sun,
  Moon,
  Printer,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Hourglass,
  Target
} from 'lucide-react';
import { 
  ComposedChart, 
  Line, 
  Bar, 
  AreaChart, 
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  BarChart
} from 'recharts';

import { MOCK_DASHBOARD_DATA } from './constants';
import { DashboardData, DateFilterState, GoalSettings, TeamRole } from './types';
import { Card } from './components/Card';
import { TeamRow } from './components/TeamRow';
import { TeamRanking } from './components/TeamRanking';
import { DateFilter } from './components/DateFilter';
import { PipelineFunnel } from './components/PipelineFunnel';
import { KanbanBoard } from './components/KanbanBoard';
import { CreativeRanking } from './components/CreativeRanking';
import { GoalConfigModal } from './components/GoalConfigModal';
import { fetchConversAppData } from './services/api';

type ViewMode = 'overview' | 'goals' | 'ranking';
type PipelineViewMode = 'list' | 'kanban';
type Theme = 'dark' | 'light';

// Helper to persist goals
const GOALS_STORAGE_KEY = 'dashboard_goals_v2';

const getSavedGoals = (): GoalSettings => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(GOALS_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse stored goals", e);
      }
    }
  }
  return MOCK_DASHBOARD_DATA.currentGoals;
};

function App() {
  // Initialize state with saved goals merged into Mock data structure
  const [data, setData] = useState<DashboardData>(() => ({
    ...MOCK_DASHBOARD_DATA,
    currentGoals: getSavedGoals()
  }));

  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [pipelineViewMode, setPipelineViewMode] = useState<PipelineViewMode>('list');
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  
  // Use ref to track current data for polling (avoids stale closures)
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Theme State
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('theme');
        if (saved) return saved as Theme;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  });

  // Date Filter State
  const [dateFilter, setDateFilter] = useState<DateFilterState>(() => {
    return {
      preset: 'month', 
      startDate: '',
      endDate: ''
    };
  });

  // Clock Timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Apply Theme
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handlePrint = () => {
    window.print();
  };

  const loadData = async (isPolling = false) => {
    try {
      if (!isPolling) setLoading(true);
      setApiError(null);
      
      // Get the most recent valid data structure (either from state or Mock fallback)
      // IMPORTANT: Always ensure we use the LATEST goals from storage
      const currentGoals = getSavedGoals();
      const baseData = {
          ...dataRef.current, // Use ref to get current state (preserving role changes etc)
          currentGoals: currentGoals // Ensure goals are fresh
      };

      const realData = await fetchConversAppData(baseData, dateFilter);
      
      // Merge potentially updated goals from api (if any) with stored goals (preference to stored/merged)
      // Usually API returns what we sent, but good to be explicit
      setData({
        ...realData,
        currentGoals: currentGoals
      });
    } catch (e: any) {
      console.error("Failed to load data", e);
      const errorMessage = e instanceof Error ? e.message : "Erro desconhecido";
      setApiError(errorMessage);
    } finally {
      if (!isPolling) setLoading(false);
    }
  };

  // Initial Load & Polling
  useEffect(() => {
    loadData(false);

    const intervalId = setInterval(() => {
        loadData(true);
    }, 5 * 60 * 1000);

    return () => {
        clearInterval(intervalId);
    };
  }, [dateFilter]); // Reload if date filter changes

  const handleUpdateGoals = (newGoals: GoalSettings) => {
    // Save to persistence
    localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(newGoals));
    
    // Update state
    setData(prev => ({
      ...prev,
      currentGoals: newGoals
    }));
  };

  const handleRoleUpdate = (memberId: string, newRole: TeamRole) => {
    setData(prev => ({
      ...prev,
      team: prev.team.map(m => m.id === memberId ? { ...m, role: newRole } : m)
    }));
    // Note: Roles are currently memory-only. 
    // If you want to persist roles, you'd need a similar localStorage logic for 'team_config'.
  };

  if (loading && !data && !apiError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center transition-colors duration-300">
        <div className="animate-spin text-gold-500">
          <RefreshCcw size={32} />
        </div>
      </div>
    );
  }

  // Calculations for Goals
  const contractsProgress = (data.metrics.totalContracts / data.currentGoals.contractsTarget) * 100;
  const revenueProgress = (data.metrics.totalRevenue / data.currentGoals.revenueTarget) * 100;
  const cashFlowProgress = (data.metrics.totalCashFlow / data.currentGoals.cashFlowTarget) * 100;
  
  // Goal Timeline Logic
  const today = new Date();
  const deadlineDate = data.currentGoals.deadline ? new Date(data.currentGoals.deadline) : null;
  
  let daysRemaining = 0;
  let cycleStatus: 'active' | 'warning' | 'ended' | 'success' = 'active';

  if (deadlineDate) {
      // Set to end of day for fair comparison
      const endOfDeadline = new Date(deadlineDate);
      endOfDeadline.setHours(23, 59, 59, 999);
      
      const diffTime = endOfDeadline.getTime() - today.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (revenueProgress >= 100) {
          cycleStatus = 'success';
      } else if (daysRemaining < 0) {
          cycleStatus = 'ended';
      } else if (daysRemaining <= 5) {
          cycleStatus = 'warning';
      }
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      const salesBreakdown = dataPoint.salesBreakdown;
      const hasBreakdown = salesBreakdown && salesBreakdown.length > 0;

      return (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 p-3 rounded shadow-xl max-w-[250px] z-50">
          <p className="text-gray-500 dark:text-gray-300 text-xs mb-2 border-b border-gray-200 dark:border-neutral-800 pb-1">{label ? `Dia ${label}` : ''}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm font-bold flex justify-between gap-4">
              <span>{entry.name}:</span>
              <span>
                  {entry.name.includes('Count') || entry.name.includes('Leads') || entry.name.includes('value') ? entry.value : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry.value)}
              </span>
            </p>
          ))}

          {hasBreakdown && (
              <div className="mt-3 pt-2 border-t border-gray-200 dark:border-neutral-800">
                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Vendas do Dia:</p>
                  <div className="space-y-1 max-h-[150px] overflow-y-auto custom-scrollbar">
                      {salesBreakdown.slice(0, 5).map((sale: any, i: number) => (
                          <div key={i} className="flex justify-between text-[10px] text-gray-600 dark:text-gray-400">
                              <span className="truncate max-w-[120px]" title={sale.name}>{sale.name}</span>
                              <span className="text-gold-500">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(sale.value)}</span>
                          </div>
                      ))}
                      {salesBreakdown.length > 5 && (
                          <p className="text-[9px] text-gray-600 italic text-center pt-1">+ {salesBreakdown.length - 5} outros</p>
                      )}
                  </div>
              </div>
          )}
        </div>
      );
    }
    return null;
  };

  const ServiceTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
         <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 p-3 rounded shadow-xl z-50">
            <p className="text-gold-500 font-bold mb-1">{data.name}</p>
            <p className="text-xs text-gray-600 dark:text-gray-300">Volume: {data.value} processos</p>
            {data.monetaryValue > 0 && (
                <p className="text-sm text-gray-900 dark:text-white font-bold">
                    Gerado: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.monetaryValue)}
                </p>
            )}
         </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] text-gray-800 dark:text-gray-200 p-3 md:p-6 font-sans selection:bg-gold-500/30 selection:text-gold-600 dark:selection:text-gold-200 transition-colors duration-300 print:bg-white print:text-black print:p-0">
      
      {/* Header - Full Width */}
      <header className="w-full px-2 md:px-4 lg:px-6 mb-8 print:mb-4">
        <div className="flex flex-col xl:flex-row justify-between items-center xl:items-start gap-6 mb-6">
          <div className="flex flex-col md:flex-row items-center gap-4 text-center md:text-left w-full md:w-auto">
            <div className="relative">
                 {/* Adapt Logo for background if necessary - Assuming transparent PNG */}
                 <img 
                  src="https://i.imgur.com/k7hAWTD.png" 
                  alt="Nerik Lino Advogados Logo" 
                  className="h-10 md:h-12 w-auto object-contain invert dark:invert-0 transition-all duration-300 print:invert"
                />
            </div>
           
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-3">
                 <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400 tracking-[0.2em] uppercase font-medium md:border-l border-gray-300 dark:border-neutral-800 md:pl-3">
                    Performance Dashboard
                 </span>
                 
                 {!apiError ? (
                   <span className="flex items-center gap-1 text-[9px] text-green-600 dark:text-green-500 border border-green-200 dark:border-green-900/50 bg-green-100 dark:bg-green-900/10 px-1.5 py-0.5 rounded print:hidden">
                      <Wifi size={10} />
                      LIVE
                   </span>
                 ) : (
                   <span className="flex items-center gap-1 text-[9px] text-red-500 dark:text-red-400 border border-red-200 dark:border-red-900/50 bg-red-100 dark:bg-red-900/10 px-1.5 py-0.5 rounded print:hidden">
                      <WifiOff size={10} />
                      ERROR
                   </span>
                 )}
              </div>
            </div>
            
            {/* Realtime Clock Widget */}
            <div className="hidden md:flex flex-col ml-auto xl:ml-8 border-l border-gray-200 dark:border-neutral-800 pl-4">
                <div className="flex items-center gap-2 text-gray-900 dark:text-white font-bold text-xl tabular-nums tracking-tight">
                    <Clock size={18} className="text-gold-500" />
                    {currentDateTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                    <Calendar size={10} />
                    {currentDateTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-center justify-center print:hidden">
             {/* View Switcher */}
            <div className="bg-white dark:bg-neutral-900 p-1 rounded-lg border border-gray-200 dark:border-neutral-800 flex w-full md:w-auto overflow-x-auto shadow-sm">
              <button 
                onClick={() => setViewMode('overview')}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-1.5 rounded text-xs font-medium transition-all whitespace-nowrap ${viewMode === 'overview' ? 'bg-gold-500 text-black shadow-lg shadow-gold-500/20' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
              >
                <LayoutDashboard size={14} />
                Visão Geral
              </button>
              <button 
                onClick={() => setViewMode('goals')}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-1.5 rounded text-xs font-medium transition-all whitespace-nowrap ${viewMode === 'goals' ? 'bg-gold-500 text-black shadow-lg shadow-gold-500/20' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
              >
                <Users size={14} />
                Equipe
              </button>
               <button 
                onClick={() => setViewMode('ranking')}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-1.5 rounded text-xs font-medium transition-all whitespace-nowrap ${viewMode === 'ranking' ? 'bg-gold-500 text-black shadow-lg shadow-gold-500/20' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
              >
                <Medal size={14} />
                Ranking
              </button>
            </div>
            
            <div className="flex items-center gap-2">
                <button 
                  onClick={() => loadData(false)}
                  disabled={loading}
                  className="hidden md:flex items-center gap-2 px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gold-500 hover:border-gold-500/30 transition-all disabled:opacity-50 group shadow-sm"
                  title="Atualizar dados agora"
                >
                  <RefreshCcw size={14} className={`group-hover:text-gold-500 ${loading ? 'animate-spin text-gold-500' : ''}`} />
                </button>

                <button 
                    onClick={toggleTheme}
                    className="p-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gold-500 hover:border-gold-500/30 transition-all shadow-sm"
                    title={theme === 'dark' ? "Modo Claro" : "Modo Escuro"}
                >
                    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                </button>

                <button 
                    onClick={handlePrint}
                    className="p-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:border-gold-500/30 transition-all shadow-sm"
                    title="Imprimir Relatório"
                >
                    <Printer size={16} />
                </button>
            </div>

            <DateFilter filter={dateFilter} onChange={setDateFilter} />
          </div>
        </div>
        
        {apiError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-800 dark:text-gray-300 text-xs p-4 rounded-lg flex flex-col md:flex-row items-start md:items-center gap-3 mb-4 animate-fadeIn">
                <div className="flex items-center gap-2 text-red-500 shrink-0">
                   <AlertCircle size={18} />
                   <span className="font-bold">Erro na Integração:</span>
                </div>
                <span className="font-mono text-[10px] md:text-xs opacity-80 break-all">
                  {apiError}
                </span>
                <button 
                  onClick={() => loadData(false)} 
                  className="mt-2 md:mt-0 md:ml-auto text-gold-500 hover:text-gray-900 dark:hover:text-white underline whitespace-nowrap"
                >
                  Tentar novamente
                </button>
            </div>
        )}
      </header>

      {/* Goal Config Modal */}
      <GoalConfigModal 
        isOpen={isGoalModalOpen} 
        onClose={() => setIsGoalModalOpen(false)} 
        currentGoals={data.currentGoals}
        onSave={handleUpdateGoals}
      />

      {/* Main Content - Full Width */}
      <main className="w-full px-2 md:px-4 lg:px-6 space-y-6">
        
        {/* VIEW: OVERVIEW */}
        {viewMode === 'overview' && (
          <>
            {/* GOALS COMMAND CENTER */}
            <div className="animate-fadeIn mb-6 print:border print:border-black print:p-4 print:mb-8">
                <Card className="relative overflow-hidden border-gold-500/30 dark:border-gold-500/20 shadow-lg shadow-gold-500/5">
                    {/* Background Glow */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gold-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                    <div className="flex flex-col lg:flex-row gap-8 items-stretch">
                        
                        {/* LEFT: MAIN GOAL (Revenue) */}
                        <div className="flex-1 flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-gold-500/10 rounded-lg border border-gold-500/20 text-gold-500">
                                        <Target size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">Meta de Honorários</h2>
                                        <p className="text-[10px] text-gray-500">Objetivo mensal principal</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setIsGoalModalOpen(true)}
                                    className="text-gray-400 hover:text-gold-500 transition-colors print:hidden"
                                >
                                    <Pencil size={14} />
                                </button>
                            </div>

                            <div className="mb-4">
                                <div className="flex items-baseline gap-2">
                                    <h3 className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white tracking-tight">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(data.metrics.totalRevenue)}
                                    </h3>
                                    <span className="text-sm text-gray-500 font-medium">
                                        de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(data.currentGoals.revenueTarget)}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold">
                                    <span className={`${revenueProgress >= 100 ? 'text-green-500' : 'text-gold-600 dark:text-gold-400'}`}>
                                        {revenueProgress.toFixed(1)}% Concluído
                                    </span>
                                    <span className="text-gray-400">
                                         {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Math.max(0, data.currentGoals.revenueTarget - data.metrics.totalRevenue))} restante
                                    </span>
                                </div>
                                <div className="w-full h-4 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden border border-gray-200 dark:border-neutral-700">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-1000 relative ${
                                            revenueProgress >= 100 ? 'bg-green-500' : 'bg-gradient-to-r from-gold-600 to-gold-400'
                                        }`} 
                                        style={{ width: `${Math.min(revenueProgress, 100)}%` }}
                                    >
                                        <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9InN0cmlwZXMiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgNDBMODAgMEgwTDQwIDQwVjBaIiBmaWxsPSJ3aGl0ZSIgZmlsbC1vcGFjaXR5PSIwLjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjc3RyaXBlcykiLz48L3N2Zz4=')] opacity-30 animate-pulse"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: TIMELINE & STATUS */}
                        <div className="flex-1 lg:border-l lg:border-gray-200 dark:lg:border-neutral-800 lg:pl-8 flex flex-col justify-center">
                            
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Status do Ciclo</h4>
                                {deadlineDate && (
                                    <div className="text-[10px] text-gray-400">
                                        Fim: {deadlineDate.toLocaleDateString('pt-BR')}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition-all ${
                                    cycleStatus === 'success' ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900 text-green-600' :
                                    cycleStatus === 'ended' ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900 text-red-600' :
                                    cycleStatus === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900 text-yellow-600' :
                                    'bg-gray-50 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-300'
                                }`}>
                                     {cycleStatus === 'success' ? <CheckCircle2 size={24} /> : 
                                      cycleStatus === 'ended' ? <XCircle size={24} /> :
                                      cycleStatus === 'warning' ? <AlertTriangle size={24} /> :
                                      <Hourglass size={24} />}
                                     
                                     <span className="text-xs font-bold uppercase mt-1">
                                         {cycleStatus === 'success' ? 'Meta Batida!' :
                                          cycleStatus === 'ended' ? 'Ciclo Encerrado' :
                                          cycleStatus === 'warning' ? 'Reta Final' :
                                          'Em Andamento'}
                                     </span>
                                </div>

                                <div className="p-4 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 flex flex-col items-center justify-center text-center">
                                     {deadlineDate ? (
                                         <>
                                            <span className={`text-3xl font-bold ${daysRemaining < 0 ? 'text-red-500' : daysRemaining <= 5 ? 'text-yellow-500' : 'text-gray-900 dark:text-white'}`}>
                                                {daysRemaining < 0 ? 0 : daysRemaining}
                                            </span>
                                            <span className="text-[10px] uppercase text-gray-500 font-medium">Dias Restantes</span>
                                         </>
                                     ) : (
                                         <span className="text-xs text-gray-400 italic">Sem prazo definido</span>
                                     )}
                                </div>
                            </div>
                            
                            {/* Secondary Goal (Contracts) Small View */}
                            <div className="bg-gray-50 dark:bg-neutral-800/50 rounded-lg p-3 border border-gray-100 dark:border-neutral-800 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <FileSignature size={14} className="text-gold-500"/>
                                    <span className="text-xs text-gray-600 dark:text-gray-400">Contratos: <strong className="text-gray-900 dark:text-white">{data.metrics.totalContracts}</strong> / {data.currentGoals.contractsTarget}</span>
                                </div>
                                <div className="w-24 h-1.5 bg-gray-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${contractsProgress >= 100 ? 'bg-green-500' : 'bg-gold-500'}`} style={{ width: `${Math.min(contractsProgress, 100)}%` }}></div>
                                </div>
                            </div>

                        </div>
                    </div>
                </Card>
            </div>

            {/* Row 1: KPI Cards (Simplified since Main Goal is Up Top) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fadeIn">
              
               {/* KPI 1: Reuniões Realizadas */}
              <Card className="relative overflow-hidden group hover:border-gold-500/30 transition-colors">
                 <div className="flex justify-between items-start mb-2">
                    <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Reuniões Realizadas</p>
                        <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{data.metrics.totalMeetings}</h3>
                    </div>
                    <div className="p-2 bg-gray-100 dark:bg-neutral-800 rounded-lg text-gold-500">
                        <CalendarCheck size={20} />
                    </div>
                 </div>
                 
                 <div className="mt-4">
                     <p className="text-[10px] text-gray-500 dark:text-gray-600">Baseado em Data da Reunião</p>
                    <div className="w-full h-1 bg-gray-200 dark:bg-neutral-800 rounded-full overflow-hidden mt-2">
                         <div className="h-full bg-gold-500 w-full opacity-50"></div>
                    </div>
                 </div>
              </Card>

              {/* KPI 2: Entradas (Caixa) */}
              <Card className="relative overflow-hidden group">
                 <div className="flex justify-between items-start mb-2">
                    <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Entradas (Caixa)</p>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                             {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(data.metrics.totalCashFlow)}
                        </h3>
                    </div>
                    <div className="p-2 bg-gray-100 dark:bg-neutral-800 rounded-lg text-gold-500">
                        <Wallet size={20} />
                    </div>
                 </div>
                 <div className="mt-4">
                     <div className="flex justify-between text-xs mb-1">
                        <span className={`${cashFlowProgress >= 100 ? 'text-green-600 dark:text-green-500' : 'text-gray-400'}`}>{Math.round(cashFlowProgress)}% da Meta</span>
                        <span className="text-gray-500">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(data.currentGoals.cashFlowTarget)}</span>
                    </div>
                    <div className="w-full h-1 bg-gray-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${cashFlowProgress >= 100 ? 'bg-green-500' : 'bg-gold-500'}`} style={{ width: `${Math.min(cashFlowProgress, 100)}%` }}></div>
                    </div>
                 </div>
              </Card>

              {/* KPI 3: Ticket Médio (Calculated) */}
               <Card className="relative overflow-hidden group">
                 <div className="flex justify-between items-start mb-2">
                    <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Ticket Médio</p>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                             {data.metrics.totalContracts > 0 
                                ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(data.metrics.totalRevenue / data.metrics.totalContracts)
                                : 'R$ 0'
                             }
                        </h3>
                    </div>
                    <div className="p-2 bg-gray-100 dark:bg-neutral-800 rounded-lg text-gold-500">
                        <TrendingUp size={20} />
                    </div>
                 </div>
                 <div className="mt-auto pt-4">
                    <p className="text-[10px] text-gray-500">Média por contrato assinado</p>
                 </div>
              </Card>

              {/* KPI 4: Comissões (Cost) */}
               <Card className="relative overflow-hidden group">
                 <div className="flex justify-between items-start mb-2">
                    <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Comissões (Prov.)</p>
                        <h3 className="text-2xl font-bold text-gold-500 mt-1">
                             {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(data.metrics.totalCommission)}
                        </h3>
                    </div>
                    <div className="p-2 bg-gray-100 dark:bg-neutral-800 rounded-lg text-gold-500">
                        <Users size={20} />
                    </div>
                 </div>
                 <div className="mt-auto pt-4">
                    <p className="text-[10px] text-gray-500">Estimativa baseada em % da entrada</p>
                 </div>
              </Card>
            </div>

            {/* Row 2: Charts - Evolution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
              <Card title="Evolução de Faturamento Diário">
                <div className="h-64 mt-4 min-w-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.charts.dailyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#333' : '#e5e5e5'} vertical={false} />
                      <XAxis 
                        dataKey="day" 
                        stroke={theme === 'dark' ? '#666' : '#9ca3af'} 
                        tick={{fill: theme === 'dark' ? '#666' : '#6b7280', fontSize: 10}} 
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        stroke={theme === 'dark' ? '#666' : '#9ca3af'} 
                        tick={{fill: theme === 'dark' ? '#666' : '#6b7280', fontSize: 10}} 
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) => `R$${val/1000}k`}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} isAnimationActive={false} />
                      <Bar dataKey="realizado" name="Realizado" fill="#C59D5F" radius={[4, 4, 0, 0]} barSize={20} isAnimationActive={false} />
                      <Line type="monotone" dataKey="meta" name="Meta Diária" stroke={theme === 'dark' ? '#404040' : '#d4d4d4'} strokeDasharray="5 5" dot={false} strokeWidth={2} isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title="Novos Leads (Criação)">
                <div className="h-64 mt-4 min-w-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.charts.dailyLeads} margin={{ left: -20, right: 10 }}>
                      <defs>
                        <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#C59D5F" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#C59D5F" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#333' : '#e5e5e5'} vertical={false} />
                      <XAxis 
                        dataKey="day" 
                        stroke={theme === 'dark' ? '#666' : '#9ca3af'} 
                        tick={{fill: theme === 'dark' ? '#666' : '#6b7280', fontSize: 10}} 
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis 
                        stroke={theme === 'dark' ? '#666' : '#9ca3af'} 
                        tick={{fill: theme === 'dark' ? '#666' : '#6b7280', fontSize: 10}} 
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip 
                        content={<CustomTooltip />} 
                        isAnimationActive={false} 
                        cursor={{ stroke: '#C59D5F', strokeWidth: 1 }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        name="Novos Leads" 
                        stroke="#C59D5F" 
                        fillOpacity={1} 
                        fill="url(#colorLeads)" 
                        activeDot={{ r: 6 }} 
                        isAnimationActive={false} 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* Row 3: Service & Creative Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
              <Card title="Faturamento por Tipo de Ação (Tags do CRM)">
                 <div className="h-64 mt-4 min-w-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={data.charts.services} margin={{ left: 0, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#333' : '#e5e5e5'} horizontal={true} vertical={false} />
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        stroke={theme === 'dark' ? '#999' : '#6b7280'} 
                        tick={{fill: theme === 'dark' ? '#999' : '#6b7280', fontSize: 10}} 
                        width={100}
                      />
                      <Tooltip content={<ServiceTooltip />} cursor={{fill: theme === 'dark' ? '#ffffff10' : '#00000005'}} isAnimationActive={false} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={false}>
                        {data.charts.services.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Ranking de Criativos */}
              <CreativeRanking creatives={data.creatives} />
            </div>

            {/* Row 4: Pipeline */}
            <div className="animate-fadeIn">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-gray-100 dark:bg-neutral-800 rounded-md border border-gray-200 dark:border-neutral-700">
                            <TrendingUp size={18} className="text-gold-500" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase">Pipeline de Vendas</h3>
                            <p className="text-[10px] text-gray-500">Acompanhamento em tempo real</p>
                        </div>
                    </div>
                    <div className="flex bg-white dark:bg-neutral-900 rounded p-1 border border-gray-200 dark:border-neutral-800 self-end md:self-auto shadow-sm print:hidden">
                        <button 
                            onClick={() => setPipelineViewMode('list')}
                            className={`p-1.5 rounded transition-colors ${pipelineViewMode === 'list' ? 'bg-gray-100 dark:bg-neutral-800 text-gold-500' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                            title="Lista (Funil)"
                        >
                            <List size={16} />
                        </button>
                         <button 
                            onClick={() => setPipelineViewMode('kanban')}
                            className={`p-1.5 rounded transition-colors ${pipelineViewMode === 'kanban' ? 'bg-gray-100 dark:bg-neutral-800 text-gold-500' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                            title="Kanban (Colunas)"
                        >
                            <Columns size={16} />
                        </button>
                    </div>
                </div>

                {pipelineViewMode === 'list' ? (
                     <PipelineFunnel stages={data.pipeline} />
                ) : (
                     <KanbanBoard stages={data.pipeline} />
                )}
            </div>
          </>
        )}

        {/* VIEW: TEAM GOALS */}
        {viewMode === 'goals' && (
          <Card title="Performance da Equipe" className="animate-fadeIn">
            <div className="mt-4 space-y-2 overflow-x-auto">
                <div className="min-w-[700px] grid grid-cols-1 md:grid-cols-12 gap-4 px-2 py-2 border-b border-gray-200 dark:border-neutral-800 text-[10px] uppercase text-gray-500 font-bold tracking-wider">
                    <div className="md:col-span-3">Vendedor</div>
                    <div className="md:col-span-6 text-center">Atividade (Leads / Reuniões / Propostas / Conversão)</div>
                    <div className="md:col-span-3 text-right">Financeiro</div>
                </div>
              {data.team.map((member) => (
                <TeamRow 
                    key={member.id} 
                    member={member} 
                    detailed={true} 
                    onRoleUpdate={handleRoleUpdate}
                />
              ))}
            </div>
          </Card>
        )}

        {/* VIEW: RANKING */}
        {viewMode === 'ranking' && (
            <TeamRanking members={data.team} />
        )}
      </main>
    </div>
  );
}

export default App;