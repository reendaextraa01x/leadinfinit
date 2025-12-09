
import React, { useState } from 'react';
import { ServiceContext, ServiceInsights } from '../types';
import { SettingsIcon, SaveIcon, MoneyIcon, MagicIcon, ChartIcon, TargetIcon, LightningIcon, TrashIcon } from './ui/Icons';
import { generateServiceInsights, generateKillerDifferential } from '../services/geminiService';

interface ServiceConfigProps {
  initialContext: ServiceContext;
  onSave: (context: ServiceContext) => void;
}

const ServiceConfig: React.FC<ServiceConfigProps> = ({ initialContext, onSave }) => {
  const [context, setContext] = useState<ServiceContext>(initialContext);
  const [isSaved, setIsSaved] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingOffer, setIsGeneratingOffer] = useState(false);

  // Função principal para salvar e gerar/regenerar estratégia
  const handleSaveAndGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!context.serviceName || !context.description) {
        alert("Preencha o Nome e a Descrição do serviço.");
        return;
    }

    setIsSaved(false);
    onSave(context); // Salva o estado atual antes de gerar
    
    setIsAnalyzing(true);
    try {
        // Chama a IA (que agora tem aleatoriedade interna)
        const insights = await generateServiceInsights(context.serviceName, context.description);
        const updatedContext = { ...context, insights };
        setContext(updatedContext);
        onSave(updatedContext);
    } catch (error) {
        console.error(error);
    } finally {
        setIsAnalyzing(false);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
    }
  };

  const applySuggestion = () => {
    if (context.insights) {
        setContext(prev => ({
            ...prev,
            targetAudience: prev.insights!.recommendedNiche,
            ticketValue: prev.insights!.suggestedTicket
        }));
    }
  };

  const handleCreateKillerOffer = async () => {
      if (!context.serviceName) {
          alert("Por favor, preencha o Nome do Serviço primeiro.");
          return;
      }
      
      setIsGeneratingOffer(true);
      try {
          const killerOffer = await generateKillerDifferential(context.serviceName, context.description);
          
          // Typewriter effect simulation
          setContext(prev => ({ ...prev, description: "" }));
          let i = 0;
          const interval = setInterval(() => {
              setContext(prev => ({ ...prev, description: killerOffer.slice(0, i) }));
              i++;
              if (i > killerOffer.length) clearInterval(interval);
          }, 20); 

      } catch (e) {
          console.error(e);
      } finally {
          setIsGeneratingOffer(false);
      }
  };

  const handleClear = () => {
      if (window.confirm("Tem certeza que deseja limpar todas as informações do seu serviço?")) {
          const emptyContext: ServiceContext = {
              serviceName: '',
              description: '',
              targetAudience: '',
              ticketValue: 1500,
              insights: undefined
          };
          setContext(emptyContext);
          onSave(emptyContext);
      }
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-20">
      <div className="bg-surface border border-slate-800 rounded-xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        {/* Decorative Background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
              <div className="p-3 bg-accent/10 rounded-lg mr-4 text-accent">
                <SettingsIcon className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Configuração do Seu Serviço</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Descreva o que você vende. A IA usará isso para criar a estratégia perfeita.
                </p>
              </div>
          </div>
          <button 
            onClick={handleClear}
            className="flex items-center gap-1 text-xs font-bold text-red-400 hover:text-red-300 bg-red-900/10 hover:bg-red-900/20 px-3 py-2 rounded border border-red-900/30 transition-colors"
            title="Limpar todos os campos"
          >
              <TrashIcon className="w-4 h-4" />
              Limpar Tudo
          </button>
        </div>

        <form onSubmit={handleSaveAndGenerate} className="space-y-6 relative z-10">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">
                Nome do Serviço
              </label>
              <input
                type="text"
                value={context.serviceName}
                onChange={(e) => setContext({ ...context, serviceName: e.target.value })}
                placeholder="Ex: Criação de Sites, Tráfego Pago..."
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:outline-none focus:border-accent transition-colors"
                required
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">
                Público Alvo (Opcional)
              </label>
              <input
                type="text"
                value={context.targetAudience}
                onChange={(e) => setContext({ ...context, targetAudience: e.target.value })}
                placeholder="Ex: Pequenos negócios locais, Dentistas..."
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">
                    Valor Médio do seu Serviço (Para o Dashboard)
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-slate-500 font-bold">R$</span>
                    </div>
                    <input
                        type="number"
                        value={context.ticketValue || ''}
                        onChange={(e) => setContext({ ...context, ticketValue: parseFloat(e.target.value) })}
                        placeholder="Ex: 1500"
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 pl-10 text-white placeholder-slate-600 focus:outline-none focus:border-accent transition-colors"
                    />
                </div>
                <p className="text-[10px] text-slate-500 mt-1 ml-1">Isso ajuda a calcular seu "Potencial de Receita" no Dashboard.</p>
             </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">
                Descrição da Oferta / Diferencial
                </label>
                <button
                    type="button"
                    onClick={handleCreateKillerOffer}
                    disabled={isGeneratingOffer}
                    className="flex items-center space-x-1 text-[10px] font-bold bg-purple-600/20 text-purple-300 hover:bg-purple-600 hover:text-white px-3 py-1.5 rounded-lg border border-purple-500/30 transition-all active:scale-95 shadow-lg shadow-purple-900/20"
                    title="Cada clique gera uma oferta totalmente nova e única!"
                >
                    <LightningIcon className={`w-3 h-3 ${isGeneratingOffer ? 'animate-spin' : ''}`} />
                    <span>{isGeneratingOffer ? "Criando Mágica..." : "⚡ Criar Oferta Perfeita (Variação Infinita)"}</span>
                </button>
            </div>
            
            <textarea
              value={context.description}
              onChange={(e) => setContext({ ...context, description: e.target.value })}
              placeholder="Ex: Crio sites profissionais otimizados para o Google que aumentam as vendas..."
              className="w-full h-32 bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:outline-none focus:border-accent transition-colors resize-none font-sans leading-relaxed"
              required
            />
            <p className="text-[10px] text-slate-500 mt-1 ml-1 italic">
                Dica: Clique no botão de raio várias vezes. A IA usará diferentes gatilhos mentais (Escassez, Status, Garantia) a cada clique.
            </p>
          </div>

          <div className="flex items-center justify-end pt-4">
            <button
              type="submit"
              disabled={isAnalyzing}
              className={`
                flex items-center px-8 py-3 rounded-lg font-bold text-white shadow-lg transition-all duration-300
                ${isSaved 
                  ? 'bg-green-600 shadow-[0_0_20px_rgba(34,197,94,0.4)] scale-105' 
                  : isAnalyzing 
                    ? 'bg-purple-600 cursor-wait'
                    : 'bg-gradient-to-r from-primary to-accent hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:scale-[1.02]'
                }
              `}
            >
              {isAnalyzing ? (
                  <>
                    <MagicIcon className="w-5 h-5 mr-2 animate-spin" />
                    Gerando Estratégia Exclusiva...
                  </>
              ) : isSaved ? (
                  <>
                    <SaveIcon className="w-5 h-5 mr-2" />
                    Salvo!
                  </>
              ) : (
                  <>
                    <SaveIcon className="w-5 h-5 mr-2" />
                    Salvar e Gerar Estratégia
                  </>
              )}
            </button>
          </div>

        </form>

        {/* AI STRATEGY INSIGHTS */}
        {context.insights && (
            <div className="mt-8 border-t border-slate-800 pt-8 animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center">
                        <MagicIcon className="w-6 h-6 text-purple-400 mr-2" />
                        <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                            Consultoria Estratégica
                        </h3>
                    </div>
                    
                    <button
                        type="button"
                        onClick={() => handleSaveAndGenerate()} 
                        disabled={isAnalyzing}
                        className="text-xs flex items-center gap-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded transition-colors"
                        title="Se não gostou dessa estratégia, clique para gerar uma abordagem totalmente nova."
                    >
                        <MagicIcon className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
                        🔄 Gerar Nova Visão Estratégica
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Best Niche Card */}
                    <div className="bg-gradient-to-br from-purple-900/20 to-slate-900 border border-purple-500/30 rounded-xl p-5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 opacity-20">
                            <TargetIcon className="w-12 h-12 text-purple-500" />
                        </div>
                        <p className="text-xs text-purple-300 font-bold uppercase tracking-wider mb-1">Melhor Nicho para Atacar</p>
                        <p className="text-2xl font-bold text-white mb-3 leading-tight">{context.insights.recommendedNiche}</p>
                        <p className="text-sm text-slate-300 leading-relaxed italic border-l-2 border-purple-500/50 pl-3">
                            "{context.insights.reasoning}"
                        </p>
                    </div>

                    {/* Ticket & Potential */}
                    <div className="flex flex-col gap-4">
                        <div className="bg-gradient-to-br from-green-900/20 to-slate-900 border border-green-500/30 rounded-xl p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs text-green-400 font-bold uppercase tracking-wider mb-1">Ticket Sugerido</p>
                                <p className="text-3xl font-mono font-bold text-white">R$ {context.insights.suggestedTicket}</p>
                            </div>
                            <MoneyIcon className="w-10 h-10 text-green-500 opacity-50" />
                        </div>
                         <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Potencial de Mercado</p>
                                <p className="text-sm text-slate-300">{context.insights.potential}</p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-center">
                    <button 
                        onClick={applySuggestion}
                        className="flex items-center space-x-2 text-sm text-accent hover:text-white transition-colors bg-accent/10 hover:bg-accent/20 px-4 py-2 rounded-lg border border-accent/20"
                    >
                        <MagicIcon className="w-4 h-4" />
                        <span>Aplicar Sugestão (Definir Nicho & Ticket)</span>
                    </button>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default ServiceConfig;
