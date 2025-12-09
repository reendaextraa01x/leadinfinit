
import React from 'react';
import { Lead } from '../types';
import { InstagramIcon, PhoneIcon, GlobeIcon, WhatsAppIcon, SaveIcon } from './ui/Icons';

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

  return (
    <div 
      className="group relative bg-surface border border-slate-800 rounded-xl p-6 hover:border-accent/50 transition-all duration-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] animate-fade-in flex flex-col justify-between"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Glow Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-accent/5 to-primary/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold text-white group-hover:text-accent transition-colors pr-2">
            {lead.name}
          </h3>
          <button 
            onClick={() => onSave(lead)}
            className={`p-2 rounded-full transition-colors ${isSaved ? 'bg-accent text-surface' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
            title={isSaved ? "Salvo" : "Salvar Lead"}
          >
            <SaveIcon className="w-5 h-5" />
          </button>
        </div>

        <p className="text-slate-400 text-sm mb-6 line-clamp-3">
          {lead.description}
        </p>

        <div className="space-y-3">
          {/* Phone & Actions */}
          <div className="flex flex-col gap-2">
            <div className={`flex items-center p-2 rounded-lg transition-colors ${hasValidPhone ? 'bg-slate-800/50 border border-slate-700/50' : 'text-slate-500'}`}>
              <PhoneIcon className={`w-5 h-5 mr-3 ${hasValidPhone ? 'text-green-400' : 'text-slate-600'}`} />
              <span className={`font-mono text-sm tracking-wide font-bold ${hasValidPhone ? 'text-white' : 'text-slate-500'}`}>
                {lead.phone}
              </span>
            </div>
            
            {/* Quick Actions Bar */}
            <div className="flex gap-2 mt-1">
              {waNumber && (
                <a 
                  href={`https://wa.me/${waNumber}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20 py-2.5 rounded-lg transition-all text-xs font-bold uppercase tracking-wide transform active:scale-95"
                >
                  <WhatsAppIcon className="w-4 h-4" />
                  Chamar no Zap
                </a>
              )}
            </div>
          </div>

          {/* Website */}
          {lead.website && (
            <div className="flex items-center text-slate-300 pl-2">
              <GlobeIcon className="w-4 h-4 mr-3 text-slate-500 group-hover:text-primary transition-colors" />
              <a 
                href={lead.website} 
                target="_blank" 
                rel="noreferrer" 
                className="text-sm hover:text-accent transition-colors truncate max-w-[200px]"
              >
                {lead.website}
              </a>
            </div>
          )}

          {/* Instagram */}
          <div className="flex items-center pl-2">
            <InstagramIcon className={`w-4 h-4 mr-3 transition-colors ${lead.instagram ? 'text-pink-500' : 'text-slate-600'}`} />
            {lead.instagram ? (
              <a 
                href={lead.instagram} 
                target="_blank" 
                rel="noreferrer"
                className="text-sm text-pink-400 hover:text-pink-300 transition-colors font-medium"
              >
                Ver Perfil
              </a>
            ) : (
              <span className="text-sm text-slate-600 italic">Não encontrado</span>
            )}
          </div>
        </div>
      </div>
      
      {/* Decorative Index */}
      <div className="absolute top-4 right-14 text-sm font-bold bg-slate-800 px-2 py-1 rounded text-slate-400">
        #{(index + 1).toString().padStart(2, '0')}
      </div>
    </div>
  );
};

export default LeadCard;
