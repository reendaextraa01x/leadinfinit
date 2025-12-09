
import React, { useState } from 'react';
import { Lead, ServiceContext, LeadStatus } from '../types';
import { WhatsAppIcon, TrashIcon, MagicIcon, CheckIcon, ColumnsIcon, FireIcon, DocumentReportIcon, ArrowRightIcon } from './ui/Icons';
import { generateMarketingCopy, generateLeadAudit } from '../services/geminiService';

interface BatchSenderProps {
  savedLeads: Lead[];
  serviceContext: ServiceContext;
  onRemove: (id: string) => void;
  onClear: () => void;
  onUpdateLead: (lead: Lead) => void;
}

const cleanPhone = (phone: string): string | null => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 8) return null;
  if (cleaned.length === 10 || cleaned.length === 11) {
    return `55${cleaned}`;
  }
  return cleaned;
};

interface LeadWithStatus {
  id: string;
  message: string;
  isGeneratingMessage: boolean;
  isGeneratingAudit: boolean;
}

const BatchSender: React.FC<BatchSenderProps> = ({ savedLeads, serviceContext, onRemove, onClear, onUpdateLead }) => {
  const [leadStates, setLeadStates] = useState<Record<string, LeadWithStatus>>({});
  const [useDesktopApp, setUseDesktopApp] = useState(false);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);

  // Initialize state
  React.useEffect(() => {
    const newStates = { ...leadStates };
    let hasChanges = false;
    
    savedLeads.forEach(lead => {
      if (!newStates[lead.id]) {
        const defaultMsg = serviceContext.serviceName 
          ? `Opa ${lead.name}, vi o perfil de vocês e percebi algo que está custando clientes. Posso comentar?`
          : `Olá ${lead.name}, gostaria de apresentar uma oportunidade.`;
        
        newStates[lead.id] = {
          id: lead.id,
          message: defaultMsg,
          isGeneratingMessage: false,
          isGeneratingAudit: false
        };
        hasChanges = true;
      }
    });

    if (hasChanges) setLeadStates(newStates);
  }, [savedLeads, serviceContext]);

  const handleGenerateAll = async () => {
    setIsBulkGenerating(true);
    // Only generate for 'new' leads to save tokens/time
    const leadsToProcess = savedLeads.filter(l => l.status === 'new' && cleanPhone(l.phone));

    for (const lead of leadsToProcess) {
      setLeadStates(prev => ({...prev, [lead.id]: { ...prev[lead.id], isGeneratingMessage: true }}));
      try {
        const copy = await generateMarketingCopy(lead, serviceContext);
        setLeadStates(prev => ({...prev, [lead.id]: { ...prev[lead.id], message: copy, isGeneratingMessage: false }}));
      } catch (e) {
         setLeadStates(prev => ({...prev, [lead.id]: { ...prev[lead.id], isGeneratingMessage: false }}));
      }
    }
    setIsBulkGenerating(false);
  };

  const handleSend = (lead: Lead, message: string) => {
    const waNumber = cleanPhone(lead.phone);
    if (!waNumber) return;

    // Auto move to 'contacted'
    if (lead.status === 'new') {
        onUpdateLead({ ...lead, status: 'contacted' });
    }

    const encodedMessage = encodeURIComponent(message);
    const url = useDesktopApp 
       ? `whatsapp://send?phone=${waNumber}&text=${encodedMessage}`
       : `https://web.whatsapp.com/send?phone=${waNumber}&text=${encodedMessage}`;
    
    if (useDesktopApp) window.location.href = url;
    else window.open(url, 'LeadInfinitSession');
  };

  const generateAudit = async (lead: Lead) => {
      setLeadStates(prev => ({...prev, [lead.id]: { ...prev[lead.id], isGeneratingAudit: true }}));
      try {
          const audit = await generateLeadAudit(lead, serviceContext);
          onUpdateLead({ ...lead, audit: audit });
      } catch (e) {
          console.error(e);
      } finally {
          setLeadStates(prev => ({...prev, [lead.id]: { ...prev[lead.id], isGeneratingAudit: false }}));
      }
  };

  const moveStage = (lead: Lead, nextStage: LeadStatus) => {
      onUpdateLead({ ...lead, status: nextStage });
  };

  // Group leads by status
  const columns: { id: LeadStatus, title: string, color: string }[] = [
      { id: 'new', title: 'Novos Leads', color: 'border-slate-700' },
      { id: 'contacted', title: 'Contatados', color: 'border-blue-500/50' },
      { id: 'negotiation', title: 'Em Negociação', color: 'border-yellow-500/50' },
      { id: 'closed', title: 'Venda Fechada', color: 'border-green-500/50' },
  ];

  return (
    <div className="max-w-[1600px] mx-auto animate-fade-in pb-20 px-4">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center">
            <ColumnsIcon className="w-8 h-8 mr-3 text-accent" />
            CRM Pipeline
          </h2>
          <p className="text-slate-400 mt-1">
            Gerencie seu funil de vendas e use a <span className="text-accent font-bold">Auditoria Automática</span> para fechar mais contratos.
          </p>
        </div>
        <div className="flex gap-3">
             <button
               onClick={() => setUseDesktopApp(!useDesktopApp)}
               className={`px-3 py-2 rounded-md text-xs font-bold transition-all border ${useDesktopApp ? 'bg-green-600 border-green-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
             >
               Modo: {useDesktopApp ? 'App Desktop ⚡' : 'Web (Aba Única)'}
             </button>
             <button onClick={handleGenerateAll} disabled={isBulkGenerating} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold text-sm flex items-center shadow-lg">
                <MagicIcon className={`w-4 h-4 mr-2 ${isBulkGenerating ? 'animate-spin' : ''}`} />
                Gerar Copys em Massa
             </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex flex-col xl:flex-row gap-6 overflow-x-auto pb-4">
        {columns.map(col => {
            const leadsInCol = savedLeads.filter(l => l.status === col.id);
            
            return (
                <div key={col.id} className={`flex-1 min-w-[350px] bg-slate-900/50 border ${col.color} rounded-xl p-4 flex flex-col h-full min-h-[500px]`}>
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
                        <h3 className="font-bold text-white uppercase tracking-wider text-sm">{col.title}</h3>
                        <span className="bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded-full">{leadsInCol.length}</span>
                    </div>

                    <div className="space-y-4 flex-1">
                        {leadsInCol.length === 0 && (
                            <div className="text-center py-10 text-slate-600 text-xs italic">Nenhum lead nesta etapa</div>
                        )}
                        {leadsInCol.map(lead => {
                            const state = leadStates[lead.id];
                            if (!state) return null;
                            const isHot = lead.score === 'hot';

                            return (
                                <div key={lead.id} className="bg-surface border border-slate-800 rounded-lg p-4 shadow-sm hover:border-slate-600 transition-all group">
                                    {/* Lead Header */}
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h4 className="font-bold text-white text-sm">{lead.name}</h4>
                                            <p className="text-[10px] font-mono text-slate-500">{lead.phone}</p>
                                        </div>
                                        <div className="flex gap-1 items-center">
                                            {isHot && (
                                                <div title="Lead Quente">
                                                    <FireIcon className="w-4 h-4 text-orange-500 animate-pulse" />
                                                </div>
                                            )}
                                            <button onClick={() => onRemove(lead.id)} className="text-slate-600 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
                                        </div>
                                    </div>

                                    {/* Audit Section - The Secret Weapon */}
                                    {col.id === 'new' && (
                                        <div className="mb-3">
                                            {lead.audit ? (
                                                <div className="bg-red-500/10 border border-red-500/20 p-2 rounded text-[10px] text-red-200">
                                                    <strong className="block mb-1 flex items-center"><DocumentReportIcon className="w-3 h-3 mr-1"/> Auditoria Crítica:</strong>
                                                    <pre className="whitespace-pre-wrap font-sans">{lead.audit}</pre>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={() => generateAudit(lead)}
                                                    disabled={state.isGeneratingAudit}
                                                    className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-accent text-xs rounded border border-slate-700 border-dashed flex items-center justify-center transition-colors"
                                                >
                                                    {state.isGeneratingAudit ? 'Analisando...' : '+ Gerar Auditoria (Autoridade)'}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Message Area */}
                                    <textarea 
                                        value={state.message}
                                        onChange={(e) => setLeadStates(prev => ({...prev, [lead.id]: { ...prev[lead.id], message: e.target.value }}))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-300 resize-none h-20 mb-2 focus:border-accent focus:outline-none"
                                    />

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleSend(lead, state.message)}
                                            className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-2 rounded flex items-center justify-center shadow-lg"
                                        >
                                            <WhatsAppIcon className="w-3 h-3 mr-1" />
                                            {col.id === 'new' ? 'Disparar' : 'Conversar'}
                                        </button>
                                        
                                        {/* Move Next Button */}
                                        {col.id !== 'closed' && (
                                            <button 
                                                onClick={() => {
                                                    const next = col.id === 'new' ? 'contacted' : col.id === 'contacted' ? 'negotiation' : 'closed';
                                                    moveStage(lead, next);
                                                }}
                                                className="px-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded border border-slate-700"
                                                title="Mover para próxima etapa"
                                            >
                                                <ArrowRightIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
};

export default BatchSender;
