import React, { useState, useRef, useEffect, Component, ErrorInfo, PropsWithChildren } from 'react';
import SearchInterface from './components/SearchInterface';
import LeadCard from './components/LeadCard';
import BatchSender from './components/BatchSender';
import ServiceConfig from './components/ServiceConfig';
import Dashboard from './components/Dashboard';
import SalesLab from './components/SalesLab';
import Tutorial from './components/Tutorial';
import { generateLeads } from './services/geminiService';
import { Lead, GroundingSource, BusinessSize, ServiceContext, SearchHistoryItem, SearchFilters } from './types';
import { DownloadIcon, SearchIcon, WhatsAppIcon, SettingsIcon, HomeIcon, BrainIcon, BookOpenIcon, TrashIcon, SaveIcon } from './components/ui/Icons';

// --- ERROR BOUNDARY ---
interface ErrorBoundaryProps extends PropsWithChildren {}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Critical App Crash:", error, errorInfo);
  }

  handleHardReset = () => {
    if (confirm("Isso apagará seus dados salvos para recuperar o sistema. Continuar?")) {
        localStorage.clear();
        window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center p-4">
          <div className="bg-[#121826] border border-red-900/50 rounded-2xl p-8 max-w-lg text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <TrashIcon className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-black text-white mb-2">Falha no Sistema Detectada</h1>
            <p className="text-slate-400 mb-6 text-sm">
                Uma atualização recente ou dados corrompidos causaram um erro crítico.
            </p>
            <button 
                onClick={this.handleHardReset}
                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors shadow-lg"
            >
                REINICIAR SISTEMA (HARD RESET)
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

type Tab = 'dashboard' | 'search' | 'saved' | 'config' | 'lab' | 'tutorial';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('search');
  
  // Search State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sources, setSources] = useState<GroundingSource[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState(0); 
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useState<{ niche: string, location: string, size: BusinessSize, count: number, filters?: SearchFilters, customInstruction?: string } | null>(null);
  
  // Persistent State
  const [savedLeads, setSavedLeads] = useState<Lead[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [totalGeneratedCount, setTotalGeneratedCount] = useState<number>(0);
  const [serviceContext, setServiceContext] = useState<ServiceContext>({
    serviceName: '',
    description: '',
    targetAudience: '',
    ticketValue: 1500,
    templates: [] 
  });
  
  const resultsRef = useRef<HTMLDivElement>(null);
  const progressIntervalRef = useRef<number | null>(null);

  // --- REMOÇÃO SEGURA DO LOADER ---
  useEffect(() => {
    const loader = document.getElementById('app-loader');
    if (loader) {
      setTimeout(() => {
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 500);
      }, 100);
    }
  }, []);

  // --- CARREGAMENTO SEGURO DE DADOS ---
  useEffect(() => {
    const safeLoad = (key: string, setter: Function, defaultValue: any) => {
        try {
            const item = localStorage.getItem(key);
            if (item) {
                const parsed = JSON.parse(item);
                if (typeof defaultValue === 'object' && !Array.isArray(defaultValue)) {
                    setter((prev: any) => ({ ...prev, ...parsed }));
                } else {
                    setter(parsed);
                }
            }
        } catch (e) {
            console.warn(`Erro ao carregar ${key}, usando padrão.`);
        }
    };

    safeLoad('leadinfinit_saved', setSavedLeads, []);
    safeLoad('leadinfinit_context', setServiceContext, { templates: [] });
    safeLoad('leadinfinit_history', setSearchHistory, []);
    safeLoad('leadinfinit_total_count', setTotalGeneratedCount, 0);
  }, []);

  // --- SALVAMENTO SEGURO ---
  useEffect(() => { localStorage.setItem('leadinfinit_saved', JSON.stringify(savedLeads)); }, [savedLeads]);
  useEffect(() => { localStorage.setItem('leadinfinit_context', JSON.stringify(serviceContext)); }, [serviceContext]);
  useEffect(() => { localStorage.setItem('leadinfinit_history', JSON.stringify(searchHistory)); }, [searchHistory]);
  useEffect(() => { localStorage.setItem('leadinfinit_total_count', totalGeneratedCount.toString()); }, [totalGeneratedCount]);


  const startProgressSimulation = (estimatedSeconds: number) => {
    setProgress(0);
    const totalMs = estimatedSeconds * 1000;
    const intervalTime = 100; 
    const steps = totalMs / intervalTime;
    const increment = 95 / steps; 

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    progressIntervalRef.current = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return 95; 
        return prev + increment;
      });
    }, intervalTime);
  };

  const stopProgressSimulation = () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setProgress(100);
  };

  const handleSearch = async (niche: string, location: string, size: BusinessSize, count: number, filters?: SearchFilters, customInstruction?: string, append = false) => {
    setIsSearching(true);
    setError(null);
    
    if (!append) {
        const newHistoryItem: SearchHistoryItem = { 
            niche, 
            location, 
            size, 
            source: filters?.searchSource || 'google_maps',
            timestamp: Date.now() 
        };
        setSearchHistory(prev => {
            const filtered = prev.filter(item => !(item.niche === niche && item.location === location && item.size === size));
            return [newHistoryItem, ...filtered].slice(0, 10);
        });
    }

    const estimatedSeconds = Math.ceil((count * 1.5) + 3); 
    startProgressSimulation(estimatedSeconds);

    if (!append) {
      setLeads([]);
      setSources([]);
    }
    setSearchParams({ niche, location, size, count, filters, customInstruction });

    try {
      const existingNames = append ? leads.map(l => l.name) : [];
      
      const { leads: newLeads, sources: newSources } = await generateLeads(niche, location, size, count, existingNames, serviceContext, filters, customInstruction);
      
      stopProgressSimulation();

      if (newLeads.length === 0 && !append) {
        setError("A IA não encontrou contatos válidos com telefone para este nicho. Tente outro termo ou local.");
      } else {
        setLeads(prev => append ? [...prev, ...newLeads] : newLeads);
        setSources(prev => append ? [...prev, ...newSources] : newSources);
        setTotalGeneratedCount(prev => prev + newLeads.length);
        
        if (!append && resultsRef.current) {
          setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        }
      }

    } catch (err: any) {
      console.error(err);
      setError("Falha na conexão com a IA. Verifique sua chave de API ou tente novamente.");
      stopProgressSimulation();
    } finally {
      setIsSearching(false);
    }
  };

  const handleLoadMore = () => {
    if (searchParams) {
      handleSearch(searchParams.niche, searchParams.location, searchParams.size, searchParams.count, searchParams.filters, searchParams.customInstruction, true);
    }
  };

  const toggleSaveLead = (lead: Lead) => {
    setSavedLeads(prev => {
      const exists = prev.find(l => l.id === lead.id);
      if (exists) {
        return prev.filter(l => l.id !== lead.id);
      } else {
        return [...prev, { ...lead, status: lead.status || 'new', score: lead.score || 'warm' }];
      }
    });
  };

  const handleSaveAll = () => {
    setSavedLeads(prev => {
        const newSaved = [...prev];
        let addedCount = 0;
        leads.forEach(lead => {
            if (!newSaved.find(l => l.id === lead.id)) {
                newSaved.push({ ...lead, status: lead.status || 'new', score: lead.score || 'warm' });
                addedCount++;
            }
        });
        return newSaved;
    });
  };
  
  const updateLeadInSaved = (updatedLead: Lead) => {
      setSavedLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
  };

  const exportCSV = () => {
    const listToExport = activeTab === 'search' ? leads : savedLeads;
    if (listToExport.length === 0) return;
    
    const headers = ['Nome', 'Telefone', 'Instagram', 'Site', 'Descrição', 'Status', 'Pontuação'];
    const csvContent = [
      headers.join(','),
      ...listToExport.map(lead => [
        `"${lead.name}"`,
        `"${lead.phone}"`,
        `"${lead.instagram || ''}"`,
        `"${lead.website || ''}"`,
        `"${lead.description.replace(/"/g, '""')}"`,
        `"${lead.status || 'new'}"`,
        `"${lead.score || 'warm'}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `leads_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-background text-white selection:bg-accent/30 selection:text-white pb-20 overflow-x-hidden w-full">
      
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] opacity-20 animate-pulse-fast"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 rounded-full blur-[120px] opacity-15"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 pt-6 md:pt-8 max-w-[1400px]">
        
        {/* HEADER RESPONSIVO */}
        <div className="text-center mb-6 space-y-1">
          {/* Ajustado para text-2xl em mobile para não quebrar linha */}
          <h1 className="text-2xl md:text-5xl font-black tracking-tighter mb-1">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400">Lead</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Infinit</span>
          </h1>
          <p className="text-slate-400 text-xs md:text-sm max-w-xl mx-auto font-light leading-relaxed hidden sm:block">
            Sua máquina de prospecção.
          </p>
        </div>

        {/* NAVEGAÇÃO SCROLLÁVEL - A solução mágica para telas pequenas */}
        <div className={`mb-6 transition-all duration-300 ${isSearching ? 'pointer-events-none opacity-50 grayscale' : ''}`}>
          <div className="flex justify-start md:justify-center overflow-x-auto pb-2 scrollbar-hide px-2 -mx-4 md:mx-0">
            <div className="bg-surface/50 p-1.5 rounded-xl border border-slate-800 flex flex-nowrap gap-1.5 backdrop-blur-sm min-w-max mx-2 md:mx-0">
              {[
                { id: 'dashboard', icon: HomeIcon, label: 'Visão Geral' },
                { id: 'search', icon: SearchIcon, label: 'Buscador', highlight: true },
                { id: 'saved', icon: WhatsAppIcon, label: 'CRM', count: savedLeads.length },
                { id: 'lab', icon: BrainIcon, label: 'Lab' },
                { id: 'config', icon: SettingsIcon, label: 'Serviço' },
                { id: 'tutorial', icon: BookOpenIcon, label: 'Guia' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  id={tab.id === 'search' ? 'tab-search-trigger' : undefined}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={`flex items-center px-3 py-2 md:px-4 md:py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    activeTab === tab.id 
                      ? `${tab.highlight ? 'bg-primary' : tab.id === 'saved' ? 'bg-green-600' : tab.id === 'lab' ? 'bg-purple-600' : tab.id === 'config' ? 'bg-accent text-surface' : 'bg-slate-700'} text-white shadow-lg transform scale-105` 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5 mr-1.5" />
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="ml-1.5 bg-white/20 px-1.5 py-0.5 rounded-full text-[9px]">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="min-h-[500px]">
          {activeTab === 'dashboard' && (
             <Dashboard 
                savedLeads={savedLeads} 
                totalLeadsGenerated={totalGeneratedCount} 
                serviceContext={serviceContext}
                onUpdateTicketValue={(val) => setServiceContext(prev => ({ ...prev, ticketValue: val }))}
             />
          )}

          {activeTab === 'search' && (
            <>
              <SearchInterface 
                onSearch={(n, l, s, c, f, i) => handleSearch(n, l, s, c, f, i, false)} 
                isLoading={isSearching} 
                progress={progress}
                history={searchHistory}
                onClearHistory={() => setSearchHistory([])}
                serviceContext={serviceContext}
              />

              {error && (
                <div className="max-w-4xl mx-auto mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-center animate-fade-in text-sm">
                  <p className="font-bold">⚠️ Status da Missão</p>
                  {error}
                </div>
              )}

              {leads.length > 0 && (
                <div ref={resultsRef} className="animate-fade-in">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 px-2 gap-3">
                    <div>
                      <h2 className="text-xl md:text-2xl font-bold text-white">Resultados</h2>
                      <p className="text-slate-500 text-xs mt-0.5">{leads.length} alvos identificados.</p>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <button onClick={handleSaveAll} disabled={isSearching} className="flex-1 md:flex-none flex items-center justify-center space-x-2 px-4 py-2 bg-accent hover:bg-cyan-400 text-surface font-bold rounded-lg transition-all shadow-lg shadow-cyan-500/20 text-xs uppercase tracking-wide transform active:scale-95">
                          <SaveIcon className="w-4 h-4" /> <span>Salvar Todos ({leads.length})</span>
                        </button>
                        <button onClick={exportCSV} disabled={isSearching} className="flex-1 md:flex-none flex items-center justify-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700 text-xs font-bold uppercase tracking-wide">
                          <DownloadIcon className="w-4 h-4" /> <span className="hidden md:inline">Exportar CSV</span><span className="md:hidden">CSV</span>
                        </button>
                    </div>
                  </div>

                  {/* GRID RESPONSIVO: 1 col (mobile), 2 col (laptop), 3 col (desktop) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
                    {leads.map((lead, index) => (
                      <LeadCard key={lead.id} lead={lead} index={index} onSave={toggleSaveLead} isSaved={savedLeads.some(l => l.id === lead.id)} />
                    ))}
                  </div>

                  <div className="flex justify-center pb-12">
                     <button onClick={handleLoadMore} disabled={isSearching} className="group relative px-6 py-2.5 rounded-full bg-surface border border-slate-700 hover:border-accent transition-all duration-300 disabled:opacity-50 overflow-hidden text-sm w-full md:w-auto">
                       {isSearching && <div className="absolute bottom-0 left-0 h-1 bg-accent z-10 transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>}
                       <span className="relative z-10 font-semibold text-slate-300 group-hover:text-white flex items-center justify-center">
                         {isSearching ? `Minerando (${Math.round(progress)}%)...` : 'Buscar Mais Leads'}
                       </span>
                     </button>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'saved' && (
            <BatchSender 
              savedLeads={savedLeads} 
              serviceContext={serviceContext}
              onRemove={(id) => setSavedLeads(prev => prev.filter(l => l.id !== id))}
              onClear={() => setSavedLeads([])}
              onUpdateLead={updateLeadInSaved}
            />
          )}

          {activeTab === 'lab' && <SalesLab serviceContext={serviceContext} />}
          {activeTab === 'config' && <ServiceConfig initialContext={serviceContext} onSave={setServiceContext} />}
          {activeTab === 'tutorial' && <Tutorial onNavigate={(tab: Tab) => setActiveTab(tab)} />}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};

export default App;