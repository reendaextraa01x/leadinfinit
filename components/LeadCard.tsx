
import React from 'react';
import { Lead } from '../types';
import { InstagramIcon, PhoneIcon, GlobeIcon, WhatsAppIcon, SaveIcon, FireIcon, TargetIcon } from './ui/Icons';

interface LeadCardProps {
  lead: Lead;
  index: number;
  onSave: (lead: Lead) => void;
  isSaved: boolean;
}

const cleanPhone = (phone: string): string | null => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 8) return null; // Invalid number
  // Assume BR (55) if missing and looks like a mobile/landline length (10 or 11 digits)
  if (cleaned.length === 10 || cleaned.length === 11) {
    return `55${cleaned}`;
  }
  return cleaned;
};

const LeadCard: React.FC<LeadCardProps> = ({ lead, index, onSave, isSaved }) => {
  const waNumber = cleanPhone(lead.phone);
  const hasValidPhone = lead.phone && lead.phone !== "Não encontrado";
  const isHot = lead.score === 'hot';

  return (
    <div 
      className="group relative bg-surface border border-slate-800 rounded-xl p-5 hover:border-accent/50 transition-all duration-300 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)] animate-fade-in flex flex-col justify-between h-full min-h-[220px]"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Glow Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-accent/5 to-primary/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Hot Badge */}
      {isHot && (
        <div className="absolute -top-2 -right-2 bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center shadow-lg shadow-orange-500/30 z-20 animate-pulse">
            <FireIcon className="w-3 h-3 mr-0.5" />
            HOT
        </div>
      )}
      
      {/* Quality Badge - DIAMOND */}
      {lead.qualityTier === 'high-ticket' && (
         <div className="absolute -top-2 -left-2 bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center shadow-lg shadow-purple-500/30 z-20">
            💎 VIP
        </div>
      )}

      <div className="relative z-10 flex flex-col h-full">
        <div className="flex justify-between items-start mb-3 gap-2">
          <h3 className="text-lg font-bold text-white group-hover:text-accent transition-colors break-words leading-tight line-clamp-2">
            {lead.name}
          </h3>
          <button 
            onClick={() => onSave(lead)}
            className={`p-2 rounded-full transition-all transform active:scale-95 flex-shrink-0 ${isSaved ? 'bg-accent text-surface shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
            title={isSaved ? "Salvo" : "Salvar Lead"}
          >
            <SaveIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Opportunity / Match Reason */}
        {lead.matchReason && (
             <div className="mb-3 bg-accent/10 border border-accent/20 rounded-lg p-2">
                 <div className="flex items-center text-accent text-[10px] font-bold uppercase tracking-wide mb-1">
                     <TargetIcon className="w-3 h-3 mr-1 flex-shrink-0" />
                     Oportunidade
                 </div>
                 <p className="text-[11px] text-slate-300 italic leading-relaxed line-clamp-2">
                     "{lead.matchReason}"
                 </p>
             </div>
        )}

        <p className="text-slate-400 text-xs mb-4 line-clamp-3 break-words leading-relaxed">
          {lead.description}
        </p>

        {/* Pain Points Badges */}
        {lead.painPoints && lead.painPoints.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
                {lead.painPoints.slice(0, 3).map((point, i) => (
                    <span key={i} className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-300 text-[10px] rounded-full font-bold uppercase whitespace-nowrap">
                        {point}
                    </span>
                ))}
            </div>
        )}

        <div className="space-y-3 mt-auto pt-2 border-t border-slate-800/50">
          {/* Phone & Actions */}
          <div className="flex flex-col gap-2">
            <div className={`flex items-center p-2 rounded-lg transition-colors ${hasValidPhone ? 'bg-slate-800/50 border border-slate-700/50' : 'text-slate-500'}`}>
              <PhoneIcon className={`w-4 h-4 mr-2 flex-shrink-0 ${hasValidPhone ? 'text-green-400' : 'text-slate-600'}`} />
              <span className={`font-mono text-sm tracking-wide font-bold truncate ${hasValidPhone ? 'text-white' : 'text-slate-500'}`}>
                {lead.phone}
              </span>
            </div>
            
            {/* Quick Actions Bar */}
            <div className="flex gap-2">
              {waNumber && (
                <a 
                  href={`https://wa.me/${waNumber}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20 py-2.5 rounded-lg transition-all text-xs font-bold uppercase tracking-wide transform active:scale-95 animate-pulse-fast hover:animate-none"
                >
                  <WhatsAppIcon className="w-4 h-4" />
                  CHAMAR
                </a>
              )}
            </div>
          </div>

          {/* Links Row */}
          <div className="flex items-center justify-between px-1">
             {/* Website */}
            <div className="flex items-center text-slate-300 overflow-hidden mr-2">
              <GlobeIcon className={`w-3.5 h-3.5 mr-1.5 flex-shrink-0 ${lead.website ? 'text-slate-400 group-hover:text-primary' : 'text-slate-700'}`} />
              {lead.website ? (
                  <a 
                    href={lead.website} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-[10px] hover:text-accent transition-colors truncate"
                  >
                    {lead.website.replace('https://', '').replace('http://', '').replace('www.', '')}
                  </a>
              ) : (
                  <span className="text-[10px] text-slate-600 italic">Sem site</span>
              )}
            </div>

            {/* Instagram */}
            <div className="flex items-center">
              <InstagramIcon className={`w-3.5 h-3.5 mr-1.5 transition-colors flex-shrink-0 ${lead.instagram ? 'text-pink-500' : 'text-slate-700'}`} />
              {lead.instagram ? (
                <a 
                  href={lead.instagram} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-[10px] text-pink-400 hover:text-pink-300 transition-colors font-medium truncate"
                >
                  Ver Perfil
                </a>
              ) : (
                <span className="text-[10px] text-slate-600 italic">--</span>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LeadCard;
