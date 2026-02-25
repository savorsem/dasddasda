
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import React, { useRef, useState, useEffect } from 'react';
import { FeedPost, PostStatus, VideoFilters, AspectRatio, Resolution } from '../types';
import { VeoLogo } from './icons';
import { AlertCircle, Download, SlidersHorizontal, Check, X, Play, Pause, Loader2, ChevronUp, Sparkles, RefreshCw, Trash2, Maximize2 } from 'lucide-react';

interface VideoCardProps {
  post: FeedPost;
  onUpdate?: (post: FeedPost) => void;
  onUpgrade?: () => void;
  onRegenerate?: () => void;
  onDelete?: () => void;
}

const VideoCard: React.FC<VideoCardProps> = ({ post, onUpgrade, onRegenerate, onDelete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [progress, setProgress] = useState(0);

  const status = post.status ?? PostStatus.SUCCESS;
  const isLandscape = post.aspectRatio === AspectRatio.LANDSCAPE;

  // Swipe logic
  const x = useMotionValue(0);
  const xDrag = useTransform(x, [-100, 0], [1, 0]);

  useEffect(() => {
    if (status === PostStatus.GENERATING || status === PostStatus.UPGRADING) {
        setProgress(5);
        const interval = setInterval(() => {
            setProgress(prev => prev >= 98 ? 98 : prev + Math.random() * 2);
        }, 800);
        return () => clearInterval(interval);
    }
  }, [status]);

  const resetControlsTimeout = () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (!isConfirmingDelete) {
          controlsTimeoutRef.current = setTimeout(() => setShowUI(false), 3000);
      }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!post.videoUrl) return;
    const a = document.createElement('a');
    a.href = post.videoUrl;
    a.download = `veo-master-${post.id}.mp4`;
    a.click();
  };

  const renderStatus = () => {
    if (status === PostStatus.GENERATING || status === PostStatus.UPGRADING) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-20">
          <div className="absolute inset-0 bg-indigo-500/5 shimmer opacity-20" />
          <div className="relative z-10 w-full px-12 space-y-8 flex flex-col items-center">
            <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center relative">
                <div className="absolute inset-[-4px] rounded-[36px] border-t-2 border-indigo-500 animate-spin" />
                <VeoLogo className="w-8 h-8 text-white opacity-80" />
            </div>
            
            <div className="w-full space-y-3">
              <div className="flex justify-between items-end">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 animate-pulse">
                      {status === PostStatus.UPGRADING ? 'Upgrading' : 'Processing'}
                  </span>
                  <span className="text-[10px] font-mono text-white/30">{Math.round(progress)}%</span>
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div className="h-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]" animate={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        </div>
      );
    }
    if (status === PostStatus.ERROR) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/20 backdrop-blur-3xl p-8 text-center z-20">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4 opacity-50" />
          <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-red-400 mb-2">Engine Error</h4>
          <p className="text-[11px] text-white/40 leading-relaxed font-medium">{post.errorMessage || "Unexpected signal loss"}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`relative ${isLandscape ? 'sm:col-span-2' : ''}`}>
      {/* Background delete action */}
      <div className="absolute inset-0 rounded-[40px] bg-red-600 flex items-center justify-end px-12 z-0">
          <Trash2 className="text-white w-8 h-8" />
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={0.05}
        onDragEnd={(_, info) => info.offset.x < -60 && setIsConfirmingDelete(true)}
        style={{ x }}
        className={`relative w-full h-full rounded-[40px] overflow-hidden bg-[#0a0a0a] border border-white/5 shadow-2xl z-10 group transition-all duration-500 ${isLandscape ? 'aspect-video' : 'aspect-[9/16]'}`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        onMouseEnter={() => setShowUI(true)}
        onMouseLeave={() => resetControlsTimeout()}
      >
        <div className="absolute inset-0">
          {renderStatus()}
          
          {status === PostStatus.SUCCESS && (
            <div className="w-full h-full relative cursor-pointer" onClick={() => setIsPlaying(!isPlaying)}>
              <video
                ref={videoRef}
                src={post.videoUrl}
                className="w-full h-full object-cover transition-transform duration-[20s] ease-linear group-hover:scale-105"
                loop autoPlay muted playsInline
                onCanPlay={() => setIsVideoLoaded(true)}
              />
              
              <AnimatePresence>
                {!isVideoLoaded && (
                    <motion.div exit={{ opacity: 0 }} className="absolute inset-0 bg-black flex items-center justify-center z-10">
                        {post.referenceImageBase64 ? (
                            <img src={`data:image/png;base64,${post.referenceImageBase64}`} className="w-full h-full object-cover opacity-50 blur-sm" />
                        ) : <div className="shimmer absolute inset-0 opacity-20" />}
                        <Loader2 className="w-10 h-10 text-white/10 animate-spin" />
                    </motion.div>
                )}
              </AnimatePresence>

              {/* Resolution Badge */}
              <div className={`absolute top-6 right-6 flex items-center gap-3 glass-panel px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-opacity duration-500 ${showUI ? 'opacity-100' : 'opacity-0'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${post.resolution === Resolution.P1080 ? 'bg-indigo-400 animate-pulse' : 'bg-white/40'}`} />
                {post.resolution === Resolution.P1080 ? <span className="text-indigo-400">Master 1080p</span> : 'Preview 720p'}
              </div>

              {/* Bottom Info Overlay */}
              <div className={`absolute bottom-0 inset-x-0 p-8 flex items-end justify-between bg-gradient-to-t from-black/90 via-black/30 to-transparent transition-all duration-700 ${showUI ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <div className="flex-1 max-w-[70%]">
                    <div className="flex items-center gap-3 mb-3">
                        <img src={post.avatarUrl} className="w-8 h-8 rounded-full border border-white/20 shadow-lg" />
                        <span className="text-[11px] font-black uppercase tracking-widest text-white/90">Director AI</span>
                    </div>
                    <p className="text-sm font-medium text-white leading-relaxed line-clamp-2 drop-shadow-md">
                        {post.description}
                    </p>
                </div>
                
                <div className="flex flex-col gap-4">
                    {post.resolution !== Resolution.P1080 && onUpgrade && (
                        <button onClick={(e) => { e.stopPropagation(); onUpgrade(); }} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-indigo-600 text-white hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 group/btn">
                            <ChevronUp className="w-6 h-6 group-hover:-translate-y-1 transition-transform" />
                        </button>
                    )}
                    <button onClick={handleDownload} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all backdrop-blur-xl">
                        <Download size={20} />
                    </button>
                    <button className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all backdrop-blur-xl">
                        <Maximize2 size={18} />
                    </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Delete Confirmation */}
        <AnimatePresence>
          {isConfirmingDelete && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-red-950/95 backdrop-blur-2xl z-50 flex flex-col items-center justify-center p-10 text-center">
              <div className="w-20 h-20 rounded-full bg-red-600/10 flex items-center justify-center mb-6">
                <Trash2 className="w-10 h-10 text-red-500 animate-bounce" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tighter mb-2">Удалить из архива?</h3>
              <p className="text-[11px] text-white/40 uppercase tracking-widest mb-8 font-bold">This operation is permanent</p>
              <div className="flex gap-4 w-full">
                <button onClick={() => setIsConfirmingDelete(false)} className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest">Отмена</button>
                <button onClick={() => { onDelete?.(); setIsConfirmingDelete(false); }} className="flex-1 py-4 rounded-2xl bg-red-600 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-red-600/20">Удалить</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default VideoCard;
