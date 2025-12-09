
import React, { useState, useEffect } from 'react';
import { SearchIcon, HistoryIcon, TrashIcon, FilterIcon, TargetIcon, MagicIcon } from './ui/Icons';
import { BusinessSize, SearchHistoryItem, SearchFilters, ServiceContext } from '../types';
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
  "Estética e Beleza", 
  "Imobiliária", 
  "Fitness e Saúde", 
  "Advocacia", 
  "Odontologia", 
  "Arquitetura", 
  "E-commerce", 
  "Contabilidade", 
  "Restaurantes"
];

const SearchInterface: React.FC<SearchInterfaceProps> = ({ onSearch, isLoading, progress, history, onClearHistory, serviceContext }) => {
  const [niche, setNiche] = useState('');
  const [location, setLocation] = useState('');
  const [size, setSize] = useState<BusinessSize>('small');
  const [count, setCount] = useState<number>(6); // Default to 6
  const [loadingText, setLoadingText] = useState("Iniciando...");
  
  // FILTERS
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
      websiteRule: 'any',
      mustHaveInstagram: false,
      mobileOnly: true // Default to true as user requested quality
  });
  const [customInstruction, setCustomInstruction] = useState("");

  // TACTICAL PROMPTS
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);

  // Dynamic loading text based on progress and count
  useEffect(() => {
    if (!isLoading) return;
    
    // Feedback mais detalhado para buscas longas
    if (progress < 15) setLoadingText("Iniciando radar de busca...");
    else if (progress < 30) setLoadingText("Vasculhando o Google Maps e Redes...");
    else if (progress < 50) setLoadingText("Filtrando telefones inválidos (Modo Hunter)...");
    else if (progress < 70) setLoadingText("Buscando dados adicionais (Ciclo 2)...");
    else if (progress < 90) setLoadingText("Validando qualidade dos leads...");
    else setLoadingText("Formatando relatório final...");
  }, [progress, isLoading]);

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
  };

  const handleGeneratePrompts = async () => {
      setIsGeneratingPrompts(true);
      try {
          const prompts = await generateTacticalPrompts(serviceContext);
          setSuggestedPrompts(prompts);
          // AUTO-FILL BEST IDEA (A MELHOR IDEIA VEM PRIMEIRO)
          if (prompts.length > 0) {
              setCustomInstruction(prompts[0]);
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsGeneratingPrompts(false);
      }
  }

  // Estimativa mais realista: ~3.5s por lead + overhead de inicialização
  const estimatedSeconds = Math.ceil((count * 3.5) + 5);

  return (
    <div className="w-full max-w-4xl mx-auto mb-12 relative z-20">
      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-accent to-primary rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        
        <div className="relative flex flex-col gap-4 bg-surface border border-slate-700 rounded-xl p-4 shadow-2xl">
          
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 ml-1">Nicho</label>
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="ex: Pizzaria, Dentista..."
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:outline-none focus:border-accent transition-colors"
                disabled={isLoading}
              />
            </div>

            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 ml-1">Localização</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="ex: São Paulo, Centro..."
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:outline-none focus:border-accent transition-colors"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-4">
             
             {/* Business Size */}
             <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">Porte do Negócio</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSize('small')}
                    className={`p-2 rounded-lg text-sm font-medium border transition-all ${size === 'small' ? 'bg-accent/20 border-accent text-accent' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                  >
                    Pequeno
                    <span className="block text-[10px] opacity-60 font-normal">Ideal p/ Sites</span>
                  </button>
                  <button
                     type="button"
                    onClick={() => setSize('medium')}
                    className={`p-2 rounded-lg text-sm font-medium border transition-all ${size === 'medium' ? 'bg-accent/20 border-accent text-accent' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                  >
                    Médio
                    <span className="block text-[10px] opacity-60 font-normal">Estabelecido</span>
                  </button>
                  <button
                     type="button"
                    onClick={() => setSize('large')}
                    className={`p-2 rounded-lg text-sm font-medium border transition-all ${size === 'large' ? 'bg-accent/20 border-accent text-accent' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                  >
                    Grande
                    <span className="block text-[10px] opacity-60 font-normal">Famoso</span>
                  </button>
                </div>
             </div>

             {/* Count Slider */}
             <div className="flex-1">
                <div className="flex justify-between items-center mb-2 ml-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quantidade de Leads</label>
                    <span className="text-sm font-bold text-accent bg-accent/10 px-2 rounded">{count}</span>
                </div>
                <div className="h-[42px] flex items-center bg-slate-900/50 border border-slate-700 rounded-lg px-3">
                    <input 
                        type="range" 
                        min="3" 
                        max="20" 
                        step="1"
                        value={count} 
                        onChange={(e) => setCount(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-accent hover:accent-primary"
                    />
                </div>
                <div className="flex justify-between text-[10px] text-slate-600 px-1 mt-1">
                    <span>3</span>
                    <span>10</span>
                    <span className="text-accent font-bold">20 (Max)</span>
                </div>
             </div>

            <button
              type="submit"
              disabled={isLoading || !niche || !location}
              className={`
                h-[72px] lg:h-auto px-8 rounded-lg font-bold text-white shadow-lg flex flex-col items-center justify-center transition-all duration-300 lg:w-auto w-full lg:min-w-[200px] overflow-hidden relative
                ${isLoading 
                  ? 'bg-slate-800 border border-slate-700 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-primary to-accent hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:scale-[1.02] active:scale-[0.98]'
                }
              `}
            >
              {isLoading ? (
                <div className="w-full">
                  {/* Progress Bar Background */}
                  <div className="absolute inset-0 bg-slate-800 z-0"></div>
                  {/* Progress Bar Fill */}
                  <div 
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/20 to-accent/20 z-0 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  ></div>
                   <div 
                    className="absolute bottom-0 left-0 h-1 bg-accent z-10 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  ></div>

                  <div className="relative z-20 flex flex-col items-center justify-center w-full">
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs text-accent font-mono animate-pulse">{loadingText}</span>
                      <span className="text-xs font-bold text-white">{Math.round(progress)}%</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Aguarde: ~{estimatedSeconds}s (Alta Qualidade)
                    </span>
                  </div>
                </div>
              ) : (
                <span className="flex items-center">
                  <SearchIcon className="w-5 h-5 mr-2" />
                  Buscar Leads
                </span>
              )}
            </button>
          </div>

          {/* ADVANCED FILTERS TOGGLE */}
          <div className="border-t border-slate-800 mt-2 pt-2">
            <button 
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center text-xs text-slate-400 hover:text-white transition-colors"
            >
                <FilterIcon className="w-4 h-4 mr-1" />
                {showFilters ? "Ocultar Filtros Sniper" : "Mostrar Filtros Sniper (Controle de Qualidade)"}
            </button>

            {showFilters && (
                <div className="mt-4 animate-fade-in space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                        {/* Website Rule */}
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Filtro de Site</label>
                            <select 
                                value={filters.websiteRule}
                                onChange={(e) => setFilters({...filters, websiteRule: e.target.value as any})}
                                className="w-full bg-slate-800 text-white text-xs p-2 rounded border border-slate-700 focus:outline-none"
                            >
                                <option value="any">Indiferente</option>
                                <option value="must_not_have">NÃO pode ter Site (Oportunidade)</option>
                                <option value="must_have">DEVE ter Site (Melhoria/SEO)</option>
                            </select>
                        </div>
                        {/* Instagram Rule */}
                        <div className="flex items-center">
                             <label className="flex items-center cursor-pointer">
                                 <input 
                                    type="checkbox" 
                                    checked={filters.mustHaveInstagram}
                                    onChange={(e) => setFilters({...filters, mustHaveInstagram: e.target.checked})}
                                    className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-accent focus:ring-0 focus:ring-offset-0"
                                 />
                                 <span className="ml-2 text-xs text-slate-300">Exigir Instagram Ativo</span>
                             </label>
                        </div>
                         {/* Phone Rule */}
                         <div className="flex items-center">
                             <label className="flex items-center cursor-pointer">
                                 <input 
                                    type="checkbox" 
                                    checked={filters.mobileOnly}
                                    onChange={(e) => setFilters({...filters, mobileOnly: e.target.checked})}
                                    className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-accent focus:ring-0 focus:ring-offset-0"
                                 />
                                 <span className="ml-2 text-xs text-slate-300">Apenas Celular/WhatsApp (Ignorar Fixo)</span>
                             </label>
                        </div>
                    </div>

                    {/* LASER SCOPE (CUSTOM PROMPT) */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                             <label className="flex items-center text-[10px] font-bold text-red-400 uppercase tracking-wider">
                                <TargetIcon className="w-3 h-3 mr-1" />
                                MIRA LASER (Instrução Personalizada)
                            </label>
                            <button
                                type="button"
                                onClick={handleGeneratePrompts}
                                disabled={isGeneratingPrompts}
                                className="text-[10px] flex items-center gap-1 text-accent hover:text-white transition-colors bg-accent/10 px-2 py-1 rounded border border-accent/20"
                            >
                                <MagicIcon className={`w-3 h-3 ${isGeneratingPrompts ? 'animate-spin' : ''}`} />
                                {isGeneratingPrompts ? "Gerando Tática..." : "✨ Gerar Ideias de Busca"}
                            </button>
                        </div>
                        
                        {/* SUGGESTED PROMPTS CHIPS */}
                        {suggestedPrompts.length > 0 && (
                            <div className="flex flex-col gap-2 mb-3 animate-fade-in bg-slate-900/30 p-2 rounded border border-slate-800">
                                <span className="text-[9px] text-slate-500 uppercase font-bold">Sugestões Táticas (Clique para trocar):</span>
                                <div className="flex flex-wrap gap-2">
                                    {suggestedPrompts.map((prompt, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setCustomInstruction(prompt)}
                                            className={`text-[10px] px-2 py-1 rounded border transition-colors text-left
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
                            placeholder="Dê uma ordem específica para a IA. Ex: 'Apenas clínicas de estética que fazem harmonização facial' ou 'Restaurantes com nota menor que 4.0 no Google'."
                            className="w-full h-16 bg-red-900/10 border border-red-500/30 rounded-lg p-3 text-xs text-white placeholder-red-300/50 focus:outline-none focus:border-red-500 transition-colors resize-none"
                        />
                    </div>
                </div>
            )}
          </div>

        </div>
      </form>

      <div className="flex flex-col md:flex-row gap-8 mt-6">
          {/* Top Niches */}
          <div className="flex-1 animate-fade-in" style={{ animationDelay: '200ms' }}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 ml-1">Nichos em Alta:</p>
            <div className="flex flex-wrap gap-2">
                {TOP_NICHES.slice(0, 6).map((presetNiche) => (
                  <button
                      key={presetNiche}
                      onClick={() => setNiche(presetNiche)}
                      disabled={isLoading}
                      className={`
                        px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200
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

          {/* Recent History */}
          {history.length > 0 && (
             <div className="flex-1 animate-fade-in" style={{ animationDelay: '300ms' }}>
                 <div className="flex justify-between items-center mb-3 ml-1 pr-1">
                     <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Histórico Recente:</p>
                     <button onClick={onClearHistory} className="text-[10px] text-slate-600 hover:text-red-400 flex items-center transition-colors">
                        <TrashIcon className="w-3 h-3 mr-1" /> Limpar
                     </button>
                 </div>
                 <div className="space-y-2">
                    {history.slice(0, 3).map((item, idx) => (
                      <div 
                        key={idx}
                        onClick={() => handleHistoryClick(item)}
                        className="flex items-center justify-between p-2 bg-slate-900/40 border border-slate-800 rounded-lg hover:border-slate-600 hover:bg-slate-800 cursor-pointer transition-all group"
                      >
                         <div className="flex items-center">
                            <HistoryIcon className="w-3 h-3 text-slate-500 mr-2 group-hover:text-accent" />
                            <span className="text-xs text-slate-300 font-medium mr-2">{item.niche}</span>
                            <span className="text-[10px] text-slate-500">em {item.location}</span>
                         </div>
                         <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 border border-slate-700 capitalize">{item.size === 'small' ? 'Pequeno' : item.size === 'medium' ? 'Médio' : 'Grande'}</span>
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
