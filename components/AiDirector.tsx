
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useRef, useEffect } from 'react';
import { AgentMessage, AgentRole } from '../types';
import { Send, Clapperboard, Users, MessageSquare, Video, Search, Lightbulb, Camera, Zap, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface AiDirectorProps {
    messages: AgentMessage[];
    onSendMessage: (text: string) => void;
    isThinking: boolean;
    visualStyle: string;
}

const AGENT_META: Record<AgentRole, { color: string, icon: any, name: string }> = {
    Director: { color: 'text-red-500', icon: Clapperboard, name: 'СТЭНЛИ (Режиссер)' },
    Producer: { color: 'text-green-500', icon: Users, name: 'МАРКУС (Продюсер)' },
    Writer: { color: 'text-blue-500', icon: MessageSquare, name: 'ХЛОЯ (Сценарист)' },
    Cinematographer: { color: 'text-purple-500', icon: Video, name: 'ТЕКС (Оператор)' },
    Researcher: { color: 'text-cyan-500', icon: Search, name: 'ДАТА (Аналитик)' },
};

const SUGGESTIONS = [
    { label: "Предложить сцену", icon: Lightbulb, prompt: "Предложи 3 варианта сцены в текущем стиле." },
    { label: "Камера", icon: Camera, prompt: "Предложи интересное движение камеры (Dolly, Truck, Pan) для текущей ситуации." },
    { label: "Свет", icon: Zap, prompt: "Как лучше выставить свет здесь? Опиши схему освещения." },
    { label: "Драма", icon: Sparkles, prompt: "Добавь больше драматизма и напряжения в эту сцену." },
];

const AiDirector: React.FC<AiDirectorProps> = ({ messages, onSendMessage, isThinking, visualStyle }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [input, setInput] = React.useState('');

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isThinking]);

    const handleSend = () => {
        if (!input.trim()) return;
        onSendMessage(input);
        setInput('');
    };

    return (
        <div className="flex flex-col h-full bg-[#050505] relative">
            {/* Context Bar */}
            <div className="px-6 py-2 bg-white/5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Стиль:</span>
                    <span className="text-[9px] font-mono text-indigo-400 uppercase">{visualStyle}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Статус:</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${isThinking ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                {messages.map((m) => {
                    const isMe = m.role === 'Producer';
                    return (
                        <motion.div 
                            key={m.id} 
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            className={`flex gap-4 ${isMe ? 'flex-row-reverse' : ''}`}
                        >
                            {!isMe && (
                                <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center bg-white/5 border border-white/10 ${AGENT_META[m.role]?.color}`}>
                                    {React.createElement(AGENT_META[m.role]?.icon, { size: 14 })}
                                </div>
                            )}
                            
                            <div className={`flex flex-col max-w-[85%] ${isMe ? 'items-end' : 'items-start'}`}>
                                {!isMe && (
                                    <span className={`text-[8px] font-black uppercase tracking-[0.2em] mb-1.5 ${AGENT_META[m.role]?.color}`}>
                                        {AGENT_META[m.role]?.name}
                                    </span>
                                )}
                                <div className={`px-4 py-3 rounded-2xl text-xs leading-relaxed font-medium border ${
                                    isMe 
                                    ? 'bg-white text-black border-white' 
                                    : 'bg-white/5 text-white/90 border-white/10'
                                }`}>
                                    {m.text}
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
                {isThinking && (
                    <div className="flex items-center gap-3 px-2 opacity-50">
                         <div className="flex gap-1">
                             <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{animationDelay: '0ms'}}/>
                             <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{animationDelay: '150ms'}}/>
                             <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{animationDelay: '300ms'}}/>
                         </div>
                         <span className="text-[9px] font-black uppercase tracking-widest text-white/40">AI Director печатает...</span>
                    </div>
                )}
                <div ref={scrollRef} />
            </div>

            {/* Quick Actions */}
            <div className="px-6 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
                {SUGGESTIONS.map((s, i) => (
                    <button
                        key={i}
                        onClick={() => onSendMessage(`(System: Suggestion Request) ${s.prompt}`)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all shrink-0 text-[9px] font-bold uppercase tracking-wider text-white/60 hover:text-white"
                    >
                        <s.icon size={10} />
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-black/60 border-t border-white/5">
                <div className="relative">
                    <input 
                        value={input} 
                        onChange={e => setInput(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && handleSend()} 
                        placeholder="Опишите ваше видение или спросите совета..." 
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-5 pr-14 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-all shadow-inner" 
                    />
                    <button 
                        onClick={handleSend} 
                        disabled={!input.trim() || isThinking}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20"
                    >
                        <Send size={14}/>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AiDirector;
