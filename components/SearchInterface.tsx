
import React, { useState, useEffect } from 'react';
import { SearchIcon } from './ui/Icons';
import { BusinessSize } from '../types';

interface SearchInterfaceProps {
  onSearch: (niche: string, location: string, size: BusinessSize, count: number) => void;
  isLoading: boolean;
  progress: number;
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

const SearchInterface: React.FC<SearchInterfaceProps> = ({ onSearch, isLoading, progress }) => {
  const [niche, setNiche] = useState('');
  const [location, setLocation] = useState('');
  const [size, setSize] = useState<BusinessSize>('small');
  const [count, setCount] = useState<number>(6); // Default to 6
  const [loadingText, setLoadingText] = useState("Iniciando...");

  // Dynamic loading text based on progress
  useEffect(() => {
    if (!isLoading) return;
    if (progress < 20) setLoadingText("Iniciando busca...");
    else if (progress < 40) setLoadingText("Vasculhando a web...");
    else if (progress < 60) setLoadingText("Encontrando empresas...");
    else if (progress < 80) setLoadingText("Validando telefones...");
    else setLoadingText("Formatando dados...");
  }, [progress, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (niche.trim() && location.trim()) {
      onSearch(niche, location, size, count);
    }
  };

  // Estimate time: roughly 2.5s per lead requested + 2s overhead
  const estimatedTime = Math.ceil((count * 2.5) + 2);

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
                    <span>20</span>
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
                      Estimativa: ~{estimatedTime} segundos
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

        </div>
      </form>

      {/* Top Niches Quick Select */}
      <div className="mt-6 animate-fade-in" style={{ animationDelay: '200ms' }}>
         <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 ml-1">Nichos em Alta (Selecione um):</p>
         <div className="flex flex-wrap gap-2">
            {TOP_NICHES.map((presetNiche) => (
               <button
                  key={presetNiche}
                  onClick={() => setNiche(presetNiche)}
                  disabled={isLoading}
                  className={`
                    px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200
                    ${niche === presetNiche 
                      ? 'bg-accent/20 border-accent text-accent shadow-[0_0_10px_rgba(6,182,212,0.2)]' 
                      : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 hover:bg-slate-800'
                    }
                  `}
               >
                 {presetNiche}
               </button>
            ))}
         </div>
      </div>
      
    </div>
  );
};

export default SearchInterface;
