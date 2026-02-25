
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AgentMessage, AgentRole, StoryboardFrame, GenerationMode, VeoModel, AspectRatio, Resolution, DirectorStyle } from '../types';
import { createDirectorSession, generateImage, generateVideo } from '../services/geminiService';
import { saveChatMessage, getChatHistory, saveStoryboardFrame, getStoryboardFrames, logEvent } from '../utils/db';
import { Clapperboard, Film, Activity, X, BrainCircuit, Loader2, Sparkles, Monitor, Grid } from 'lucide-react';
import AiDirector from './AiDirector';

interface StudioAgentProps {
    onClose: () => void;
}

const VISUAL_STYLES: DirectorStyle[] = ['Cinematic', 'Cyberpunk', 'Noir', 'Documentary', 'Anime', 'Minimalist', 'Vintage'];

const StudioAgent: React.FC<StudioAgentProps> = ({ onClose }) => {
    const [messages, setMessages] = useState<AgentMessage[]>([]);
    const [frames, setFrames] = useState<StoryboardFrame[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [activeTab, setActiveTab] = useState<'monitor' | 'director'>('director');
    const [useThinking, setUseThinking] = useState(false);
    const [session, setSession] = useState<any>(null);
    const [visualStyle, setVisualStyle] = useState<DirectorStyle>('Cinematic');
    
    // Initialize session and load history
    useEffect(() => {
        const initStudio = async () => {
            try {
                // 1. Load History
                const history = await getChatHistory();
                if (history.length > 0) {
                    setMessages(history);
                } else {
                    const initMsg: AgentMessage = { id: 'init', role: 'Director', text: "Стэнли на связи. Среда производства откалибрована. Каков наш сценарий?", timestamp: Date.now() };
                    setMessages([initMsg]);
                    saveChatMessage(initMsg); // Save initial message if new session
                }

                // 2. Load Frames
                const savedFrames = await getStoryboardFrames();
                setFrames(savedFrames);
            } catch (e) {
                console.error("Failed to load studio history", e);
            }
        };

        const s = createDirectorSession({ visualStyle, pacing: 'Medium', motionIntensity: 'Medium' }, useThinking);
        setSession(s);
        initStudio();
    }, [useThinking, visualStyle]); // Re-create session when style changes to update context

    const handleSendMessage = async (text: string) => {
        if (!session) return;
        
        const userMsg: AgentMessage = { id: Date.now().toString(), role: 'Producer', text: text, timestamp: Date.now(), isAction: true };
        setMessages(prev => [...prev, userMsg]);
        saveChatMessage(userMsg); // Save to DB
        
        setIsThinking(true);

        try {
            const res = await session.sendMessage({ message: text });
            const aiText = res.text || '';
            
            let role: AgentRole = 'Director';
            if (aiText.toLowerCase().includes('свет') || aiText.toLowerCase().includes('объектив')) role = 'Cinematographer';
            else if (aiText.toLowerCase().includes('сценарий') || aiText.toLowerCase().includes('персонаж')) role = 'Writer';
            
            // Check for JSON commands (Frame Generation)
            const jsonMatch = aiText.match(/:::JSON([\s\S]*?):::/);
            if (jsonMatch) {
                try {
                    const cmd = JSON.parse(jsonMatch[1]);
                    if (cmd.action === 'generate_frame') processFrame(cmd.prompt);
                } catch (e) {
                    console.error("JSON parse error", e);
                }
            }

            const cleanText = aiText.replace(/:::JSON[\s\S]*?:::/, '');
            const agentMsg: AgentMessage = { id: Date.now().toString(), role: role, text: cleanText, timestamp: Date.now() };
            
            setMessages(prev => [...prev, agentMsg]);
            saveChatMessage(agentMsg); 

        } catch (e: any) {
            const errorMsg: AgentMessage = { id: 'err-' + Date.now(), role: 'Director', text: "Сигнал студии прерван. Проверьте соединение.", timestamp: Date.now() };
            setMessages(prev => [...prev, errorMsg]);
            logEvent('error', 'Studio Agent Error', { error: e.message });
        } finally {
            setIsThinking(false);
        }
    };

    const processFrame = async (prompt: string) => {
        const frameId = Date.now().toString();
        const frame: StoryboardFrame = { id: frameId, prompt, status: 'generating_image' };
        
        setFrames(prev => [...prev, frame]);
        setActiveTab('monitor');
        saveStoryboardFrame(frame);
        
        try {
            // 1. Generate Image
            const b64 = await generateImage(prompt);
            const imageUrl = `data:image/jpeg;base64,${b64}`;
            
            // Update local state and DB with Image
            const frameWithImage: StoryboardFrame = { ...frame, imageUrl: imageUrl, status: 'image_ready' };
            setFrames(prev => prev.map(f => f.id === frameId ? frameWithImage : f));
            
            const savedImageParams = await saveStoryboardFrame(frameWithImage);
            
            // 2. Generate Video
            const { url } = await generateVideo({
                prompt, model: VeoModel.VEO_FAST, aspectRatio: AspectRatio.LANDSCAPE, resolution: Resolution.P720,
                mode: GenerationMode.FRAMES_TO_VIDEO, startFrame: { file: new File([], "f.jpg"), base64: b64 }
            });

            // Update local state with local URL for immediate playback
            setFrames(prev => prev.map(f => f.id === frameId ? { ...f, videoUrl: url, status: 'complete' } : f));

            // 3. Save to DB 
            const finalFrame: StoryboardFrame = { 
                ...frameWithImage, 
                imageUrl: savedImageParams?.imageUrl || imageUrl, 
                videoUrl: url, 
                status: 'complete' 
            };
            
            await saveStoryboardFrame(finalFrame);
            logEvent('info', 'Storyboard frame generated', { prompt });

        } catch (e: any) {
            setFrames(prev => prev.map(f => f.id === frameId ? { ...f, status: 'error' } : f));
            saveStoryboardFrame({ ...frame, status: 'error' });
            logEvent('error', 'Frame generation failed', { error: e.message });
        }
    };

    const activeFrame = frames[frames.length - 1];

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[500] bg-[#050505] text-white flex flex-col md:flex-row font-sans overflow-hidden">
            
            {/* LEFT PANEL: AI DIRECTOR & CHAT */}
            <div className="w-full md:w-[420px] lg:w-[480px] flex flex-col border-r border-white/5 bg-black/40 backdrop-blur-3xl relative z-10 shadow-2xl">
                {/* Header */}
                <div className="p-5 border-b border-white/5 flex items-center justify-between bg-black/60">
                    <div className="flex items-center gap-3">
                        <Activity className="w-4 h-4 text-red-600 animate-pulse" />
                        <div>
                            <span className="block text-[10px] font-black tracking-[0.2em] uppercase text-white/90">AI Режиссер</span>
                            <span className="block text-[9px] font-mono text-white/40">ОНЛАЙН • {useThinking ? 'THINKING' : 'FAST'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                         <button onClick={() => setUseThinking(!useThinking)} className={`p-2 rounded-lg transition-colors ${useThinking ? 'text-indigo-400 bg-indigo-500/10' : 'text-white/20 hover:text-white hover:bg-white/5'}`} title="Глубокое мышление">
                            <BrainCircuit size={16}/>
                         </button>
                         <div className="w-px h-4 bg-white/10 mx-1"></div>
                         <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"><X size={18}/></button>
                    </div>
                </div>

                {/* Settings Bar (Visual Style) */}
                <div className="px-5 py-3 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        {VISUAL_STYLES.map(style => (
                            <button
                                key={style}
                                onClick={() => setVisualStyle(style)}
                                className={`px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider border transition-all whitespace-nowrap ${
                                    visualStyle === style 
                                    ? 'bg-white text-black border-white' 
                                    : 'bg-transparent text-white/40 border-white/10 hover:border-white/30 hover:text-white'
                                }`}
                            >
                                {style}
                            </button>
                        ))}
                    </div>
                </div>

                {/* AI Director Interface */}
                <div className="flex-1 overflow-hidden relative">
                    <AiDirector 
                        messages={messages}
                        onSendMessage={handleSendMessage}
                        isThinking={isThinking}
                        visualStyle={visualStyle}
                    />
                </div>
            </div>

            {/* RIGHT PANEL: MONITOR & FRAMES */}
            <div className="flex-1 flex flex-col relative bg-[#020202]">
                {/* Tab Switcher */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex bg-black/60 backdrop-blur-2xl border border-white/10 rounded-full p-1 shadow-2xl">
                    <button onClick={() => setActiveTab('director')} className={`flex items-center gap-2 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'director' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white'}`}>
                        <Grid size={12} /> Консоль
                    </button>
                    <button onClick={() => setActiveTab('monitor')} className={`flex items-center gap-2 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'monitor' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white'}`}>
                        <Monitor size={12} /> Плейбек
                    </button>
                </div>

                {/* Main Viewport */}
                <div className="flex-1 flex items-center justify-center p-4 md:p-12 relative overflow-hidden">
                    {/* Background Grid Pattern */}
                    <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px'}}></div>

                    <div className="w-full max-w-5xl aspect-video bg-black rounded-[32px] overflow-hidden border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] relative group z-10">
                        <AnimatePresence mode="wait">
                            {activeFrame?.status === 'complete' ? (
                                <motion.video key="video" initial={{ opacity: 0 }} animate={{ opacity: 1 }} src={activeFrame.videoUrl} autoPlay loop muted className="w-full h-full object-contain" />
                            ) : activeFrame?.imageUrl ? (
                                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative w-full h-full">
                                    <img src={activeFrame.imageUrl} className="w-full h-full object-contain opacity-40 blur-2xl scale-110" />
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/30">
                                        <Loader2 size={48} className="animate-spin text-white/20" />
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="text-[11px] font-black tracking-[0.6em] uppercase text-white/40 animate-pulse">Рендеринг видео</span>
                                            <span className="text-[9px] font-mono text-white/20">{Resolution.P720} • VEO GEN 3</span>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-6 bg-[#080808]">
                                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                                        <Sparkles size={32} className="text-white/10" />
                                    </div>
                                    <div className="flex flex-col items-center gap-2">
                                        <span className="text-[11px] font-black tracking-[0.6em] uppercase text-white/20">Ожидание команды</span>
                                        <span className="text-[9px] font-mono text-white/10">AI DIRECTOR STANDBY</span>
                                    </div>
                                </div>
                            )}
                        </AnimatePresence>

                        {/* Monitor Overlays */}
                        <div className="absolute inset-0 pointer-events-none p-8 flex flex-col justify-between">
                            <div className="flex justify-between items-start opacity-40">
                                <div className="font-mono text-[10px] text-red-500 flex items-center gap-3 uppercase font-bold tracking-widest">
                                    <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse shadow-[0_0_10px_red]"/> 
                                    REC
                                </div>
                                <div className="font-mono text-[10px] tracking-widest uppercase border border-white/20 px-2 py-1 rounded">CAM A</div>
                            </div>
                            <div className="flex justify-between items-end opacity-30">
                                <div className="font-mono text-[10px] uppercase">TC: {new Date().toLocaleTimeString()}</div>
                                <div className="font-mono text-[10px] uppercase tracking-widest">ISO 800 • 4500K</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Frames Timeline */}
                <div className="h-44 bg-[#050505] border-t border-white/5 p-6 flex gap-4 overflow-x-auto no-scrollbar z-20">
                    {frames.map((f, i) => (
                        <div key={f.id} onClick={() => { setActiveTab('monitor'); }} className="h-full aspect-video rounded-xl bg-white/5 border border-white/10 overflow-hidden shrink-0 relative hover:scale-105 hover:border-white/30 transition-all cursor-pointer group shadow-lg">
                            {f.imageUrl && <img src={f.imageUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                <div className="flex items-center gap-2 text-white/80">
                                    <Film size={12}/>
                                    <span className="text-[8px] font-bold uppercase tracking-wider truncate w-full">{f.prompt}</span>
                                </div>
                            </div>
                            <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[8px] font-mono border border-white/10 text-white/60">SC {i+1}</div>
                        </div>
                    ))}
                    <div className="w-48 h-full rounded-xl border-2 border-dashed border-white/5 flex items-center justify-center shrink-0 hover:bg-white/5 transition-colors cursor-pointer" onClick={() => handleSendMessage("Предложи следующий кадр")}>
                        <div className="flex flex-col items-center gap-2 opacity-30">
                            <Clapperboard size={20} />
                            <span className="text-[8px] font-black uppercase tracking-widest">Новая сцена</span>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default StudioAgent;
