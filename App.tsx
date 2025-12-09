import React, { useState, useRef, useEffect } from 'react';
import SearchInterface from './components/SearchInterface';
import LeadCard from './components/LeadCard';
import BatchSender from './components/BatchSender';
import ServiceConfig from './components/ServiceConfig';
import Dashboard from './components/Dashboard';
import SalesLab from './components/SalesLab';
import Tutorial from './components/Tutorial';
import { generateLeads } from './services/geminiService';
import { Lead, GroundingSource, BusinessSize, ServiceContext, SearchHistoryItem, SearchFilters } from './types';
import { DownloadIcon, SearchIcon, WhatsAppIcon, SettingsIcon, HomeIcon, BrainIcon, BookOpenIcon } from './components/ui/Icons';

type Tab = 'dashboard' | 'search' | 'saved' | 'config' | 'lab' | 'tutorial';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('search');
  
  // Search State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sources, setSources] = useState<GroundingSource[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState(0); // Progress percentage 0-100
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
    ticketValue: 1500
  });

  const resultsRef = useRef<HTMLDivElement>(null);
  const progressIntervalRef = useRef<number | null>(null);

  // --- LOCAL STORAGE PERSISTENCE ---
  useEffect(() => {
    try {
        const storedSavedLeads = localStorage.getItem('leadinfinit_saved');
        const storedContext = localStorage.getItem('leadinfinit_context');
        const storedHistory = localStorage.getItem('leadinfinit_history');
        const storedCount = localStorage.getItem('leadinfinit_total_count');

        if (storedSavedLeads) setSavedLeads(JSON.parse(storedSavedLeads));
        if (storedContext) setServiceContext(JSON.parse(storedContext));
        if (storedHistory) setSearchHistory(JSON.parse(storedHistory));
        if (storedCount) setTotalGeneratedCount(parseInt(storedCount));
    } catch (e) {
        console.error("Falha ao carregar storage", e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('leadinfinit_saved', JSON.stringify(savedLeads));
  }, [savedLeads]);

  useEffect(() => {
    localStorage.setItem('leadinfinit_context', JSON.stringify(serviceContext));
  }, [serviceContext]);

  useEffect(() => {
    localStorage.setItem('leadinfinit_history', JSON.stringify(searchHistory));
  }, [searchHistory]);

  useEffect(() => {
    localStorage.setItem('leadinfinit_total_count', totalGeneratedCount.toString());
  }, [totalGeneratedCount]);


  const startProgressSimulation = (estimatedSeconds: number) => {
    setProgress(0);
    const totalMs = estimatedSeconds * 1000;
    const intervalTime = 100;
    const steps = totalMs / intervalTime;
    const increment = 95 / steps; // Vai até 95% e espera

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    progressIntervalRef.current = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return 95; // Trava em 95% até terminar de verdade
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
        const newHistoryItem: SearchHistoryItem = { niche, location, size, timestamp: Date.now() };
        setSearchHistory(prev => {
            const filtered = prev.filter(item => !(item.niche === niche && item.location === location && item.size === size));
            return [newHistoryItem, ...filtered].slice(0, 10);
        });
    }

    // Estimativa visual (Apenas para UX, a API retorna quando estiver pronta)
    const estimatedSeconds = (count * 2) + 1; 
    startProgressSimulation(estimatedSeconds);

    if (!append) {
      setLeads([]);
      setSources([]);
    }
    setSearchParams({ niche, location, size, count, filters, customInstruction });

    try {
      const existingNames = append ? leads.map(l => l.name) : [];
      
      // Chamada à API
      const { leads: newLeads, sources: newSources } = await generateLeads(niche, location, size, count, existingNames, serviceContext, filters, customInstruction);
      
      // Assim que a API responde, finalizamos a barra imediatamente
      stopProgressSimulation();

      if (newLeads.length === 0 && !append) {
        setError("A IA não encontrou contatos válidos com telefone para este nicho. Tente outro termo ou local.");
      } else {
        setLeads(prev => append ? [...prev, ...newLeads] : newLeads);
        setSources(prev => append ? [...prev, ...newSources] : newSources);
        setTotalGeneratedCount(prev => prev + newLeads.length);
        
        if (!append && resultsRef.current) {
          // Scroll imediato
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }

    } catch (err: any) {
      console.error(err);
      setError("Falha ao buscar leads. A internet é vasta, mas às vezes difícil de navegar. Tente novamente.");
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
        const leadToSave = { 
            ...lead, 
            status: lead.status || 'new',
            score: lead.score || 'warm'
        };
        return [...prev, leadToSave];
      }
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
    <div className="min-h-screen bg-background text-white selection:bg-accent/30 selection:text-white pb-20">
      
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] opacity-30 animate-pulse-fast"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 rounded-full blur-[120px] opacity-20"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 pt-8 md:pt-16">
        
        {/* Header */}
        <div className="text-center mb-10 space-y-4">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400">Lead</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Infinit</span>
          </h1>
          <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto font-light">
            Sua máquina de prospecção. Encontre leads ideais para <span className="text-accent font-medium">oferta de sites</span> e marketing.
          </p>
        </div>

        {/* Tab Navigation - BLOCKED WHEN SEARCHING */}
        <div className={`flex flex-wrap justify-center mb-10 gap-2 transition-all duration-300 ${isSearching ? 'pointer-events-none opacity-50 grayscale' : ''}`}>
          <div className="bg-surface/50 p-1 rounded-xl border border-slate-800 flex flex-wrap gap-2 backdrop-blur-sm">
             <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center px-4 md:px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'dashboard' 
                  ? 'bg-slate-700 text-white shadow-lg shadow-slate-900/25 border border-slate-600' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <HomeIcon className="w-4 h-4 mr-2" />
              Visão Geral
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`flex items-center px-4 md:px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'search' 
                  ? 'bg-primary text-white shadow-lg shadow-primary/25' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <SearchIcon className="w-4 h-4 mr-2" />
              Buscador
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex items-center px-4 md:px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'saved' 
                  ? 'bg-green-600 text-white shadow-lg shadow-green-600/25' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <WhatsAppIcon className="w-4 h-4 mr-2" />
              CRM Pipeline
              {savedLeads.length > 0 && (
                <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                  {savedLeads.length}
                </span>
              )}
            </button>
             <button
              onClick={() => setActiveTab('lab')}
              className={`flex items-center px-4 md:px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'lab' 
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <BrainIcon className="w-4 h-4 mr-2" />
              Laboratório
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`flex items-center px-4 md:px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'config' 
                  ? 'bg-accent text-surface shadow-lg shadow-accent/25' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <SettingsIcon className="w-4 h-4 mr-2" />
              Meu Serviço
              {!serviceContext.serviceName && (
                <span className="ml-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('tutorial')}
              className={`flex items-center px-4 md:px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'tutorial' 
                  ? 'bg-yellow-600 text-white shadow-lg shadow-yellow-600/25' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <BookOpenIcon className="w-4 h-4 mr-2" />
              Guia
            </button>
          </div>
        </div>

        {/* Main Content Area */}
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
              {/* Search */}
              <SearchInterface 
                onSearch={(n, l, s, c, f, i) => handleSearch(n, l, s, c, f, i, false)} 
                isLoading={isSearching} 
                progress={progress}
                history={searchHistory}
                onClearHistory={() => setSearchHistory([])}
                serviceContext={serviceContext}
              />

              {/* Error State */}
              {error && (
                <div className="max-w-4xl mx-auto mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-center animate-fade-in">
                  <p className="font-bold">⚠️ Atenção</p>
                  {error}
                </div>
              )}

              {/* Results */}
              {leads.length > 0 && (
                <div ref={resultsRef} className="max-w-7xl mx-auto animate-fade-in">
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h2 className="text-3xl font-bold text-white">
                        Resultados Encontrados
                      </h2>
                      <p className="text-slate-500 mt-1">
                        {leads.length} leads qualificados com <span className="text-green-400 font-bold">Telefone</span>
                      </p>
                    </div>
                    <button 
                      onClick={exportCSV}
                      disabled={isSearching}
                      className={`flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700 ${isSearching ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <DownloadIcon className="w-4 h-4" />
                      <span>Exportar CSV</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                    {leads.map((lead, index) => (
                      <LeadCard 
                        key={lead.id} 
                        lead={lead} 
                        index={index} 
                        onSave={toggleSaveLead}
                        isSaved={savedLeads.some(l => l.id === lead.id)}
                      />
                    ))}
                  </div>

                  {/* Load More */}
                  <div className="flex justify-center pb-12">
                     <button
                       onClick={handleLoadMore}
                       disabled={isSearching}
                       className="group relative px-8 py-3 rounded-full bg-surface border border-slate-700 hover:border-accent transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                     >
                       {isSearching && (
                          <div 
                            className="absolute bottom-0 left-0 h-1 bg-accent z-10 transition-all duration-300 ease-out"
                            style={{ width: `${progress}%` }}
                          ></div>
                       )}
                       <div className="absolute inset-0 bg-accent/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                       <span className="relative z-10 font-semibold text-slate-300 group-hover:text-white flex items-center">
                         {isSearching ? `Minerando Mais Dados (${Math.round(progress)}%)...` : 'Gerar Leads Infinitos'}
                         {!isSearching && (
                           <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                           </svg>
                         )}
                       </span>
                     </button>
                  </div>

                  {/* Sources (Grounding) */}
                  {sources.length > 0 && (
                    <div className="mt-8 pt-8 border-t border-slate-800/50">
                       <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Fontes Analisadas</h4>
                       <div className="flex flex-wrap gap-2">
                         {sources.slice(0, 10).map((source, idx) => (
                           <a 
                            key={idx} 
                            href={source.uri} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-xs text-slate-600 hover:text-accent underline transition-colors"
                          >
                            {new URL(source.uri).hostname.replace('www.', '')}
                          </a>
                         ))}
                       </div>
                    </div>
                  )}
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

          {activeTab === 'lab' && (
            <SalesLab serviceContext={serviceContext} />
          )}

          {activeTab === 'config' && (
            <ServiceConfig 
              initialContext={serviceContext}
              onSave={setServiceContext}
            />
          )}

          {activeTab === 'tutorial' && (
            <Tutorial onNavigate={(tab: Tab) => setActiveTab(tab)} />
          )}
        </div>
      </div>
    </div>
  );
};

export default App;