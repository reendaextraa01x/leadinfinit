
import React, { useState } from 'react';
import { Lead, ServiceContext } from '../types';
import { WhatsAppIcon, TrashIcon, MagicIcon, CheckIcon } from './ui/Icons';
import { generateMarketingCopy } from '../services/geminiService';

interface BatchSenderProps {
  savedLeads: Lead[];
  serviceContext: ServiceContext;
  onRemove: (id: string) => void;
  onClear: () => void;
}

const cleanPhone = (phone: string): string | null => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 8) return null;
  if (cleaned.length === 10 || cleaned.length === 11) {
    return `55${cleaned}`;
  }
  return cleaned;
};

// Local state to track messages per lead
interface LeadWithStatus {
  id: string;
  message: string;
  isGenerating: boolean;
  status: 'pending' | 'sent';
}

const BatchSender: React.FC<BatchSenderProps> = ({ savedLeads, serviceContext, onRemove, onClear }) => {
  const [leadStates, setLeadStates] = useState<Record<string, LeadWithStatus>>({});
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [useDesktopApp, setUseDesktopApp] = useState(false); // Toggle for Protocol Handler

  // Initialize state for new leads
  React.useEffect(() => {
    const newStates = { ...leadStates };
    let hasChanges = false;
    
    savedLeads.forEach(lead => {
      if (!newStates[lead.id]) {
        // Default generic message if AI hasn't run yet
        const defaultMsg = serviceContext.serviceName 
          ? `Opa ${lead.name}, vi o perfil de vocês e percebi algo que está custando clientes. Posso comentar?`
          : `Olá ${lead.name}, gostaria de apresentar uma oportunidade.`;
        
        newStates[lead.id] = {
          id: lead.id,
          message: defaultMsg,
          isGenerating: false,
          status: 'pending'
        };
        hasChanges = true;
      }
    });

    if (hasChanges) {
      setLeadStates(newStates);
    }
  }, [savedLeads, serviceContext]);

  const handleGenerateAll = async () => {
    setIsBulkGenerating(true);
    
    const newStates = { ...leadStates };
    
    for (const lead of savedLeads) {
      if (!cleanPhone(lead.phone)) continue; // Skip invalid phones

      // Update UI to show "Generating"
      setLeadStates(prev => ({
        ...prev,
        [lead.id]: { ...prev[lead.id], isGenerating: true }
      }));

      try {
        const personalizedCopy = await generateMarketingCopy(lead, serviceContext);
        setLeadStates(prev => ({
          ...prev,
          [lead.id]: { 
            ...prev[lead.id], 
            message: personalizedCopy,
            isGenerating: false 
          }
        }));
      } catch (e) {
        console.error("Error generating for " + lead.name);
        setLeadStates(prev => ({
          ...prev,
          [lead.id]: { ...prev[lead.id], isGenerating: false }
        }));
      }
    }
    
    setIsBulkGenerating(false);
  };

  const handleSend = (id: string, phone: string, message: string) => {
    const waNumber = cleanPhone(phone);
    if (!waNumber) return;

    // Mark as sent in UI
    setLeadStates(prev => ({
      ...prev,
      [id]: { ...prev[id], status: 'sent' }
    }));

    const encodedMessage = encodeURIComponent(message);

    if (useDesktopApp) {
      // "Turbo Mode" - Opens installed Desktop App directly
      window.location.href = `whatsapp://send?phone=${waNumber}&text=${encodedMessage}`;
    } else {
      // "Optimized Web Mode" - Opens in a SPECIFIC named window to reuse the same tab
      // Uses web.whatsapp.com directly to skip the landing page
      window.open(
        `https://web.whatsapp.com/send?phone=${waNumber}&text=${encodedMessage}`, 
        'LeadInfinitWhatsAppSession' // This name forces browser to reuse the tab
      );
    }
  };

  const updateMessage = (id: string, text: string) => {
    setLeadStates(prev => ({
      ...prev,
      [id]: { ...prev[id], message: text }
    }));
  };

  const validLeadsCount = savedLeads.filter(l => cleanPhone(l.phone) !== null).length;

  return (
    <div className="max-w-7xl mx-auto animate-fade-in pb-20">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center">
            <WhatsAppIcon className="w-8 h-8 mr-3 text-green-500" />
            CRM de Disparo
          </h2>
          <p className="text-slate-400 mt-1">
            Gere mensagens <span className="text-accent font-bold">extremamente persuasivas</span> e envie em segundos.
          </p>
        </div>

        <div className="flex gap-3">
           <button
             onClick={onClear}
             className="px-4 py-2 text-slate-400 border border-slate-700 rounded-lg hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-colors flex items-center text-sm"
           >
             <TrashIcon className="w-4 h-4 mr-2" />
             Limpar Lista
           </button>
           
           <button
             onClick={handleGenerateAll}
             disabled={isBulkGenerating || validLeadsCount === 0}
             className={`px-6 py-3 rounded-lg font-bold text-white flex items-center transition-all shadow-lg
               ${isBulkGenerating 
                 ? 'bg-slate-700 cursor-wait' 
                 : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-purple-500/30 hover:scale-[1.02]'
               }
             `}
           >
             <MagicIcon className={`w-5 h-5 mr-2 ${isBulkGenerating ? 'animate-spin' : ''}`} />
             {isBulkGenerating ? 'Criando Variações...' : 'Gerar Copys Extremas (IA)'}
           </button>
        </div>
      </div>

      {/* Sending Mode Toggle & Stats */}
      <div className="mb-8">
        <div className="bg-surface border border-slate-800 p-6 rounded-xl flex flex-col md:flex-row items-center justify-between gap-6">
          
          {/* Stats */}
          <div className="flex gap-8">
             <div className="text-center md:text-left">
                <span className="text-slate-500 text-xs uppercase font-bold">Fila de Disparo</span>
                <div className="text-2xl font-bold text-white">{savedLeads.length} leads</div>
             </div>
             <div className="text-center md:text-left">
                <span className="text-slate-500 text-xs uppercase font-bold">Válidos (Zap)</span>
                <div className="text-2xl font-bold text-green-400">{validLeadsCount}</div>
             </div>
          </div>

          {/* Mode Switcher */}
          <div className="bg-slate-900/50 p-1.5 rounded-lg flex items-center border border-slate-700">
             <button
               onClick={() => setUseDesktopApp(false)}
               className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${!useDesktopApp ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
             >
               WhatsApp Web
               <span className="block text-[9px] opacity-60">Aba Única (Recomendado)</span>
             </button>
             <button
               onClick={() => setUseDesktopApp(true)}
               className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${useDesktopApp ? 'bg-green-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
             >
               App Desktop
               <span className="block text-[9px] opacity-80 font-bold">⚡ Ultra Rápido</span>
             </button>
          </div>

        </div>
        <p className="text-xs text-slate-500 mt-2 text-right pr-2">
          {useDesktopApp 
             ? "O modo 'App Desktop' abre o aplicativo instalado no seu PC instantaneamente." 
             : "O modo 'Web' reutiliza a mesma aba do navegador para não travar seu computador."}
        </p>
      </div>

      {/* Leads List CRM Style */}
      <div className="space-y-4">
        {savedLeads.length === 0 ? (
           <div className="text-center py-20 bg-surface border border-slate-800 rounded-xl border-dashed">
             <p className="text-slate-500">Nenhum lead selecionado. Volte para a busca e salve alguns contatos.</p>
           </div>
        ) : (
          savedLeads.map((lead) => {
            const state = leadStates[lead.id];
            const hasValidPhone = cleanPhone(lead.phone) !== null;
            if (!state) return null;

            return (
              <div 
                key={lead.id} 
                className={`
                  relative bg-surface border rounded-xl p-6 transition-all group
                  ${state.status === 'sent' ? 'border-green-500/30 bg-green-900/5 opacity-75' : 'border-slate-800 hover:border-slate-700'}
                `}
              >
                {state.status === 'sent' && (
                  <div className="absolute top-4 right-4 flex items-center text-green-500 text-xs font-bold bg-green-500/10 px-2 py-1 rounded-full z-10">
                    <CheckIcon className="w-3 h-3 mr-1" />
                    Enviado
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Lead Info (Col 3) */}
                  <div className="lg:col-span-3">
                    <h3 className="font-bold text-white text-lg mb-1">{lead.name}</h3>
                    <div className="flex items-center text-slate-400 text-sm mb-2">
                       <span className={`font-mono ${hasValidPhone ? 'text-green-400' : 'text-red-400'}`}>
                         {lead.phone}
                       </span>
                    </div>
                    <p className="text-xs text-slate-500 mb-3 line-clamp-3 bg-slate-900/50 p-2 rounded">
                      {lead.description}
                    </p>
                    <button 
                      onClick={() => onRemove(lead.id)}
                      className="text-xs text-red-400 hover:text-red-300 flex items-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <TrashIcon className="w-3 h-3 mr-1" /> Remover
                    </button>
                  </div>

                  {/* Message Editor (Col 7) */}
                  <div className="lg:col-span-7">
                    <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1 block flex justify-between items-center">
                      <span>Mensagem Persuasiva (Editável)</span>
                      {state.isGenerating && <span className="text-accent animate-pulse">A IA está criando...</span>}
                    </label>
                    <div className="relative">
                      <textarea
                        value={state.message}
                        onChange={(e) => updateMessage(lead.id, e.target.value)}
                        disabled={state.isGenerating}
                        className={`
                          w-full h-32 bg-slate-900 border rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:border-accent resize-none transition-colors
                          ${state.isGenerating ? 'opacity-50' : ''}
                          ${state.status === 'sent' ? 'border-green-900/50 text-slate-500' : 'border-slate-700'}
                        `}
                      />
                      {/* Magic Button for Individual Regen */}
                      <button
                        onClick={async () => {
                           setLeadStates(prev => ({ ...prev, [lead.id]: { ...prev[lead.id], isGenerating: true } }));
                           const copy = await generateMarketingCopy(lead, serviceContext);
                           setLeadStates(prev => ({ ...prev, [lead.id]: { ...prev[lead.id], message: copy, isGenerating: false } }));
                        }}
                        className="absolute bottom-2 right-2 flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-md text-accent text-xs font-bold transition-colors shadow-lg"
                        title="Tentar outra abordagem (Gera uma nova variação)"
                      >
                        <MagicIcon className="w-3 h-3" />
                        Nova Variação
                      </button>
                    </div>
                  </div>

                  {/* Actions (Col 2) */}
                  <div className="lg:col-span-2 flex flex-col justify-center gap-3">
                    {hasValidPhone ? (
                       <button
                         onClick={() => handleSend(lead.id, lead.phone, state.message)}
                         className={`
                           w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center transition-all shadow-lg transform active:scale-95
                           ${state.status === 'sent' 
                             ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700' 
                             : 'bg-green-600 text-white hover:bg-green-500 shadow-green-900/20'
                           }
                         `}
                       >
                         <WhatsAppIcon className="w-4 h-4 mr-2" />
                         {state.status === 'sent' ? 'Reenviar' : 'Enviar Agora'}
                       </button>
                    ) : (
                      <div className="text-center p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <span className="text-xs text-red-400 font-bold">Sem Zap</span>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};

export default BatchSender;
