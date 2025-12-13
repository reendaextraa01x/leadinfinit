
import React, { useState, useEffect } from 'react';
import { SearchIcon, HistoryIcon, TrashIcon, FilterIcon, TargetIcon, MagicIcon, InstagramIcon, GlobeIcon, LightBulbIcon } from './ui/Icons';
import { BusinessSize, SearchHistoryItem, SearchFilters, ServiceContext, SearchSource } from '../types';
import { generateTacticalPrompts } from '../services/geminiService';

interface SearchInterfaceProps {
  onSearch: (niche: string, location: string, size: BusinessSize, count: number, filters: SearchFilters, customInstruction: string) => void;
  isLoading: boolean;
  progress: number;
  history: SearchHistoryItem[];
  onClearHistory: () => void;
  serviceContext: ServiceContext;
}

const TOP_NICHES = [
  "Marketing Digital", 
  "Estética", 
  "Imobiliária", 
  "Fitness", 
  "Advocacia", 
  "Odontologia", 
  "Arquitetura", 
  "Pizzaria"
];

const SearchInterface: React.FC<SearchInterfaceProps> = ({ onSearch, isLoading, progress, history, onClearHistory, serviceContext }) => {
  const [niche, setNiche] = useState('');
  const [location, setLocation] = useState('');
  const [size, setSize] = useState<BusinessSize>('small');
  const [count, setCount] = useState<number>(6); 
  const [loadingText, setLoadingText] = useState("Iniciando...");
  
  // FILTERS
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
      websiteRule: 'any',
      mustHaveInstagram: false,
      mobileOnly: true,
      searchSource: 'google_maps' // Default Source
  });
  const [customInstruction, setCustomInstruction] = useState("");

  // TACTICAL PROMPTS
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);

  // Dynamic loading text
  useEffect(() => {
    if (!isLoading) return;
    
    if (progress < 15) setLoadingText("Iniciando radar...");
    else if (progress < 30) setLoadingText(filters.searchSource === 'instagram_hunter' ? "Varrendo Instagram..." : "Varrendo Maps...");
    else if (progress < 50) setLoadingText("Filtrando telefones...");
    else if (progress < 70) setLoadingText("Buscando dados...");
    else if (progress < 90) setLoadingText("Validando leads...");
    else setLoadingText("Finalizando...");
  }, [progress, isLoading, filters.searchSource]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (niche.trim() && location.trim()) {
      onSearch(niche, location, size, count, filters, customInstruction);
    }
  };

  const handleHistoryClick = (item: SearchHistoryItem) => {
    setNiche(item.niche);
    setLocation(item.location);
    setSize(item.size);
    setFilters(prev => ({ ...prev, searchSource: item.source || 'google_maps' }));
  };

  const handleGeneratePrompts = async () => {
      setIsGeneratingPrompts(true);
      try {
          const prompts = await generateTacticalPrompts(serviceContext);
          setSuggestedPrompts(prompts);
          if (prompts.length > 0) {
              setCustomInstruction(prompts[0]);
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsGeneratingPrompts(false);
      }
  }

  return (
    <div className="w-full max-w-5xl mx-auto mb-8 relative z-20 px-1 md:px-0">
      <form onSubmit={handleSubmit} className="relative group">
        {/* Glow effect visible on medium screens and up */}
        <div className="absolute -inset-1 bg-gradient-to-r from-accent to-primary rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200 hidden md:block"></div>
        
        <div className="relative flex flex-col gap-4 bg-surface border border-slate-700 rounded-xl p-4 shadow-2xl">
          
          {/* SEARCH SOURCE SELECTOR */}
          <div className="flex flex-col items-center justify-center mb-2">
             <div className="bg-slate-900/80 p-1 rounded-lg border border-slate-700 flex w-full md:w-auto gap-1 mb-2">
                 <button
                    type="button"
                    onClick={() => setFilters({ ...filters, searchSource: 'google_maps' })}
                    className={`flex-1 md:flex-none flex items-center justify-center px-4 py-2.5 rounded-md text-xs font-bold transition-all ${filters.searchSource === 'google_maps' ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                 >
                     <GlobeIcon className="w-3.5 h-3.5 mr-2" />
                     Radar Maps
                 </button>
                 <button
                    type="button"
                    onClick={() => setFilters({ ...filters, searchSource: 'instagram_hunter' })}
                    className={`flex-1 md:flex-none flex items-center justify-center px-4 py-2.5 rounded-md text-xs font-bold transition-all ${filters.searchSource === 'instagram_hunter' ? 'bg-pink-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                 >
                     <InstagramIcon className="w-3.5 h-3.5 mr-2" />
                     Insta Hunter
                 </button>
             </div>
             
             {/* Dynamic Hint */}
             <div className={`text-[10px] px-3 py-1.5 rounded-full border flex items-center gap-2 transition-all animate-fade-in ${
                 filters.searchSource === 'google_maps' 
                 ? 'bg-blue-900/20 border-blue-500/30 text-blue-200' 
                 : 'bg-pink-900/20 border-pink-500/30 text-pink-200'
             }`}>
                 <LightBulbIcon className="w-3 h-3" />
                 {filters.searchSource === 'google_maps' ? (
                     <span>Ideal para: <strong>Clínicas, Lojas Físicas e B2B</strong>. (Dados mais confiáveis e telefones fixos/móveis)</span>
                 ) : (
                     <span>Ideal para: <strong>Estética, Moda e Marcas Digitais</strong>. (Empresas visuais e contato via Direct)</span>
                 )}
             </div>
          </div>

          {/* MAIN INPUTS - Horizontal on MD+ to match Desktop Look */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                  {filters.searchSource === 'instagram_hunter' ? 'Hashtag / Nicho' : 'Nicho de Mercado'}
              </label>
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder={filters.searchSource === 'instagram_hunter' ? "ex: #estetica, Modas..." : "ex: Pizzaria, Dentista..."}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-3 px-4 text-white placeholder-slate-600 focus:outline-none focus:border-accent transition-colors text-sm"
                disabled={isLoading}
              />
            </div>

            <div className="flex-1">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Localização Alvo</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="ex: São Paulo, Centro..."
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-3 px-4 text-white placeholder-slate-600 focus:outline-none focus:border-accent transition-colors text-sm"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* CONTROLS ROW - Horizontal on MD+ */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch">
             
             {/* Business Size */}
             <div className="flex-1">
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Porte da Empresa</label>
                <div className="grid grid-cols-3 gap-1 h-[46px]">
                  <button
                    type="button"
                    onClick={() => setSize('small')}
                    className={`rounded-lg text-[10px] sm:text-xs font-medium border transition-all flex items-center justify-center ${size === 'small' ? 'bg-accent/20 border-accent text-accent' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                  >
                    Pequeno
                  </button>
                  <button
                     type="button"
                    onClick={() => setSize('medium')}
                    className={`rounded-lg text-[10px] sm:text-xs font-medium border transition-all flex items-center justify-center ${size === 'medium' ? 'bg-accent/20 border-accent text-accent' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                  >
                    Médio
                  </button>
                  <button
                     type="button"
                    onClick={() => setSize('large')}
                    className={`rounded-lg text-[10px] sm:text-xs font-medium border transition-all flex items-center justify-center ${size === 'large' ? 'bg-accent/20 border-accent text-accent' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                  >
                    Grande
                  </button>
                </div>
             </div>

             {/* Count Slider */}
             <div className="flex-1">
                <div className="flex justify-between items-center mb-1.5 ml-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Quantidade de Leads</label>
                    <span className="text-[10px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20">{count}</span>
                </div>
                <div className="h-[46px] flex items-center bg-slate-900/50 border border-slate-700 rounded-lg px-4">
                    <input 
                        type="range" 
                        min="3" 
                        max="20" 
                        step="1"
                        value={count} 
                        onChange={(e) => setCount(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-accent"
                    />
                </div>
             </div>

             {/* Action Button - Width auto on MD+ */}
            <button
              type="submit"
              disabled={isLoading || !niche || !location}
              className={`
                h-[50px] md:h-auto px-8 rounded-lg font-bold text-white shadow-lg flex flex-col items-center justify-center transition-all duration-300 w-full md:w-auto md:min-w-[180px] overflow-hidden relative mt-2 md:mt-0
                ${isLoading 
                  ? 'bg-slate-800 border border-slate-700 cursor-not-allowed' 
                  : filters.searchSource === 'instagram_hunter' 
                    ? 'bg-gradient-to-r from-pink-600 to-purple-600 hover:shadow-[0_0_20px_rgba(219,39,119,0.4)] hover:scale-[1.02]' 
                    : 'bg-gradient-to-r from-primary to-accent hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:scale-[1.02]'
                }
              `}
            >
              {isLoading ? (
                <div className="w-full">
                  <div className="absolute inset-0 bg-slate-800 z-0"></div>
                  <div 
                    className={`absolute inset-y-0 left-0 z-0 transition-all duration-300 ease-out ${filters.searchSource === 'instagram_hunter' ? 'bg-pink-600/30' : 'bg-accent/20'}`}
                    style={{ width: `${progress}%` }}
                  ></div>
                   <div 
                    className={`absolute bottom-0 left-0 h-1 z-10 transition-all duration-300 ease-out ${filters.searchSource === 'instagram_hunter' ? 'bg-pink-500' : 'bg-accent'}`}
                    style={{ width: `${progress}%` }}
                  ></div>

                  <div className="relative z-20 flex flex-col items-center justify-center w-full">
                    <div className="flex items-center justify-between w-full mb-0.5 px-2">
                      <span className={`text-[9px] font-mono animate-pulse ${filters.searchSource === 'instagram_hunter' ? 'text-pink-400' : 'text-accent'}`}>{loadingText}</span>
                      <span className="text-[9px] font-bold text-white">{Math.round(progress)}%</span>
                    </div>
                  </div>
                </div>
              ) : (
                <span className="flex items-center text-sm uppercase tracking-wide">
                  <SearchIcon className="w-5 h-5 mr-2" />
                  {filters.searchSource === 'instagram_hunter' ? 'INICIAR HUNTER' : 'BUSCAR LEADS'}
                </span>
              )}
            </button>
          </div>

          <div className="border-t border-slate-800 mt-2 pt-3">
            <button 
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center text-[10px] text-slate-400 hover:text-white transition-colors w-full md:w-auto justify-center md:justify-start"
            >
                <FilterIcon className="w-3 h-3 mr-1.5" />
                {showFilters ? "Ocultar Filtros Avançados" : "Mostrar Filtros Avançados (Site, Instagram, Celular)"}
            </button>

            {showFilters && (
                <div className="mt-3 animate-fade-in space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                        <div>
                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Filtro de Site</label>
                            <select 
                                value={filters.websiteRule}
                                onChange={(e) => setFilters({...filters, websiteRule: e.target.value as any})}
                                className="w-full bg-slate-800 text-white text-[10px] p-2 rounded border border-slate-700 focus:outline-none focus:border-accent"
                            >
                                <option value="any">Indiferente</option>
                                <option value="must_not_have">SEM Site (Oportunidade)</option>
                                <option value="must_have">COM Site</option>
                            </select>
                        </div>
                        <div className="flex items-center">
                             <label className="flex items-center cursor-pointer p-2 rounded hover:bg-slate-800 w-full border border-transparent hover:border-slate-700 transition-all">
                                 <input 
                                    type="checkbox" 
                                    checked={filters.mustHaveInstagram}
                                    onChange={(e) => setFilters({...filters, mustHaveInstagram: e.target.checked})}
                                    className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-accent focus:ring-0 focus:ring-offset-0"
                                 />
                                 <span className="ml-2 text-[10px] text-slate-300">Exigir Instagram Detectado</span>
                             </label>
                        </div>
                         <div className="flex items-center">
                             <label className="flex items-center cursor-pointer p-2 rounded hover:bg-slate-800 w-full border border-transparent hover:border-slate-700 transition-all">
                                 <input 
                                    type="checkbox" 
                                    checked={filters.mobileOnly}
                                    onChange={(e) => setFilters({...filters, mobileOnly: e.target.checked})}
                                    className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-accent focus:ring-0 focus:ring-offset-0"
                                 />
                                 <span className="ml-2 text-[10px] text-slate-300">Apenas Celular (WhatsApp)</span>
                             </label>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                             <label className="flex items-center text-[9px] font-bold text-red-400 uppercase tracking-wider">
                                <TargetIcon className="w-3 h-3 mr-1" />
                                MIRA LASER (Instrução Específica)
                            </label>
                            <button
                                type="button"
                                onClick={handleGeneratePrompts}
                                disabled={isGeneratingPrompts}
                                className="text-[9px] flex items-center gap-1 text-accent hover:text-white transition-colors bg-accent/10 px-2 py-1 rounded border border-accent/20"
                            >
                                <MagicIcon className={`w-3 h-3 ${isGeneratingPrompts ? 'animate-spin' : ''}`} />
                                {isGeneratingPrompts ? "Gerando..." : "✨ Gerar Ideias"}
                            </button>
                        </div>
                        
                        {suggestedPrompts.length > 0 && (
                            <div className="flex flex-col gap-1 mb-2 animate-fade-in bg-slate-900/30 p-2 rounded border border-slate-800">
                                <span className="text-[9px] text-slate-500 uppercase font-bold">Sugestões:</span>
                                <div className="flex flex-wrap gap-2">
                                    {suggestedPrompts.map((prompt, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setCustomInstruction(prompt)}
                                            className={`text-[9px] px-2 py-1 rounded border transition-colors text-left truncate max-w-full
                                                ${customInstruction === prompt ? 'bg-accent/20 border-accent text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'}
                                            `}
                                        >
                                            {idx + 1}. "{prompt}"
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <textarea 
                            value={customInstruction}
                            onChange={(e) => setCustomInstruction(e.target.value)}
                            placeholder="Ex: 'Apenas clínicas que fazem harmonização facial' ou 'Pizzarias com rodízio'. Dê ordens estritas à IA."
                            className="w-full h-16 bg-red-900/5 border border-red-500/20 rounded-lg p-3 text-[10px] text-white placeholder-red-300/30 focus:outline-none focus:border-red-500/50 transition-colors resize-none"
                        />
                    </div>
                </div>
            )}
          </div>

        </div>
      </form>

      <div className="flex flex-col md:flex-row gap-6 mt-6 px-1 md:px-0">
          <div className="flex-1 animate-fade-in" style={{ animationDelay: '200ms' }}>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">Nichos Populares:</p>
            <div className="flex flex-wrap gap-2">
                {TOP_NICHES.slice(0, 8).map((presetNiche) => (
                  <button
                      key={presetNiche}
                      onClick={() => setNiche(presetNiche)}
                      disabled={isLoading}
                      className={`
                        px-3 py-1.5 rounded-full text-[10px] font-medium border transition-all duration-200
                        ${niche === presetNiche 
                          ? 'bg-accent/20 border-accent text-accent' 
                          : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 hover:bg-slate-800'
                        }
                      `}
                  >
                    {presetNiche}
                  </button>
                ))}
            </div>
          </div>
          
          {history.length > 0 && (
             <div className="flex-1 animate-fade-in" style={{ animationDelay: '300ms' }}>
                 <div className="flex justify-between items-center mb-2 ml-1 pr-1">
                     <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Histórico Recente:</p>
                     <button onClick={onClearHistory} className="text-[9px] text-slate-600 hover:text-red-400 flex items-center transition-colors">
                        <TrashIcon className="w-3 h-3 mr-1" /> Limpar
                     </button>
                 </div>
                 <div className="space-y-2">
                    {history.slice(0, 2).map((item, idx) => (
                      <div 
                        key={idx}
                        onClick={() => handleHistoryClick(item)}
                        className="flex items-center justify-between p-2.5 bg-slate-900/40 border border-slate-800 rounded-lg hover:border-slate-600 hover:bg-slate-800 cursor-pointer transition-all group"
                      >
                         <div className="flex items-center overflow-hidden">
                            {item.source === 'instagram_hunter' ? (
                                <InstagramIcon className="w-3.5 h-3.5 text-pink-500 mr-2 group-hover:text-white flex-shrink-0" />
                            ) : (
                                <HistoryIcon className="w-3.5 h-3.5 text-slate-500 mr-2 group-hover:text-accent flex-shrink-0" />
                            )}
                            <span className="text-[11px] text-slate-300 font-medium mr-1.5 truncate">{item.niche}</span>
                            <span className="text-[10px] text-slate-500 truncate">em {item.location}</span>
                         </div>
                      </div>
                    ))}
                 </div>
             </div>
          )}
      </div>
    </div>
  );
};

export default SearchInterface;
