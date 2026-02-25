
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { AnimatePresence, motion } from 'framer-motion';
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { AspectRatio, CameoProfile, GenerateVideoParams, GenerationMode, ImageFile, Resolution, VeoModel, VideoFile } from '../types';
import { ArrowUp, Plus, Wand2, Monitor, Smartphone, X, Loader2, Video, Film, Sparkles, Eye, LayoutGrid, UserCog, Images, Search, Zap, Check, Image as ImageIcon, Trash2 } from 'lucide-react';
import { getUserProfiles, saveProfile, deleteProfile } from '../utils/db';
import { enhancePrompt, analyzeImage, generateFastPreview } from '../services/geminiService';

const BottomPromptBar: React.FC<{ onGenerate: (p: GenerateVideoParams) => void }> = ({ onGenerate }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [prompt, setPrompt] = useState('');
  
  // Live Preview State
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [livePreviewBase64, setLivePreviewBase64] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const [activeTab, setActiveTab] = useState<any>('cameo');
  const [selectedCameoIds, setSelectedCameoIds] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<VeoModel>(VeoModel.VEO_FAST);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.PORTRAIT);
  const [profiles, setProfiles] = useState<CameoProfile[]>([]);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  
  const [uploadedImage, setUploadedImage] = useState<ImageFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  // Debounced Live Preview Effect
  useEffect(() => {
    if (!isLiveMode || !prompt.trim()) {
        if (!prompt.trim()) setLivePreviewBase64(null);
        return;
    }

    const timer = setTimeout(async () => {
        setIsLoadingPreview(true);
        try {
            const b64 = await generateFastPreview(prompt);
            if (b64) setLivePreviewBase64(`data:image/jpeg;base64,${b64}`);
        } catch (e) {
            console.warn("Live preview failed", e);
        } finally {
            setIsLoadingPreview(false);
        }
    }, 800); // 800ms debounce to avoid rate limits

    return () => clearTimeout(timer);
  }, [prompt, isLiveMode]);

  const loadProfiles = () => {
      getUserProfiles().then(setProfiles);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage({
          file,
          base64: reader.result as string
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCharacterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setIsUploadingProfile(true);
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onloadend = async () => {
              const base64 = reader.result as string;
              const newProfile: CameoProfile = {
                  id: Date.now().toString(),
                  name: file.name.split('.')[0].substring(0, 12),
                  imageUrl: base64
              };
              await saveProfile(newProfile);
              await loadProfiles();
              setIsUploadingProfile(false);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleDeleteProfile = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirm('Удалить этого персонажа?')) {
          await deleteProfile(id);
          setSelectedCameoIds(prev => prev.filter(pid => pid !== id));
          loadProfiles();
      }
  };

  const removeImage = () => {
      setUploadedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!prompt.trim() && selectedCameoIds.length === 0 && !uploadedImage) return;
    
    let referenceImages: ImageFile[] | undefined = undefined;

    // Process selected characters
    if (selectedCameoIds.length > 0) {
        referenceImages = [];
        const selectedProfiles = profiles.filter(p => selectedCameoIds.includes(p.id));
        for (const p of selectedProfiles) {
            try {
                // If local base64, use directly. If URL, fetch it.
                let base64 = '';
                let type = 'image/png';
                
                if (p.imageUrl.startsWith('data:')) {
                    base64 = p.imageUrl;
                    const match = p.imageUrl.match(/data:(.*?);base64/);
                    if (match) type = match[1];
                } else {
                    const res = await fetch(p.imageUrl);
                    const blob = await res.blob();
                    type = blob.type;
                    base64 = await new Promise<string>((resolve) => {
                        const r = new FileReader();
                        r.onloadend = () => resolve(r.result as string);
                        r.readAsDataURL(blob);
                    });
                }
                
                // Create a dummy file object for ImageFile interface
                const file = new File([], p.name, { type });
                referenceImages.push({ file, base64 });
            } catch (e) {
                console.warn("Failed to process profile image", p.name);
            }
        }
    }

    let mode = uploadedImage ? GenerationMode.FRAMES_TO_VIDEO : GenerationMode.TEXT_TO_VIDEO;
    
    // Heuristic for mode
    if (uploadedImage && referenceImages && referenceImages.length > 0) {
        mode = GenerationMode.CHARACTER_REPLACEMENT;
    } else if (referenceImages && referenceImages.length > 0) {
        mode = GenerationMode.REFERENCES_TO_VIDEO;
    }

    onGenerate({
      prompt,
      model: selectedModel,
      aspectRatio,
      resolution: Resolution.P720,
      mode,
      startFrame: uploadedImage,
      referenceImages
    });

    setPrompt('');
    setUploadedImage(null);
    setSelectedCameoIds([]);
    setLivePreviewBase64(null); // Clear preview on generate
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 md:p-8 flex justify-center pointer-events-none pb-[env(safe-area-inset-bottom)]">
      <motion.div 
        layout
        className="w-full max-w-3xl glass-panel rounded-[40px] shadow-2xl pointer-events-auto overflow-visible flex flex-col p-4 md:p-6 gap-4 border border-white/10 relative"
      >
        {/* Live Preview Float Component */}
        <AnimatePresence>
            {isLiveMode && (
                <motion.div 
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                    className="absolute -top-[140px] left-0 right-0 flex justify-center pointer-events-none"
                >
                    <div className="bg-black/80 backdrop-blur-xl border border-white/10 p-2 rounded-2xl shadow-2xl relative group overflow-hidden">
                        <div className="relative w-48 aspect-video rounded-xl overflow-hidden bg-white/5 border border-white/5 flex items-center justify-center">
                            {isLoadingPreview ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
                                    <Loader2 className="animate-spin text-amber-500 w-6 h-6"/>
                                </div>
                            ) : null}
                            
                            {livePreviewBase64 ? (
                                <img src={livePreviewBase64} className="w-full h-full object-cover transition-opacity duration-300" />
                            ) : (
                                <div className="flex flex-col items-center gap-2 text-white/20">
                                    <Zap size={24} className={isLoadingPreview ? "animate-pulse" : ""} />
                                    <span className="text-[8px] uppercase font-bold tracking-widest">Live Signal...</span>
                                </div>
                            )}
                            
                            {/* Live Indicator */}
                            <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded-full border border-white/10 z-30">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]"/>
                                <span className="text-[7px] font-black uppercase text-white/80 tracking-widest">LIVE</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        <AnimatePresence>
          {isExpanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-6">
                {/* Mode Selector */}
                <div className="flex items-center justify-between">
                    <div className="flex bg-black/40 rounded-2xl p-1 gap-1 border border-white/5">
                        {['cameo', 'frames', 'v2v'].map((tab) => (
                            <button 
                                key={tab} 
                                onClick={() => setActiveTab(tab)}
                                className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/30 hover:text-white/60'}`}
                            >
                                {tab === 'cameo' ? 'Characters' : tab === 'frames' ? 'Storyboard' : 'Remix'}
                            </button>
                        ))}
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <select 
                            value={selectedModel} 
                            onChange={e => setSelectedModel(e.target.value as any)} 
                            className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white/60 focus:outline-none"
                        >
                            <option value={VeoModel.VEO_FAST}>Veo 3.1 Fast</option>
                            <option value={VeoModel.VEO_31}>Veo 3.1 Pro</option>
                        </select>
                        <button onClick={() => setAspectRatio(aspectRatio === AspectRatio.LANDSCAPE ? AspectRatio.PORTRAIT : AspectRatio.LANDSCAPE)} className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-white/40 hover:text-white transition-all">
                             {aspectRatio === AspectRatio.LANDSCAPE ? <Monitor size={14}/> : <Smartphone size={14}/>}
                        </button>
                    </div>
                </div>

                {/* Profile Grid (if cameo active) */}
                {activeTab === 'cameo' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Мои персонажи</span>
                            <span className="text-[10px] font-mono text-white/20">{selectedCameoIds.length} выбрано</span>
                        </div>
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                             <label className={`w-16 h-16 rounded-2xl border-2 border-dashed flex items-center justify-center shrink-0 cursor-pointer transition-all group relative overflow-hidden ${isUploadingProfile ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 hover:bg-white/5 hover:border-white/30'}`}>
                                <input type="file" className="hidden" accept="image/*" onChange={handleCharacterUpload} disabled={isUploadingProfile} />
                                {isUploadingProfile ? (
                                    <Loader2 className="animate-spin text-indigo-400" />
                                ) : (
                                    <div className="flex flex-col items-center gap-1">
                                        <Plus className="text-white/20 group-hover:text-white transition-colors" size={20} />
                                        <span className="text-[8px] font-bold text-white/30 uppercase">Add New</span>
                                    </div>
                                )}
                             </label>
                             
                             {profiles.map(p => (
                                 <button 
                                    key={p.id} 
                                    onClick={() => setSelectedCameoIds(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])} 
                                    className={`relative w-16 h-16 rounded-2xl overflow-hidden shrink-0 border-2 transition-all group ${selectedCameoIds.includes(p.id) ? 'border-indigo-500 scale-105 shadow-lg shadow-indigo-500/30' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                 >
                                    <img src={p.imageUrl} className="w-full h-full object-cover" loading="lazy" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-[8px] font-bold text-white truncate w-full text-center">{p.name}</span>
                                    </div>
                                    {selectedCameoIds.includes(p.id) && (
                                        <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center backdrop-blur-[1px]">
                                            <Check size={24} className="text-white drop-shadow-lg" strokeWidth={3} />
                                        </div>
                                    )}
                                    {/* Delete Button (visible on hover) */}
                                    <div 
                                        className="absolute top-1 right-1 p-1 rounded-full bg-black/60 hover:bg-red-500/80 text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition-all z-10"
                                        onClick={(e) => handleDeleteProfile(p.id, e)}
                                    >
                                        <Trash2 size={10} />
                                    </div>
                                 </button>
                             ))}
                        </div>
                    </div>
                )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-3">
          <div className="flex-1 relative glass-panel bg-white/5 border border-white/10 rounded-[32px] group focus-within:border-indigo-500/50 transition-all overflow-hidden">
            {uploadedImage && (
                <div className="mx-5 mt-4 relative w-24 h-16 rounded-lg overflow-hidden border border-white/20 group shrink-0">
                    <img src={uploadedImage.base64} className="w-full h-full object-cover" />
                    <button 
                        onClick={removeImage}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <X size={16} className="text-white" />
                    </button>
                </div>
            )}
            
            <textarea 
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Опишите ваше кинематографическое видение..."
              className="w-full bg-transparent p-5 pr-14 text-sm font-medium text-white placeholder:text-white/20 resize-none max-h-40 min-h-[60px] focus:outline-none"
              rows={1}
            />
            
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleImageUpload} 
            />

            <div className="absolute right-3 bottom-3 flex items-center gap-2">
                <button 
                    onClick={() => setIsLiveMode(!isLiveMode)}
                    className={`p-2 rounded-2xl transition-all ${isLiveMode ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'text-white/20 hover:text-amber-400 hover:bg-white/5'}`}
                    title="Live Preview Mode"
                >
                   <Zap size={18} className={isLiveMode ? "fill-current" : ""} />
                </button>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-2 rounded-2xl transition-all ${uploadedImage ? 'text-indigo-400 bg-indigo-500/10' : 'text-white/20 hover:text-white hover:bg-white/5'}`}
                    title="Загрузить референс (Start Frame)"
                >
                   <ImageIcon size={18} />
                </button>
                <button 
                  onClick={async () => { setIsEnhancing(true); const e = await enhancePrompt(prompt); setPrompt(e); setIsEnhancing(false); }}
                  className={`p-2 rounded-2xl transition-all ${isEnhancing ? 'bg-indigo-500 text-white animate-pulse' : 'text-white/20 hover:text-indigo-400 hover:bg-white/5'}`}
                >
                   <Sparkles size={18} />
                </button>
                <button onClick={() => setIsExpanded(!isExpanded)} className={`p-2 rounded-2xl text-white/20 hover:text-white hover:bg-white/5 transition-all ${isExpanded ? 'rotate-180' : ''}`}>
                   <Wand2 size={18} />
                </button>
            </div>
          </div>
          <button 
            onClick={handleSubmit}
            disabled={!prompt.trim() && selectedCameoIds.length === 0 && !uploadedImage}
            className="w-14 h-14 md:w-16 md:h-16 rounded-[28px] bg-white text-black flex items-center justify-center shadow-2xl shadow-white/10 hover:scale-105 active:scale-90 disabled:opacity-20 transition-all shrink-0"
          >
             <ArrowUp size={28} />
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default BottomPromptBar;
