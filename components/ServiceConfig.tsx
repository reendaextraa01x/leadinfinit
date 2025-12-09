
import React, { useState } from 'react';
import { ServiceContext } from '../types';
import { SettingsIcon, SaveIcon } from './ui/Icons';

interface ServiceConfigProps {
  initialContext: ServiceContext;
  onSave: (context: ServiceContext) => void;
}

const ServiceConfig: React.FC<ServiceConfigProps> = ({ initialContext, onSave }) => {
  const [context, setContext] = useState<ServiceContext>(initialContext);
  const [isSaved, setIsSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(context);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="bg-surface border border-slate-800 rounded-xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        {/* Decorative Background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        <div className="flex items-center mb-6">
          <div className="p-3 bg-accent/10 rounded-lg mr-4 text-accent">
            <SettingsIcon className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Configuração do Seu Serviço</h2>
            <p className="text-slate-400 text-sm mt-1">
              Descreva o que você vende. A IA usará isso para encontrar leads mais qualificados e escrever mensagens melhores.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          
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

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">
              Descrição da Oferta / Diferencial
            </label>
            <textarea
              value={context.description}
              onChange={(e) => setContext({ ...context, description: e.target.value })}
              placeholder="Ex: Crio sites profissionais otimizados para o Google que aumentam as vendas. Incluo hospedagem grátis no primeiro mês..."
              className="w-full h-32 bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:outline-none focus:border-accent transition-colors resize-none"
              required
            />
          </div>

          <div className="flex items-center justify-end pt-4">
            <button
              type="submit"
              className={`
                flex items-center px-8 py-3 rounded-lg font-bold text-white shadow-lg transition-all duration-300
                ${isSaved 
                  ? 'bg-green-600 shadow-[0_0_20px_rgba(34,197,94,0.4)] scale-105' 
                  : 'bg-gradient-to-r from-primary to-accent hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:scale-[1.02]'
                }
              `}
            >
              <SaveIcon className="w-5 h-5 mr-2" />
              {isSaved ? 'Configurações Salvas!' : 'Salvar Configuração'}
            </button>
          </div>

        </form>

        {/* Tip Box */}
        <div className="mt-8 p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg flex items-start">
            <div className="text-2xl mr-3">💡</div>
            <div>
                <h4 className="font-bold text-white text-sm mb-1">Por que preencher isso?</h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                    Quando você define seu serviço, a IA muda a estratégia de busca. Por exemplo, se você vende sites, ela irá procurar empresas que <strong>não possuem site</strong> ou têm sites ruins. Além disso, a mensagem do WhatsApp já virá pronta com argumentos de venda baseados no seu diferencial.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceConfig;
