
import React, { useState, useEffect } from 'react';
import { Lead, ServiceContext } from '../types';
import { MoneyIcon, UsersIcon, ChartIcon, CheckIcon, FilterIcon, ArrowRightIcon, TargetIcon, LightningIcon } from './ui/Icons';

interface DashboardProps {
  savedLeads: Lead[];
  totalLeadsGenerated: number;
  serviceContext: ServiceContext;
  onUpdateTicketValue: (value: number) => void;
}

const SCENARIOS = {
  realistic: {
    label: "Realista (Padrão)",
    contact: 20,
    negotiation: 15,
    closing: 10,
    color: "from-slate-700 to-slate-600",
    desc: "Métricas conservadoras de cold call/mensagem fria."
  },
  good: {
    label: "Acima da Média",
    contact: 40,
    negotiation: 30,
    closing: 20,
    color: "from-blue-600 to-blue-500",
    desc: "Performance de um time de vendas treinado."
  },
  extraordinary: {
    label: "Extraordinária 🚀",
    contact: 65,
    negotiation: 50,
    closing: 35,
    color: "from-purple-600 to-pink-600",
    desc: "Domínio total de nicho e oferta irresistível."
  }
};

const Dashboard: React.FC<DashboardProps> = ({ savedLeads, totalLeadsGenerated, serviceContext, onUpdateTicketValue }) => {
  // Local state for the input to handle typing
  const [ticketInput, setTicketInput] = useState(serviceContext.ticketValue?.toString() || '1500');

  // Funnel Rates State (Defaults based on market benchmarks)
  const [contactRate, setContactRate] = useState(SCENARIOS.realistic.contact); 
  const [negotiationRate, setNegotiationRate] = useState(SCENARIOS.realistic.negotiation); 
  const [closingRate, setClosingRate] = useState(SCENARIOS.realistic.closing); 

  // Sync with prop changes
  useEffect(() => {
    setTicketInput(serviceContext.ticketValue?.toString() || '1500');
  }, [serviceContext.ticketValue]);

  const handleBlur = () => {
    let val = parseFloat(ticketInput);
    if (isNaN(val) || val < 0) val = 0;
    onUpdateTicketValue(val);
    setTicketInput(val.toString());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        (e.target as HTMLInputElement).blur();
    }
  };

  const applyScenario = (key: keyof typeof SCENARIOS) => {
      const s = SCENARIOS[key];
      setContactRate(s.contact);
      setNegotiationRate(s.negotiation);
      setClosingRate(s.closing);
  };

  const currentTicketValue = parseFloat(ticketInput) || 0;
  
  // Funnel Calculations
  const leadsCount = savedLeads.length;
  const contactsCount = Math.ceil(leadsCount * (contactRate / 100));
  const negotiationsCount = Math.ceil(contactsCount * (negotiationRate / 100));
  const salesCount = Math.ceil(negotiationsCount * (closingRate / 100));
  
  // Financials
  const grossPotential = leadsCount * currentTicketValue; // Total market cap (idealistic)
  const projectedRevenue = salesCount * currentTicketValue; // Realistic projection

  const validPhones = savedLeads.filter(l => {
     const clean = l.phone.replace(/\D/g, '');
     return clean.length >= 8;
  }).length;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Visão Geral & Estratégia</h2>
          <p className="text-slate-400">Simule seus ganhos e acompanhe o crescimento.</p>
        </div>
        
        {/* Editable Ticket Widget */}
        <div className="bg-surface border border-slate-800 rounded-xl px-5 py-3 mt-4 md:mt-0 shadow-lg flex flex-col items-end group hover:border-accent/50 transition-colors">
             <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1 flex items-center gap-1 cursor-text">
                Ticket Médio (Editável)
                <svg className="w-3 h-3 text-slate-600 group-hover:text-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
             </label>
             <div className="flex items-center">
                <span className="text-slate-500 font-bold mr-1">R$</span>
                <input 
                    type="number"
                    value={ticketInput}
                    onChange={(e) => setTicketInput(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="bg-transparent text-white font-mono font-bold text-2xl text-right focus:outline-none w-32 border-b border-transparent focus:border-accent placeholder-slate-700"
                    placeholder="0"
                />
             </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* Total Generated */}
        <div className="bg-surface border border-slate-800 rounded-xl p-6 relative overflow-hidden group hover:border-accent/30 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <ChartIcon className="w-16 h-16 text-primary" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <UsersIcon className="w-5 h-5" />
                </div>
                <h3 className="text-slate-400 text-sm font-bold uppercase">Total Minerado</h3>
            </div>
            <p className="text-4xl font-black text-white">{totalLeadsGenerated}</p>
            <p className="text-xs text-slate-500 mt-2">Leads encontrados pela IA desde o início.</p>
          </div>
        </div>

        {/* Pipeline (Saved) */}
        <div className="bg-surface border border-slate-800 rounded-xl p-6 relative overflow-hidden group hover:border-green-500/30 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <CheckIcon className="w-16 h-16 text-green-500" />
          </div>
          <div className="relative z-10">
             <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
                    <UsersIcon className="w-5 h-5" />
                </div>
                <h3 className="text-slate-400 text-sm font-bold uppercase">Pipeline Ativo</h3>
            </div>
            <p className="text-4xl font-black text-white">{savedLeads.length}</p>
            <p className="text-xs text-green-400 mt-2 font-medium flex items-center">
                {validPhones} com WhatsApp verificado
            </p>
          </div>
        </div>

        {/* Potential Revenue */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-6 relative overflow-hidden group hover:border-yellow-500/50 transition-colors shadow-lg">
          <div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <MoneyIcon className="w-16 h-16 text-yellow-500" />
          </div>
          <div className="relative z-10">
             <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500">
                    <MoneyIcon className="w-5 h-5" />
                </div>
                <h3 className="text-yellow-200/70 text-sm font-bold uppercase">Potencial Bruto</h3>
            </div>
            <p className="text-4xl font-black text-white tracking-tight break-words">
                R$ {grossPotential.toLocaleString('pt-BR')}
            </p>
            <p className="text-xs text-slate-400 mt-2">
                Se você fechasse 100% dos leads.
            </p>
          </div>
        </div>
      </div>

      {/* INTERACTIVE FUNNEL SIMULATOR */}
      <div className="bg-surface border border-slate-800 rounded-xl p-6 md:p-8 relative overflow-hidden">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/10 rounded-lg text-accent">
                    <FilterIcon className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white">Simulador de Conversão</h3>
                    <p className="text-sm text-slate-400">Ajuste as taxas para projetar seus ganhos.</p>
                </div>
            </div>

            {/* SCENARIO SELECTOR */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full md:w-auto">
                {(Object.keys(SCENARIOS) as Array<keyof typeof SCENARIOS>).map((key) => (
                    <button
                        key={key}
                        onClick={() => applyScenario(key)}
                        className={`
                            px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-white shadow-lg transition-all transform active:scale-95 border border-white/10
                            bg-gradient-to-r ${SCENARIOS[key].color} hover:opacity-90
                        `}
                        title={SCENARIOS[key].desc}
                    >
                        {key === 'extraordinary' && <LightningIcon className="w-3 h-3 inline mr-1 mb-0.5" />}
                        {SCENARIOS[key].label}
                    </button>
                ))}
            </div>
        </div>

        <div className="flex flex-col gap-6">
            
            {/* STAGE 1: LEADS */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center gap-4 min-w-[200px]">
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-white shadow-lg">1</div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Leads na Base</p>
                        <p className="text-2xl font-black text-white">{leadsCount}</p>
                    </div>
                </div>
                <div className="flex-1 w-full md:px-4">
                    <div className="h-2 bg-slate-800 rounded-full"></div>
                </div>
            </div>

            {/* CONNECTOR 1: CONTACT RATE */}
            <div className="pl-4 md:pl-10 -my-3 relative z-10">
                <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg inline-flex flex-col w-full max-w-sm shadow-xl hover:border-accent/50 transition-colors">
                    <div className="flex justify-between text-xs mb-2">
                        <span className="text-accent font-bold uppercase">Taxa de Resposta</span>
                        <span className="text-white font-mono">{contactRate}%</span>
                    </div>
                    <input 
                        type="range" min="0" max="100" value={contactRate} 
                        onChange={(e) => setContactRate(parseInt(e.target.value))}
                        className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-accent"
                    />
                    <p className="text-[9px] text-slate-500 mt-1 italic">Quantos respondem seu "Oi"?</p>
                </div>
            </div>

            {/* STAGE 2: CONTACTS */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-blue-900/30">
                <div className="flex items-center gap-4 min-w-[200px]">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg">2</div>
                    <div>
                        <p className="text-xs font-bold text-blue-400 uppercase">Contatos Feitos</p>
                        <p className="text-2xl font-black text-white">{contactsCount}</p>
                    </div>
                </div>
                 <div className="flex-1 w-full md:px-4 hidden md:block">
                     <ArrowRightIcon className="w-6 h-6 text-slate-700 mx-auto" />
                </div>
            </div>

            {/* CONNECTOR 2: NEGOTIATION RATE */}
            <div className="pl-4 md:pl-10 -my-3 relative z-10">
                 <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg inline-flex flex-col w-full max-w-sm shadow-xl hover:border-purple-500/50 transition-colors">
                    <div className="flex justify-between text-xs mb-2">
                        <span className="text-purple-400 font-bold uppercase">Taxa de Interesse</span>
                        <span className="text-white font-mono">{negotiationRate}%</span>
                    </div>
                    <input 
                        type="range" min="0" max="100" value={negotiationRate} 
                        onChange={(e) => setNegotiationRate(parseInt(e.target.value))}
                        className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                     <p className="text-[9px] text-slate-500 mt-1 italic">Quantos aceitam ouvir a proposta?</p>
                </div>
            </div>

             {/* STAGE 3: NEGOTIATION */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-purple-900/30">
                <div className="flex items-center gap-4 min-w-[200px]">
                    <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center font-bold text-white shadow-lg">3</div>
                    <div>
                        <p className="text-xs font-bold text-purple-400 uppercase">Em Negociação</p>
                        <p className="text-2xl font-black text-white">{negotiationsCount}</p>
                    </div>
                </div>
                 <div className="flex-1 w-full md:px-4 hidden md:block">
                     <ArrowRightIcon className="w-6 h-6 text-slate-700 mx-auto" />
                </div>
            </div>

             {/* CONNECTOR 3: CLOSING RATE */}
             <div className="pl-4 md:pl-10 -my-3 relative z-10">
                 <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg inline-flex flex-col w-full max-w-sm shadow-xl hover:border-green-500/50 transition-colors">
                    <div className="flex justify-between text-xs mb-2">
                        <span className="text-green-400 font-bold uppercase">Taxa de Fechamento</span>
                        <span className="text-white font-mono">{closingRate}%</span>
                    </div>
                    <input 
                        type="range" min="0" max="100" value={closingRate} 
                        onChange={(e) => setClosingRate(parseInt(e.target.value))}
                        className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                     <p className="text-[9px] text-slate-500 mt-1 italic">Quantos pagam o boleto?</p>
                </div>
            </div>

            {/* STAGE 4: MONEY */}
            <div className="flex flex-col md:flex-row items-center gap-6 bg-gradient-to-r from-green-900/20 to-green-600/20 p-6 rounded-xl border border-green-500/50 relative overflow-hidden mt-4">
                <div className="absolute inset-0 bg-green-500/5 animate-pulse"></div>
                
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center font-bold text-white shadow-lg shadow-green-500/40">
                        <CheckIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-green-400 uppercase tracking-widest">Vendas Projetadas</p>
                        <p className="text-4xl font-black text-white">{salesCount}</p>
                    </div>
                </div>

                <div className="flex-1 md:text-right relative z-10 border-t md:border-t-0 md:border-l border-green-500/30 pt-4 md:pt-0 md:pl-6">
                     <p className="text-xs font-bold text-slate-400 uppercase mb-1">Faturamento Estimado</p>
                     <p className="text-3xl md:text-5xl font-black text-white tracking-tight">
                        R$ {projectedRevenue.toLocaleString('pt-BR')}
                     </p>
                     <p className="text-xs text-green-300 mt-2">
                        Seu objetivo para este mês 🚀
                     </p>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
