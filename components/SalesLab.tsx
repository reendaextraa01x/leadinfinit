import React, { useState, useRef, useEffect } from 'react';
import { ServiceContext, SequenceDay, RoleplayProfile, RoleplayMessage } from '../types';
import { BrainIcon, RobotIcon, ClockIcon, SwordsIcon, MagicIcon, CopyIcon, SendIcon } from './ui/Icons';
import { generateNeuroSequence, runRoleplayTurn } from '../services/geminiService';

interface SalesLabProps {
  serviceContext: ServiceContext;
}

const SalesLab: React.FC<SalesLabProps> = ({ serviceContext }) => {
  const [activeTab, setActiveTab] = useState<'sequence' | 'dojo'>('sequence');
  
  // SEQUENCE STATE
  const [sequence, setSequence] = useState<SequenceDay[]>([]);
  const [isGeneratingSeq, setIsGeneratingSeq] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // DOJO STATE
  const [profile, setProfile] = useState<RoleplayProfile>('skeptic');
  const [chatHistory, setChatHistory] = useState<RoleplayMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // SEQUENCE LOGIC
  const handleGenerateSequence = async () => {
    if (!serviceContext.serviceName) return alert("Configure seu serviço primeiro!");
    setIsGeneratingSeq(true);
    try {
        const result = await generateNeuroSequence(serviceContext);
        setSequence(result);
    } catch (e) {
        console.error(e);
    } finally {
        setIsGeneratingSeq(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // DOJO LOGIC
  const startDojo = () => {
    setChatHistory([{ 
        sender: 'ai', 
        text: "Oi. Quem é e o que você quer? (Seja breve, tô ocupado)", 
        feedback: "O cliente iniciou a conversa com uma barreira defensiva. Tente quebrar o padrão ou gerar curiosidade imediata.",
        score: 5 
    }]);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    
    const userMsg: RoleplayMessage = { sender: 'user', text: inputMessage };
    const newHistory = [...chatHistory, userMsg];
    setChatHistory(newHistory);
    setInputMessage('');
    setIsAiThinking(true);

    try {
        const aiResponse = await runRoleplayTurn(profile, newHistory, serviceContext);
        setChatHistory(prev => [...prev, aiResponse]);
    } catch (e) {
        console.error(e);
    } finally {
        setIsAiThinking(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  return (
    <div className="max-w-6xl mx-auto animate-fade-in pb-20 px-4">
        
        {/* HEADER */}
        <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 flex justify-center items-center gap-3">
                <BrainIcon className="w-10 h-10 text-purple-400" />
                Laboratório de Neurovendas
            </h2>
            <p className="text-slate-400 mt-2">Ferramentas de elite para quem quer dominar a psicologia da venda.</p>
        </div>

        {/* SUB-NAVIGATION */}
        <div className="flex justify-center mb-8">
            <div className="bg-surface border border-slate-800 p-1 rounded-xl flex gap-2">
                <button
                    onClick={() => setActiveTab('sequence')}
                    className={`flex items-center px-6 py-3 rounded-lg font-bold transition-all ${activeTab === 'sequence' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
                >
                    <ClockIcon className="w-5 h-5 mr-2" />
                    Cadência Neural (Follow-up)
                </button>
                <button
                    onClick={() => setActiveTab('dojo')}
                    className={`flex items-center px-6 py-3 rounded-lg font-bold transition-all ${activeTab === 'dojo' ? 'bg-pink-600 text-white shadow-lg shadow-pink-900/40' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
                >
                    <SwordsIcon className="w-5 h-5 mr-2" />
                    Dojo de Negociação
                </button>
            </div>
        </div>

        {/* --- TAB: SEQUENCE GENERATOR --- */}
        {activeTab === 'sequence' && (
            <div className="animate-fade-in">
                <div className="bg-surface border border-slate-800 rounded-xl p-8 mb-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-[80px] pointer-events-none"></div>
                    
                    <div className="flex justify-between items-center mb-6 relative z-10">
                        <div>
                            <h3 className="text-2xl font-bold text-white mb-2">Gerador de Sequência Infinita</h3>
                            <p className="text-slate-400 text-sm max-w-xl">
                                80% das vendas acontecem após o 5º contato. A maioria desiste no 1º.
                                Esta ferramenta cria uma sequência de resgate psicológico para reviver leads mortos.
                            </p>
                        </div>
                        <button
                            onClick={handleGenerateSequence}
                            disabled={isGeneratingSeq}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
                        >
                            <MagicIcon className={`w-5 h-5 ${isGeneratingSeq ? 'animate-spin' : ''}`} />
                            {isGeneratingSeq ? 'Criando Cadência...' : 'Gerar Sequência'}
                        </button>
                    </div>

                    {sequence.length > 0 ? (
                        <div className="space-y-4">
                            {sequence.map((item, idx) => (
                                <div key={idx} className="bg-slate-900/50 border border-slate-700 rounded-lg p-5 hover:border-purple-500/50 transition-colors group">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <span className="bg-purple-900/30 text-purple-300 px-3 py-1 rounded text-xs font-bold uppercase border border-purple-500/20">
                                                {item.day}
                                            </span>
                                            <span className="text-slate-300 font-bold text-sm flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                                                Gatilho: {item.trigger}
                                            </span>
                                        </div>
                                        <button 
                                            onClick={() => copyToClipboard(item.message, idx)}
                                            className="text-slate-500 hover:text-white transition-colors"
                                            title="Copiar mensagem"
                                        >
                                            {copiedIndex === idx ? <span className="text-green-400 text-xs font-bold">Copiado!</span> : <CopyIcon className="w-5 h-5" />}
                                        </button>
                                    </div>
                                    <div className="bg-slate-950 p-4 rounded border border-slate-800 font-mono text-sm text-slate-300 leading-relaxed relative">
                                        {item.message}
                                    </div>
                                    <p className="mt-2 text-xs text-slate-500 italic">💡 {item.explanation}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                            <ClockIcon className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                            <p className="text-slate-500 font-bold">Nenhuma sequência gerada ainda.</p>
                            <p className="text-slate-600 text-sm">Configure seu serviço e clique em "Gerar Sequência".</p>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* --- TAB: DOJO ROLEPLAY --- */}
        {activeTab === 'dojo' && (
            <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
                
                {/* SETTINGS PANEL */}
                <div className="bg-surface border border-slate-800 rounded-xl p-6 flex flex-col gap-6">
                    <div>
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <RobotIcon className="w-6 h-6 text-pink-500" />
                            Configuração
                        </h3>
                        <p className="text-xs text-slate-400 mb-4">Escolha seu oponente. A IA simulará a personalidade e te dará feedback em tempo real.</p>
                        
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Perfil do Cliente</label>
                        <div className="space-y-2">
                            <button onClick={() => setProfile('skeptic')} className={`w-full p-3 rounded-lg border text-left text-sm transition-all ${profile === 'skeptic' ? 'bg-pink-600/20 border-pink-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                                🤨 <strong>O Cético</strong>
                                <p className="text-[10px] opacity-70">Acha que é golpe. Pede provas. Frio.</p>
                            </button>
                            <button onClick={() => setProfile('cheap')} className={`w-full p-3 rounded-lg border text-left text-sm transition-all ${profile === 'cheap' ? 'bg-pink-600/20 border-pink-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                                💸 <strong>O Pão-Duro</strong>
                                <p className="text-[10px] opacity-70">Só importa o preço. Quer desconto.</p>
                            </button>
                            <button onClick={() => setProfile('hasty')} className={`w-full p-3 rounded-lg border text-left text-sm transition-all ${profile === 'hasty' ? 'bg-pink-600/20 border-pink-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                                🏃 <strong>O Apressado</strong>
                                <p className="text-[10px] opacity-70">Grosso. Curto. "Qual o preço?".</p>
                            </button>
                        </div>
                    </div>
                    
                    <button 
                        onClick={startDojo}
                        className="mt-auto w-full py-3 bg-gradient-to-r from-pink-600 to-purple-600 hover:opacity-90 text-white font-bold rounded-lg shadow-lg"
                    >
                        {chatHistory.length > 0 ? 'Reiniciar Batalha' : 'Iniciar Batalha'}
                    </button>
                </div>

                {/* CHAT ARENA */}
                <div className="lg:col-span-2 bg-surface border border-slate-800 rounded-xl flex flex-col overflow-hidden relative">
                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-950/50">
                        {chatHistory.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                                <SwordsIcon className="w-24 h-24 mb-4" />
                                <p className="font-bold">A Arena está vazia.</p>
                                <p className="text-sm">Selecione um oponente e inicie.</p>
                            </div>
                        ) : (
                            chatHistory.map((msg, idx) => (
                                <div key={idx} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                                    
                                    {/* MESSAGE BUBBLE */}
                                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.sender === 'user' ? 'bg-pink-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none'}`}>
                                        {msg.text}
                                    </div>

                                    {/* AI FEEDBACK CARD */}
                                    {msg.sender === 'ai' && msg.feedback && (
                                        <div className="mt-2 ml-2 max-w-[85%] bg-gradient-to-r from-purple-900/40 to-slate-900 border border-purple-500/30 rounded-lg p-3 animate-fade-in">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Feedback do Coach</span>
                                                <span className={`text-[10px] font-bold px-1.5 rounded ${msg.score! >= 7 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                    Nota: {msg.score}/10
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-300 italic">"{msg.feedback}"</p>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                        {isAiThinking && (
                            <div className="flex items-start">
                                <div className="bg-slate-800 p-3 rounded-2xl rounded-bl-none flex gap-1">
                                    <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></span>
                                    <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '100ms'}}></span>
                                    <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '200ms'}}></span>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef}></div>
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-surface border-t border-slate-800">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="Digite sua resposta de venda..."
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 text-white focus:outline-none focus:border-pink-500 transition-colors"
                                disabled={isAiThinking || chatHistory.length === 0}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={isAiThinking || chatHistory.length === 0}
                                className="bg-pink-600 hover:bg-pink-500 text-white p-3 rounded-lg disabled:opacity-50 transition-colors"
                            >
                                <SendIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default SalesLab;