
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { AnimatePresence, motion } from 'framer-motion';
import React, { useCallback, useEffect, useState } from 'react';
import ApiKeyDialog from './components/ApiKeyDialog';
import BottomPromptBar from './components/BottomPromptBar';
import VideoCard from './components/VideoCard';
import SettingsDrawer from './components/SettingsDrawer';
import StudioAgent from './components/StudioAgent';
import { generateVideo, editImage, generateCharacterReplacement } from './services/geminiService';
import { healer } from './services/healerService';
import { FeedPost, GenerateVideoParams, PostStatus, GenerationMode, AspectRatio, Resolution } from './types';
import { Clapperboard, Menu, Sparkles, Activity, AlertCircle, CheckCircle2, ChevronRight, Layout } from 'lucide-react';
import { getAllPosts, savePost, deletePost, logEvent } from './utils/db';

const App: React.FC = () => {
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'error' | 'success'} | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStudioOpen, setIsStudioOpen] = useState(true);
  
  const [theme, setTheme] = useState('obsidian');
  const [previewTheme, setPreviewTheme] = useState<string | null>(null);
  const activeTheme = previewTheme || theme;

  useEffect(() => {
    const checkKeySelection = async () => {
      const aistudio = (window as any).aistudio;
      if (aistudio) {
        const hasKey = await aistudio.hasSelectedApiKey();
        if (!hasKey && !process.env.API_KEY) {
          setShowKeyDialog(true);
        }
      } else if (!process.env.API_KEY) {
        setShowKeyDialog(true);
      }
    };
    
    checkKeySelection();
    
    getAllPosts().then(posts => {
        setFeed(posts || []);
    });
  }, []);

  const showToast = (msg: string, type: 'error' | 'success' = 'success') => {
      setToast({ msg, type });
      setTimeout(() => setToast(null), 4000);
  };

  const handleGenerate = useCallback(async (params: GenerateVideoParams) => {
    const id = Date.now().toString();
    const newPost: FeedPost = {
      id,
      username: 'Студия_Ядро',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Studio',
      description: params.mode === GenerationMode.CHARACTER_REPLACEMENT ? 'Замена персонажа...' : params.prompt,
      modelTag: params.model.split('-')[1].toUpperCase(),
      status: PostStatus.GENERATING,
      referenceImageBase64: params.startFrame?.base64,
      aspectRatio: params.aspectRatio,
      resolution: params.resolution,
      originalParams: params
    };

    setFeed(prev => [newPost, ...prev]);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
        let result;
        if (params.mode === GenerationMode.IMAGE_EDIT_TO_VIDEO && params.startFrame) {
            const editedB64 = await editImage(params.startFrame.base64, params.startFrame.file.type, params.prompt);
            result = await generateVideo({ ...params, startFrame: { ...params.startFrame, base64: editedB64 } });
        } else if (params.mode === GenerationMode.CHARACTER_REPLACEMENT) {
            result = await generateCharacterReplacement(params, (status) => {
                showToast(status, 'success');
            });
        } else {
            result = await generateVideo(params);
        }

        const update = { videoUrl: result.url, status: PostStatus.SUCCESS };
        setFeed(prev => prev.map(p => p.id === id ? { ...p, ...update } : p));
        savePost({ ...newPost, ...update }, result.blob);
        showToast("Кинематографичный кадр готов.");
    } catch (e: any) {
        console.warn("Generation API Error Detailed:", e);
        
        let errorMessage = e.message || "Неизвестная ошибка";
        const lowerMsg = errorMessage.toLowerCase();
        let isAuthError = false;

        // Enhanced Error Handling
        if (lowerMsg.includes('400') || lowerMsg.includes('invalid argument')) {
             errorMessage = "Ошибка 400 (Bad Request): Промпт может нарушать политики безопасности или параметры невалидны.";
        } else if (lowerMsg.includes('401') || lowerMsg.includes('unauthenticated')) {
             errorMessage = "Ошибка 401 (Unauthorized): Неверный API ключ. Пожалуйста, проверьте настройки.";
             isAuthError = true;
        } else if (lowerMsg.includes('403') || lowerMsg.includes('permission denied')) {
             errorMessage = "Ошибка 403 (Forbidden): Доступ запрещен. Убедитесь, что Veo API включен в Google Cloud Console.";
             isAuthError = true;
        } else if (lowerMsg.includes('404') || lowerMsg.includes('not found')) {
             errorMessage = "Ошибка 404 (Not Found): Модель недоступна. Проверьте регион проекта Google Cloud.";
        } else if (lowerMsg.includes('429') || lowerMsg.includes('quota') || lowerMsg.includes('resource exhausted')) {
             errorMessage = "Ошибка 429 (Quota Exceeded): Лимит запросов исчерпан. Подождите минуту или увеличьте квоты.";
        } else if (lowerMsg.includes('500') || lowerMsg.includes('internal')) {
             errorMessage = "Ошибка 500: Внутренняя ошибка сервера Google. Повторите попытку позже.";
        } else if (lowerMsg.includes('billing') || lowerMsg.includes('project not linked')) {
             errorMessage = "Ошибка Биллинга: Проект не привязан к платежному аккаунту. Veo требует платного доступа.";
             isAuthError = true;
        } else if (lowerMsg.includes('safety') || lowerMsg.includes('blocked')) {
             errorMessage = "Ошибка Безопасности: Запрос заблокирован фильтрами контента.";
        }

        if (isAuthError) {
             setTimeout(() => setShowKeyDialog(true), 2500);
        }

        setFeed(prev => prev.map(p => p.id === id ? { ...p, status: PostStatus.ERROR, errorMessage } : p));
        showToast(errorMessage, 'error');
        
        logEvent('error', 'Generation failed', { error: e.message, code: isAuthError ? 'AUTH_ERROR' : 'API_ERROR' });
        healer.reportError(e);
    }
  }, []);

  const handleUpgrade = useCallback(async (post: FeedPost) => {
    if (!post.originalParams) return;
    setFeed(prev => prev.map(p => p.id === post.id ? { ...p, status: PostStatus.UPGRADING } : p));
    showToast("Улучшение до 1080p Master...", "success");

    try {
        const result = await generateVideo({ ...post.originalParams, resolution: Resolution.P1080 });
        const update = { videoUrl: result.url, status: PostStatus.SUCCESS, resolution: Resolution.P1080 };
        setFeed(prev => prev.map(p => p.id === post.id ? { ...p, ...update } : p));
        savePost({ ...post, ...update }, result.blob);
        showToast("Улучшение до 1080p завершено.", "success");
    } catch (e: any) {
        console.warn("Upgrade API Error Detailed:", e);
        
        let errorMessage = e.message || "Ошибка улучшения";
        const lowerMsg = errorMessage.toLowerCase();
        let isAuthError = false;
        
        if (lowerMsg.includes('400') || lowerMsg.includes('invalid argument')) {
             errorMessage = "Ошибка 400: Неверные параметры улучшения. Проверьте валидность промпта.";
        } else if (lowerMsg.includes('401') || lowerMsg.includes('unauthenticated')) {
             errorMessage = "Ошибка 401: Неверный API ключ. Требуется повторная авторизация.";
             isAuthError = true;
        } else if (lowerMsg.includes('403') || lowerMsg.includes('permission denied')) {
             errorMessage = "Ошибка 403: Доступ запрещен. Проверьте настройки API и включен ли Veo в проекте.";
             isAuthError = true;
        } else if (lowerMsg.includes('404') || lowerMsg.includes('not found')) {
             errorMessage = "Ошибка 404: Ресурс или модель не найдены.";
        } else if (lowerMsg.includes('429') || lowerMsg.includes('quota') || lowerMsg.includes('resource exhausted')) {
             errorMessage = "Ошибка 429: Лимит квот исчерпан. Пожалуйста, подождите или проверьте лимиты в консоли.";
        } else if (lowerMsg.includes('500') || lowerMsg.includes('internal')) {
             errorMessage = "Ошибка 500: Внутренняя ошибка сервера Google.";
        } else if (lowerMsg.includes('billing') || lowerMsg.includes('project not linked')) {
             errorMessage = "Ошибка биллинга: Для использования Veo требуется платный аккаунт с привязанной картой.";
             isAuthError = true;
        }

        if (isAuthError) {
             setTimeout(() => setShowKeyDialog(true), 2500);
        }

        // Revert to SUCCESS status (keeping the old video) but show the error
        setFeed(prev => prev.map(p => p.id === post.id ? { ...p, status: PostStatus.SUCCESS } : p)); 
        showToast(errorMessage, "error");
        
        // Log to systems
        logEvent('error', 'Upgrade failed', { error: e.message, code: isAuthError ? 'AUTH_ERROR' : 'API_ERROR' });
        healer.reportError(e);
    }
  }, []);

  const handleRegenerate = useCallback((post: FeedPost) => {
      if (!post.originalParams) return;
      handleGenerate(post.originalParams);
      showToast("Запущен повтор генерации...", "success");
  }, [handleGenerate]);

  const handleDelete = useCallback(async (id: string) => {
      try {
          await deletePost(id);
          setFeed(prev => prev.filter(p => p.id !== id));
          showToast("Видео удалено", "success");
      } catch (e) {
          showToast("Ошибка при удалении", "error");
      }
  }, []);

  return (
    <div className={`h-[100dvh] w-screen flex flex-col overflow-hidden font-sans selection:bg-indigo-500/30 ${activeTheme}`} data-theme={activeTheme} style={{ backgroundColor: 'var(--theme-bg)' }}>
      <AnimatePresence>{showKeyDialog && <ApiKeyDialog onContinue={() => setShowKeyDialog(false)} />}</AnimatePresence>
      <SettingsDrawer 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        currentTheme={activeTheme} 
        onThemeChange={setTheme}
        onThemePreview={setPreviewTheme}
      />
      <AnimatePresence>{isStudioOpen && <StudioAgent onClose={() => setIsStudioOpen(false)} />}</AnimatePresence>
      
      <AnimatePresence>
        {toast && (
            <motion.div initial={{ opacity: 0, y: -40, scale: 0.9 }} animate={{ opacity: 1, y: 30, scale: 1 }} exit={{ opacity: 0, y: -40, scale: 0.9 }} className="fixed top-0 left-1/2 -translate-x-1/2 z-[300] px-6 py-4 rounded-3xl bg-neutral-900 border border-white/10 backdrop-blur-3xl shadow-2xl flex items-center gap-4">
                {toast.type === 'error' ? <AlertCircle className="text-red-500 w-5 h-5"/> : <CheckCircle2 className="text-green-500 w-5 h-5"/>}
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/80">{toast.msg}</span>
            </motion.div>
        )}
      </AnimatePresence>
      
      <main className="flex-1 h-full relative overflow-y-auto no-scrollbar pb-40">
        <header className="sticky top-0 z-40 w-full px-4 py-3 md:px-8 md:py-6 flex items-center justify-between glass-panel transition-all duration-300">
            <div className="flex items-center gap-4 md:gap-8">
                <button onClick={() => setIsSettingsOpen(true)} className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white/60 hover:text-white active:scale-90"><Menu size={20}/></button>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/20 rotate-3 group hover:rotate-0 transition-transform">
                        <Clapperboard className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="font-black text-xl md:text-2xl tracking-tighter text-white uppercase italic leading-none">БЕЗ ТРЕВОГ</h1>
                        <span className="text-[8px] font-bold text-indigo-400 tracking-[0.4em] uppercase mt-1">Cinematic Lab</span>
                    </div>
                </div>
            </div>

            <nav className="hidden lg:flex items-center gap-2 bg-white/5 rounded-2xl p-1.5 border border-white/5">
                {['Галерея', 'Студия', 'Персонажи'].map((item) => (
                    <button key={item} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${item === 'Галерея' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}>{item}</button>
                ))}
            </nav>

            <div className="flex items-center gap-2 md:gap-4">
                <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                    <Activity size={12} className="text-indigo-400 animate-pulse"/>
                    <span className="text-[10px] font-black text-indigo-400/80 uppercase tracking-widest">Master 1080p Online</span>
                </div>
                <button onClick={() => setIsStudioOpen(true)} className="flex items-center gap-2.5 px-5 py-2.5 md:px-7 md:py-3.5 rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-white/10">
                    <Sparkles size={16} className="text-indigo-600" />
                    <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">Создать шедевр</span>
                </button>
            </div>
        </header>

        <div className="max-w-[1920px] mx-auto p-4 md:p-8 lg:p-12">
          {/* Section Title */}
          <div className="flex items-center justify-between mb-8 md:mb-12">
              <div className="flex items-center gap-4">
                  <div className="w-1.5 h-8 bg-red-600 rounded-full" />
                  <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter">Недавние работы</h2>
              </div>
              <div className="flex items-center gap-2 text-white/20">
                  <Layout size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Сетка: Динамическая</span>
              </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 md:gap-8 lg:gap-10">
            <AnimatePresence mode="popLayout">
              {feed.map(post => (
                <VideoCard 
                  key={post.id} 
                  post={post} 
                  onUpgrade={() => handleUpgrade(post)}
                  onRegenerate={() => handleRegenerate(post)}
                  onDelete={() => handleDelete(post.id)}
                />
              ))}
              {feed.length === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full h-[50vh] flex flex-col items-center justify-center">
                      <div className="relative mb-8">
                          <Clapperboard size={120} className="text-white/[0.03]" />
                          <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/10 w-16 h-16 animate-pulse" />
                      </div>
                      <h3 className="text-2xl font-black uppercase tracking-super-wide text-white/20">Лаборатория пуста</h3>
                      <p className="text-[10px] font-bold text-white/10 uppercase mt-4 tracking-widest">Ожидание первого промпта...</p>
                  </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <BottomPromptBar onGenerate={handleGenerate} />
    </div>
  );
};

export default App;
