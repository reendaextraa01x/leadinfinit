
import React, { useState } from 'react';
import { Lead, ServiceContext, LeadStatus, ObjectionType, ChatAnalysis } from '../types';
import { WhatsAppIcon, TrashIcon, MagicIcon, CheckIcon, ColumnsIcon, FireIcon, DocumentReportIcon, ArrowRightIcon, ShieldIcon, CalculatorIcon, MicroscopeIcon, XIcon, LightBulbIcon, SearchIcon } from './ui/Icons';
import { generateMarketingCopy, generateLeadAudit, handleObjection, calculateInactionCost, analyzeChatHistory } from '../services/geminiService';

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
  isHandlingObjection: boolean;
  isCalculatingROI: boolean;
  showTools: boolean; // Toggle for extra sales tools
}

const BatchSender: React.FC<BatchSenderProps> = ({ savedLeads, serviceContext, onRemove, onClear, onUpdateLead }) => {
  const [leadStates, setLeadStates] = useState<Record<string, LeadWithStatus>>({});
  const [useDesktopApp, setUseDesktopApp] = useState(false);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [isBulkAuditing, setIsBulkAuditing] = useState(false);
  
  // CHAT ANALYSIS STATE
  const [analysisModal, setAnalysisModal] = useState<{
      isOpen: boolean;
      leadName: string;
      text: string;
      result: ChatAnalysis | null;
      isAnalyzing: boolean;
  }>({
      isOpen: false,
      leadName: '',
      text: '',
      result: null,
      isAnalyzing: false
  });

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
          isGeneratingAudit: false,
          isHandlingObjection: false,
          isCalculatingROI: false,
          showTools: false
        };
        hasChanges = true;
      }
    });

    if (hasChanges) setLeadStates(newStates);
  }, [savedLeads, serviceContext]);

  // EMPTY STATE HANDLER
  if (savedLeads.length === 0) {
      return (
          <div className="max-w-4xl mx-auto mt-20 text-center animate-fade-in px-4">
              <div className="bg-surface border border-slate-800 rounded-2xl p-12 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-[-50%] left-[-10%] w-[150%] h-[150%] bg-gradient-to-b from-blue-900/10 via-transparent to-transparent pointer-events-none rounded-full blur-3xl"></div>
                  
                  <ColumnsIcon className="w-24 h-24 text-slate-700 mx-auto mb-6" />
                  <h2 className="text-3xl font-black text-white mb-4">O Pipeline está vazio!</h2>
                  <p className="text-slate-400 text-lg max-w-xl mx-auto mb-8">
                      Para começar a vender, você precisa alimentar a máquina. Vá ao Buscador e encontre seus primeiros alvos.
                  </p>
                  
                  <button 
                    onClick={() => document.getElementById('tab-search-trigger')?.click()} // Hack simples para navegação via DOM ou user action
                    className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-primary to-accent hover:from-primaryHover hover:to-cyan-400 text-white font-bold rounded-xl shadow-lg hover:shadow-cyan-500/25 transition-all transform hover:-translate-y-1"
                  >
                      <SearchIcon className="w-5 h-5 mr-2" />
                      IR PARA O RADAR DE BUSCA
                  </button>
              </div>
          </div>
      );
  }

  const handleGenerateAllMessages = async () => {
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

  const handleGenerateAllAudits = async () => {
      setIsBulkAuditing(true);
      // Filtra leads novos que AINDA NÃO têm auditoria
      const leadsToProcess = savedLeads.filter(l => l.status === 'new' && !l.audit);

      for (const lead of leadsToProcess) {
          setLeadStates(prev => ({...prev, [lead.id]: { ...prev[lead.id], isGeneratingAudit: true }}));
          try {
              const audit = await generateLeadAudit(lead, serviceContext);
              onUpdateLead({ ...lead, audit: audit });
          } catch (e) {
              console.error(e);
          } finally {
              setLeadStates(prev => ({...prev, [lead.id]: { ...prev[lead.id], isGeneratingAudit: false }}));
          }
      }
      setIsBulkAuditing(false);
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

  const handleAiObjection = async (lead: Lead, type: ObjectionType) => {
      setLeadStates(prev => ({...prev, [lead.id]: { ...prev[lead.id], isHandlingObjection: true }}));
      try {
          const rebuttal = await handleObjection(lead.name, type, serviceContext);
          setLeadStates(prev => ({...prev, [lead.id]: { ...prev[lead.id], message: rebuttal }}));
      } catch (e) {
          console.error(e);
      } finally {
          setLeadStates(prev => ({...prev, [lead.id]: { ...prev[lead.id], isHandlingObjection: false }}));
      }
  };

  const handleROICalculation = async (lead: Lead) => {
      setLeadStates(prev => ({...prev, [lead.id]: { ...prev[lead.id], isCalculatingROI: true }}));
      try {
          const calculation = await calculateInactionCost(lead, serviceContext);
          setLeadStates(prev => ({...prev, [lead.id]: { ...prev[lead.id], message: calculation }}));
      } catch (e) {
          console.error(e);
      } finally {
          setLeadStates(prev => ({...prev, [lead.id]: { ...prev[lead.id], isCalculatingROI: false }}));
      }
  };

  const openAnalysisModal = (leadName: string) => {
      setAnalysisModal({
          isOpen: true,
          leadName,
          text: '',
          result: null,
          isAnalyzing: false
      });
  };

  const handleRunAnalysis = async () => {
      if(!analysisModal.text.trim()) return;
      setAnalysisModal(prev => ({ ...prev, isAnalyzing: true }));
      try {
          const result = await analyzeChatHistory(analysisModal.text, serviceContext);
          setAnalysisModal(prev => ({ ...prev, result }));
      } catch (e) {
          console.error(e);
      } finally {
          setAnalysisModal(prev => ({ ...prev, isAnalyzing: false }));
      }
  };

  const toggleTools = (id: string) => {
      setLeadStates(prev => ({...prev, [id]: { ...prev[id], showTools: !prev[id].showTools }}));
  }

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
    <div className="max-w-[1600px] mx-auto animate-fade-in pb-20 px-4 relative">
      
      {/* CHAT ANALYSIS MODAL */}
      {analysisModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-surface border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center p-4 border-b border-slate-700">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                          <MicroscopeIcon className="w-6 h-6 text-accent" />
                          Autópsia da Negociação: {analysisModal.leadName}
                      </h3>
                      <button onClick={() => setAnalysisModal(prev => ({ ...prev, isOpen: false }))} className="text-slate-500 hover:text-white">
                          <XIcon className="w-6 h-6" />
                      </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-1">
                      {!analysisModal.result ? (
                          <>
                              <p className="text-sm text-slate-400 mb-4">
                                  Copie a conversa inteira do WhatsApp (Ctrl+A, Ctrl+C) e cole aqui. A IA vai ler as entrelinhas e dizer como fechar a venda.
                              </p>
                              <textarea 
                                  value={analysisModal.text}
                                  onChange={(e) => setAnalysisModal(prev => ({ ...prev, text: e.target.value }))}
                                  placeholder="Cole o histórico da conversa aqui..."
                                  className="w-full h-64 bg-slate-900 border border-slate-800 rounded-lg p-4 text-xs font-mono text-slate-300 focus:border-accent focus:outline-none resize-none"
                              />
                              <div className="mt-4 flex justify-end">
                                  <button 
                                      onClick={handleRunAnalysis}
                                      disabled={analysisModal.isAnalyzing || !analysisModal.text}
                                      className="bg-accent hover:bg-cyan-400 text-surface font-bold py-3 px-6 rounded-lg flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
                                  >
                                      {analysisModal.isAnalyzing ? (
                                          <>Analizando Padrões...</>
                                      ) : (
                                          <>
                                              <MicroscopeIcon className="w-5 h-5" />
                                              Analisar Conversa
                                          </>
                                      )}
                                  </button>
                              </div>
                          </>
                      ) : (
                          <div className="space-y-6 animate-fade-in">
                              {/* SCORE */}
                              <div className="flex items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                                  <div className={`text-4xl font-black ${analysisModal.result.score > 70 ? 'text-green-500' : analysisModal.result.score > 40 ? 'text-yellow-500' : 'text-red-500'}`}>
                                      {analysisModal.result.score}%
                                  </div>
                                  <div>
                                      <p className="text-xs font-bold uppercase text-slate-500">Probabilidade de Fechamento</p>
                                      <p className="text-sm text-white">{analysisModal.result.sentiment === 'positive' ? 'Cliente Interessado' : analysisModal.result.sentiment === 'negative' ? 'Cliente Resistente' : 'Cliente Indeciso'}</p>
                                  </div>
                              </div>

                              {/* HIDDEN INTENT */}
                              <div className="bg-purple-900/20 border border-purple-500/30 p-4 rounded-xl">
                                  <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                      <MagicIcon className="w-4 h-4" /> Intenção Oculta
                                  </h4>
                                  <p className="text-white text-sm italic">"{analysisModal.result.hiddenIntent}"</p>
                              </div>

                              {/* NEXT MOVE */}
                              <div className="bg-green-900/20 border border-green-500/30 p-4 rounded-xl">
                                  <h4 className="text-xs font-bold text-green-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                      <LightBulbIcon className="w-4 h-4" /> Próximo Movimento Perfeito
                                  </h4>
                                  <div className="bg-slate-950 p-3 rounded border border-green-500/20 text-green-100 font-mono text-sm">
                                      {analysisModal.result.nextMove}
                                  </div>
                                  <p className="text-xs text-slate-500 mt-2">💡 Dica Estratégica: {analysisModal.result.tip}</p>
                              </div>

                              <button 
                                  onClick={() => setAnalysisModal(prev => ({ ...prev, result: null }))}
                                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-bold"
                              >
                                  Nova Análise
                              </button>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

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
        <div className="flex flex-wrap gap-3">
             <button
               onClick={() => setUseDesktopApp(!useDesktopApp)}
               className={`px-3 py-2 rounded-md text-xs font-bold transition-all border ${useDesktopApp ? 'bg-green-600 border-green-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
             >
               Modo: {useDesktopApp ? 'App Desktop ⚡' : 'Web (Aba Única)'}
             </button>
             
             {/* BULK AUDIT BUTTON */}
             <button 
                onClick={handleGenerateAllAudits} 
                disabled={isBulkAuditing} 
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold text-sm flex items-center shadow-lg disabled:opacity-50 disabled:cursor-wait"
            >
                <DocumentReportIcon className={`w-4 h-4 mr-2 ${isBulkAuditing ? 'animate-spin' : ''}`} />
                {isBulkAuditing ? 'Analisando...' : 'Gerar Auditorias em Massa'}
             </button>

             {/* BULK COPY BUTTON */}
             <button 
                onClick={handleGenerateAllMessages} 
                disabled={isBulkGenerating} 
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold text-sm flex items-center shadow-lg disabled:opacity-50 disabled:cursor-wait"
            >
                <MagicIcon className={`w-4 h-4 mr-2 ${isBulkGenerating ? 'animate-spin' : ''}`} />
                {isBulkGenerating ? 'Escrevendo...' : 'Gerar Copys em Massa'}
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
                                <div key={lead.id} className="bg-surface border border-slate-800 rounded-lg p-4 shadow-sm hover:border-slate-600 transition-all group relative">
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

                                    {/* Audit Section - The Secret Weapon (New Leads Only) */}
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

                                    {/* SALES TOOLS TOGGLE (Negotiation Phase) */}
                                    {col.id !== 'new' && col.id !== 'closed' && (
                                        <div className="mb-2">
                                            <button 
                                                onClick={() => toggleTools(lead.id)}
                                                className="w-full py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-400 flex items-center justify-center gap-1 rounded border border-slate-700"
                                            >
                                                <ShieldIcon className="w-3 h-3" />
                                                {state.showTools ? 'Ocultar Ferramentas' : 'Ferramentas de Fechamento'}
                                            </button>

                                            {state.showTools && (
                                                <div className="mt-2 p-2 bg-slate-900 rounded border border-slate-800 animate-fade-in">
                                                    
                                                    {/* NEW: ANALYSIS BUTTON */}
                                                    <button 
                                                        onClick={() => openAnalysisModal(lead.name)}
                                                        className="w-full py-1.5 mb-2 bg-accent/10 hover:bg-accent/20 text-accent text-[10px] font-bold rounded border border-accent/20 flex items-center justify-center gap-1 transition-colors"
                                                    >
                                                        <MicroscopeIcon className="w-3 h-3" />
                                                        Analisar Conversa Real
                                                    </button>

                                                    <div className="border-t border-slate-800 my-2"></div>

                                                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Quebrador de Objeções (IA)</p>
                                                    <div className="grid grid-cols-2 gap-1 mb-3">
                                                        <button disabled={state.isHandlingObjection} onClick={() => handleAiObjection(lead, 'expensive')} className="p-1 bg-slate-800 hover:bg-slate-700 text-[10px] rounded border border-slate-700">💸 "Tá Caro"</button>
                                                        <button disabled={state.isHandlingObjection} onClick={() => handleAiObjection(lead, 'partner')} className="p-1 bg-slate-800 hover:bg-slate-700 text-[10px] rounded border border-slate-700">🤝 "Ver com Sócio"</button>
                                                        <button disabled={state.isHandlingObjection} onClick={() => handleAiObjection(lead, 'has_agency')} className="p-1 bg-slate-800 hover:bg-slate-700 text-[10px] rounded border border-slate-700">🏢 "Já tenho Agência"</button>
                                                        <button disabled={state.isHandlingObjection} onClick={() => handleAiObjection(lead, 'send_info')} className="p-1 bg-slate-800 hover:bg-slate-700 text-[10px] rounded border border-slate-700">📄 "Manda PDF"</button>
                                                    </div>
                                                    
                                                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-2 mt-2">Calculadora de Medo</p>
                                                    <button 
                                                        disabled={state.isCalculatingROI}
                                                        onClick={() => handleROICalculation(lead)}
                                                        className="w-full py-1 bg-red-900/20 hover:bg-red-900/40 text-red-300 text-[10px] rounded border border-red-900/30 flex items-center justify-center gap-1"
                                                    >
                                                        <CalculatorIcon className="w-3 h-3" />
                                                        Gerar Cálculo de Prejuízo (ROI)
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Message Area */}
                                    <textarea 
                                        value={state.message}
                                        onChange={(e) => setLeadStates(prev => ({...prev, [lead.id]: { ...prev[lead.id], message: e.target.value }}))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-300 resize-none h-24 mb-2 focus:border-accent focus:outline-none font-sans leading-relaxed"
                                        placeholder="Escreva sua mensagem aqui..."
                                    />

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleSend(lead, state.message)}
                                            className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-2 rounded flex items-center justify-center shadow-lg transition-transform active:scale-95"
                                        >
                                            <WhatsAppIcon className="w-3 h-3 mr-1" />
                                            {col.id === 'new' ? 'Disparar' : 'Enviar'}
                                        </button>
                                        
                                        {/* Move Next Button */}
                                        {col.id !== 'closed' && (
                                            <button 
                                                onClick={() => {
                                                    const next = col.id === 'new' ? 'contacted' : col.id === 'contacted' ? 'negotiation' : 'closed';
                                                    moveStage(lead, next);
                                                }}
                                                className="px-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded border border-slate-700 hover:text-white"
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
