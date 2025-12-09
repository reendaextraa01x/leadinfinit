
import React, { useState } from 'react';
import { SettingsIcon, SearchIcon, TargetIcon, WhatsAppIcon, BrainIcon, RocketIcon, ArrowRightIcon, ShieldIcon } from './ui/Icons';

interface TutorialProps {
    onNavigate: (tab: any) => void;
}

const Tutorial: React.FC<TutorialProps> = ({ onNavigate }) => {
    const [openPhase, setOpenPhase] = useState<number | null>(1);

    const togglePhase = (id: number) => {
        setOpenPhase(openPhase === id ? null : id);
    }

    const phases = [
        {
            id: 1,
            title: "FASE 1: PREPARAÇÃO DO ARSENAL",
            subtitle: "Configurando sua Máquina de Vendas",
            icon: SettingsIcon,
            color: "from-blue-600 to-blue-400",
            textColor: "text-blue-400",
            content: (
                <div className="space-y-4">
                    <p className="text-slate-300 text-sm leading-relaxed">
                        Antes de entrar no campo de batalha, você precisa definir sua arma. A IA precisa saber o que você vende para encontrar as vítimas (clientes) certas.
                    </p>
                    <ul className="space-y-2 text-sm text-slate-400">
                        <li className="flex items-start gap-2">
                            <span className="text-blue-400 font-bold">1.</span>
                            Vá na aba <strong>"Meu Serviço"</strong>.
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-400 font-bold">2.</span>
                            Escreva o nome do seu serviço (ex: Criação de Sites).
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-400 font-bold">3.</span>
                            <span className="text-white font-bold bg-blue-500/20 px-1 rounded">TRUQUE DE MESTRE:</span> Use o botão <strong>"Criar Oferta Irresistível"</strong> (ícone de Raio). A IA vai transformar "Vendo Sites" em uma oferta que ninguém consegue recusar.
                        </li>
                    </ul>
                    <button 
                        onClick={() => onNavigate('config')}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
                    >
                        <SettingsIcon className="w-4 h-4" />
                        EXECUTAR MISSÃO AGORA
                    </button>
                </div>
            )
        },
        {
            id: 2,
            title: "FASE 2: OPERAÇÃO CAÇADOR",
            subtitle: "Encontrando Alvos de Alto Valor",
            icon: SearchIcon,
            color: "from-accent to-cyan-400",
            textColor: "text-accent",
            content: (
                <div className="space-y-4">
                    <p className="text-slate-300 text-sm leading-relaxed">
                        Agora vamos ligar o radar. O objetivo aqui não é volume, é <strong>QUALIDADE</strong>.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-900 p-3 rounded border border-slate-700">
                            <p className="text-xs font-bold text-accent uppercase mb-1">DICA TÁTICA 1</p>
                            <p className="text-xs text-slate-400">Use o filtro <strong>"Pequeno"</strong> se você vende sites (eles geralmente não têm). Use <strong>"Grande"</strong> se vende tráfego/consultoria (eles têm dinheiro).</p>
                        </div>
                        <div className="bg-slate-900 p-3 rounded border border-slate-700">
                             <p className="text-xs font-bold text-accent uppercase mb-1">DICA TÁTICA 2</p>
                            <p className="text-xs text-slate-400">Procure pelos ícones de <strong>Fogo (🔥)</strong>. Esses são leads com "Dor Aguda" (ex: site fora do ar). Dinheiro fácil.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => onNavigate('search')}
                        className="w-full py-3 bg-accent hover:bg-cyan-400 text-surface font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
                    >
                        <SearchIcon className="w-4 h-4" />
                        INICIAR RADAR
                    </button>
                </div>
            )
        },
        {
            id: 3,
            title: "FASE 3: ENGAGEMENT & ATAQUE",
            subtitle: "O Pipeline de Conversão",
            icon: WhatsAppIcon,
            color: "from-green-600 to-emerald-400",
            textColor: "text-green-400",
            content: (
                <div className="space-y-4">
                    <p className="text-slate-300 text-sm leading-relaxed">
                        Você salvou os leads. Agora eles estão no seu <strong>CRM Pipeline</strong>. É hora de atacar.
                    </p>
                    <ul className="space-y-2 text-sm text-slate-400">
                        <li className="flex items-start gap-2">
                            <span className="text-green-400 font-bold">1.</span>
                            Clique em <strong>"+ Gerar Auditoria"</strong>. A IA vai achar 3 erros reais no negócio do cliente.
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-green-400 font-bold">2.</span>
                            Use isso como "Quebra-Gelo". Ninguém ignora alguém que aponta um erro.
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-green-400 font-bold">3.</span>
                            Se a conversa fluir, use o botão <strong>"Analisar Conversa"</strong> (ícone de Microscópio) para a IA ler o chat e te dizer como fechar.
                        </li>
                    </ul>
                    <button 
                        onClick={() => onNavigate('saved')}
                        className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
                    >
                        <WhatsAppIcon className="w-4 h-4" />
                        ABRIR CRM
                    </button>
                </div>
            )
        },
        {
            id: 4,
            title: "FASE 4: DOMINAÇÃO MENTAL",
            subtitle: "Laboratório de Neurovendas",
            icon: BrainIcon,
            color: "from-purple-600 to-pink-500",
            textColor: "text-purple-400",
            content: (
                <div className="space-y-4">
                    <p className="text-slate-300 text-sm leading-relaxed">
                        O cliente parou de responder? Achou caro? Bem-vindo ao Laboratório.
                    </p>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3 p-2 bg-slate-900 rounded border border-slate-700">
                             <ShieldIcon className="w-5 h-5 text-pink-500" />
                             <div>
                                 <p className="text-xs font-bold text-white">DOJO DE TREINO</p>
                                 <p className="text-[10px] text-slate-400">Simule uma briga com um cliente "Pão-Duro" antes de falar com o real.</p>
                             </div>
                        </div>
                         <div className="flex items-center gap-3 p-2 bg-slate-900 rounded border border-slate-700">
                             <BrainIcon className="w-5 h-5 text-purple-500" />
                             <div>
                                 <p className="text-xs font-bold text-white">CADÊNCIA NEURAL</p>
                                 <p className="text-[10px] text-slate-400">Gere 5 mensagens psicológicas para reviver leads mortos.</p>
                             </div>
                        </div>
                    </div>
                    <button 
                        onClick={() => onNavigate('lab')}
                        className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
                    >
                        <BrainIcon className="w-4 h-4" />
                        ENTRAR NO LABORATÓRIO
                    </button>
                </div>
            )
        }
    ];

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-20 px-4">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 mb-4 flex justify-center items-center gap-3">
          <RocketIcon className="w-8 h-8 text-yellow-500" />
          CENTRO DE COMANDO TÁTICO
        </h2>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Protocolo de Operação LeadInfinit. Siga estas 4 fases para extrair o máximo de lucro da plataforma.
        </p>
      </div>

      <div className="space-y-4">
          {phases.map((phase) => (
              <div 
                key={phase.id} 
                className={`bg-surface border transition-all duration-300 overflow-hidden rounded-xl ${openPhase === phase.id ? 'border-slate-600 shadow-2xl' : 'border-slate-800 hover:border-slate-700'}`}
              >
                  {/* Header */}
                  <button 
                    onClick={() => togglePhase(phase.id)}
                    className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
                  >
                      <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${phase.color} flex items-center justify-center shadow-lg`}>
                              <phase.icon className="w-6 h-6 text-white" />
                          </div>
                          <div>
                              <h3 className={`font-black text-lg ${phase.textColor}`}>{phase.title}</h3>
                              <p className="text-slate-400 text-sm font-medium">{phase.subtitle}</p>
                          </div>
                      </div>
                      <div className={`transition-transform duration-300 ${openPhase === phase.id ? 'rotate-90' : ''}`}>
                          <ArrowRightIcon className="w-6 h-6 text-slate-500" />
                      </div>
                  </button>

                  {/* Body (Accordion) */}
                  <div className={`transition-[max-height] duration-500 ease-in-out overflow-hidden ${openPhase === phase.id ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                      <div className="p-6 pt-0 border-t border-slate-800/50 mt-2">
                          <div className="pl-4 ml-6 border-l-2 border-slate-800 py-2">
                              {phase.content}
                          </div>
                      </div>
                  </div>
              </div>
          ))}
      </div>

       <div className="mt-12 text-center bg-slate-900/50 p-6 rounded-2xl border border-slate-800 border-dashed">
            <p className="text-slate-500 text-sm italic">
                "A tecnologia não vende sozinha. Ela é a espada, mas você é o guerreiro. Use as ferramentas com sabedoria."
            </p>
       </div>
    </div>
  );
};

export default Tutorial;
