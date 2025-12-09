
import React, { useState, useRef, useEffect } from 'react';
import SearchInterface from './components/SearchInterface';
import LeadCard from './components/LeadCard';
import BatchSender from './components/BatchSender';
import ServiceConfig from './components/ServiceConfig';
import { generateLeads } from './services/geminiService';
import { Lead, GroundingSource, BusinessSize, ServiceContext } from './types';
import { DownloadIcon, UsersIcon, SearchIcon, WhatsAppIcon, SettingsIcon } from './components/ui/Icons';

type Tab = 'search' | 'saved' | 'config';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('search');
  
  // Search State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sources, setSources] = useState<GroundingSource[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState(0); // Progress percentage 0-100
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useState<{ niche: string, location: string, size: BusinessSize, count: number } | null>(null);

  // Saved/Batch State
  const [savedLeads, setSavedLeads] = useState<Lead[]>([]);

  // Service Context State
  const [serviceContext, setServiceContext] = useState<ServiceContext>({
    serviceName: '',
    description: '',
    targetAudience: ''
  });

  const resultsRef = useRef<HTMLDivElement>(null);
  const progressIntervalRef = useRef<number | null>(null);

  const startProgressSimulation = (estimatedSeconds: number) => {
    setProgress(0);
    const totalMs = estimatedSeconds * 1000;
    const intervalTime = 100;
    const steps = totalMs / intervalTime;
    const increment = 90 / steps; // Target 90% by the end of estimate

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    progressIntervalRef.current = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return 90; // Stall at 90% until done
        return prev + increment;
      });
    }, intervalTime);
  };

  const stopProgressSimulation = () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setProgress(100);
  };

  const handleSearch = async (niche: string, location: string, size: BusinessSize, count: number, append = false) => {
    setIsSearching(true);
    setError(null);
    
    // Estimate roughly 2.5s per lead + some overhead.
    const estimatedSeconds = (count * 2.5) + 2; 
    startProgressSimulation(estimatedSeconds);

    if (!append) {
      setLeads([]);
      setSources([]);
    }
    setSearchParams({ niche, location, size, count });

    try {
      // Pass existing names to prevent duplicates in the AI prompt
      const existingNames = append ? leads.map(l => l.name) : [];
      
      const { leads: newLeads, sources: newSources } = await generateLeads(niche, location, size, count, existingNames, serviceContext);
      
      if (newLeads.length === 0 && !append) {
        setError("A IA não encontrou contatos válidos com telefone para este nicho. Tente outro termo ou local.");
      } else {
        setLeads(prev => append ? [...prev, ...newLeads] : newLeads);
        setSources(prev => append ? [...prev, ...newSources] : newSources);
        
        if (!append && resultsRef.current) {
          setTimeout(() => {
            resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        }
      }

    } catch (err: any) {
      console.error(err);
      setError("Falha ao buscar leads. A internet é vasta, mas às vezes difícil de navegar. Tente novamente.");
    } finally {
      stopProgressSimulation();
      // Small delay to let user see 100% before resetting button state
      setTimeout(() => {
        setIsSearching(false);
      }, 500);
    }
  };

  const handleLoadMore = () => {
    if (searchParams) {
      handleSearch(searchParams.niche, searchParams.location, searchParams.size, searchParams.count, true);
    }
  };

  const toggleSaveLead = (lead: Lead) => {
    setSavedLeads(prev => {
      const exists = prev.find(l => l.id === lead.id);
      if (exists) {
        return prev.filter(l => l.id !== lead.id);
      } else {
        return [...prev, lead];
      }
    });
  };

  const exportCSV = () => {
    const listToExport = activeTab === 'search' ? leads : savedLeads;
    if (listToExport.length === 0) return;
    
    const headers = ['Nome', 'Telefone', 'Instagram', 'Site', 'Descrição'];
    const csvContent = [
      headers.join(','),
      ...listToExport.map(lead => [
        `"${lead.name}"`,
        `"${lead.phone}"`,
        `"${lead.instagram || ''}"`,
        `"${lead.website || ''}"`,
        `"${lead.description.replace(/"/g, '""')}"`
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
              Lista de Disparo
              {savedLeads.length > 0 && (
                <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                  {savedLeads.length}
                </span>
              )}
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
          </div>
        </div>

        {/* Main Content Area */}
        <div className="min-h-[500px]">
          {activeTab === 'search' && (
            <>
              {/* Search */}
              <SearchInterface 
                onSearch={(n, l, s, c) => handleSearch(n, l, s, c, false)} 
                isLoading={isSearching} 
                progress={progress}
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
                <div ref={resultsRef} className="max-w-7xl mx-auto">
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
            />
          )}

          {activeTab === 'config' && (
            <ServiceConfig 
              initialContext={serviceContext}
              onSave={setServiceContext}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
