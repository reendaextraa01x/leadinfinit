
import React, { useState, useEffect } from 'react';
import { Lead, ServiceContext } from '../types';
import { MoneyIcon, UsersIcon, ChartIcon, CheckIcon } from './ui/Icons';

interface DashboardProps {
  savedLeads: Lead[];
  totalLeadsGenerated: number;
  serviceContext: ServiceContext;
  onUpdateTicketValue: (value: number) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ savedLeads, totalLeadsGenerated, serviceContext, onUpdateTicketValue }) => {
  // Local state for the input to handle typing
  const [ticketInput, setTicketInput] = useState(serviceContext.ticketValue?.toString() || '1500');

  // Sync with prop changes
  useEffect(() => {
    setTicketInput(serviceContext.ticketValue?.toString() || '1500');
  }, [serviceContext.ticketValue]);

  const handleBlur = () => {
    // Clean and parse
    let val = parseFloat(ticketInput);
    if (isNaN(val) || val < 0) val = 0;
    
    // Update parent state
    onUpdateTicketValue(val);
    // Format input back to string
    setTicketInput(val.toString());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        (e.target as HTMLInputElement).blur();
    }
  };

  const currentTicketValue = parseFloat(ticketInput) || 0;
  const potentialRevenue = savedLeads.length * currentTicketValue;

  const validPhones = savedLeads.filter(l => {
     const clean = l.phone.replace(/\D/g, '');
     return clean.length >= 8;
  }).length;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Visão Geral</h2>
          <p className="text-slate-400">Acompanhe o crescimento da sua prospecção.</p>
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
                <h3 className="text-slate-400 text-sm font-bold uppercase">Pipeline de Vendas</h3>
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
                <h3 className="text-yellow-200/70 text-sm font-bold uppercase">Potencial de Receita</h3>
            </div>
            <p className="text-4xl font-black text-white tracking-tight break-words">
                R$ {potentialRevenue.toLocaleString('pt-BR')}
            </p>
            <p className="text-xs text-slate-400 mt-2">
                Baseado nos leads salvos x Ticket Médio.
            </p>
          </div>
        </div>
      </div>

      {/* Visual Funnel / Chart Decoration */}
      <div className="bg-surface border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-6">Funil de Conversão (Estimativa)</h3>
        <div className="space-y-4">
            {/* Stage 1 */}
            <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Leads Salvos</span>
                    <span>100%</span>
                </div>
                <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-600 rounded-full w-full"></div>
                </div>
                <div className="text-right text-xs text-white font-bold mt-1">{savedLeads.length} leads</div>
            </div>

             {/* Stage 2 */}
             <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Taxa de Resposta (Estimado 30%)</span>
                    <span>30%</span>
                </div>
                <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full w-[30%]"></div>
                </div>
                <div className="text-right text-xs text-white font-bold mt-1">{Math.ceil(savedLeads.length * 0.3)} respostas</div>
            </div>

             {/* Stage 3 */}
             <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Vendas Fechadas (Estimado 5%)</span>
                    <span>5%</span>
                </div>
                <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full w-[5%] shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                </div>
                <div className="text-right text-xs text-green-400 font-bold mt-1">
                    {Math.ceil(savedLeads.length * 0.05)} vendas 
                    <span className="text-slate-500 font-normal ml-1">
                        (~ R$ {(Math.ceil(savedLeads.length * 0.05) * currentTicketValue).toLocaleString('pt-BR')})
                    </span>
                </div>
            </div>
        </div>
        <p className="text-xs text-slate-600 mt-4 italic text-center">
            *Taxas estimadas de mercado para prospecção fria bem feita. O resultado real depende da sua copy.
        </p>
      </div>

    </div>
  );
};

export default Dashboard;
