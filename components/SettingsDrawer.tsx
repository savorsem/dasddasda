
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, Palette, Settings, Zap, Key, Server, Database, ShieldCheck, HeartPulse, Plug2, Save, Cloud, Terminal, Sun, Moon, Loader2, Bug, Check } from 'lucide-react';
import { testApiConnection } from '../services/geminiService';
import { healer } from '../services/healerService';
import { SystemHealth, GlobalSettings, HealerLog } from '../types';
import { syncUserSettings, logEvent } from '../utils/db';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: string;
  onThemeChange: (theme: string) => void;
  onThemePreview: (theme: string | null) => void;
}

type SettingsTab = 'system' | 'integrations' | 'healer' | 'logs';

const themePreviews = [
  { 
    id: 'obsidian', 
    label: 'Obsidian', 
    colors: { bg: '#000000', surface: '#111111', accent: '#ffffff', text: '#ffffff' } 
  },
  { 
    id: 'light', 
    label: 'Light', 
    colors: { bg: '#f2f2f7', surface: '#ffffff', accent: '#007aff', text: '#1d1d1f' } 
  },
  { 
    id: 'neon', 
    label: 'Neon', 
    colors: { bg: '#030014', surface: '#0a0a1f', accent: '#00f3ff', text: '#ffffff' } 
  },
  { 
    id: 'sunset', 
    label: 'Sunset', 
    colors: { bg: '#1a0505', surface: '#2a1010', accent: '#ff8c42', text: '#ffffff' } 
  },
];

const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ isOpen, onClose, currentTheme, onThemeChange, onThemePreview }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('system');
  const [settings, setSettings] = useState<GlobalSettings>({
      theme: currentTheme,
      integrations: {
          customProxyUrl: '',
          elevenLabsKey: '',
          midjourneyKey: '',
          runwayKey: ''
      },
      autoHeal: true,
      syncToSupabase: true,
      debugMode: false
  });

  const [health, setHealth] = useState<SystemHealth>(healer.getStatus());
  const [realLogs, setRealLogs] = useState<HealerLog[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'ok' | 'fail'>('idle');

  // Load initial settings
  useEffect(() => {
    const saved = localStorage.getItem('global_settings');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            setSettings(parsed);
            // If theme in saved settings differs from current prop (init), update app
            if (parsed.theme && parsed.theme !== currentTheme) {
                onThemeChange(parsed.theme);
            }
        } catch (e) { console.error("Settings parse error", e); }
    }
  }, []);

  // Subscribe to Healer
  useEffect(() => {
      const unsub = healer.subscribe(setHealth);
      return unsub;
  }, []);

  // Poll for logs if debug mode is active and we are on logs tab
  useEffect(() => {
      if (activeTab === 'logs' && settings.debugMode) {
          setRealLogs(healer.getLogs()); // Immediate
          const interval = setInterval(() => {
              setRealLogs([...healer.getLogs()]); // Force refresh
          }, 1000);
          return () => clearInterval(interval);
      }
  }, [activeTab, settings.debugMode]);

  // Auto-save on change
  useEffect(() => {
      const newSettings = { ...settings, theme: currentTheme };
      localStorage.setItem('global_settings', JSON.stringify(newSettings));
      if (settings.syncToSupabase) {
          syncUserSettings(newSettings).catch(console.error);
      }
  }, [settings, currentTheme]);

  const handleIntegrationChange = (key: keyof typeof settings.integrations, value: string) => {
      setSettings(prev => ({
          ...prev,
          integrations: { ...prev.integrations, [key]: value }
      }));
  };

  const runDiagnostics = async () => {
      setTestResult('idle');
      const ok = await testApiConnection();
      setTestResult(ok ? 'ok' : 'fail');
      if (!ok) healer.reportError("API Connection Failed during diagnostics");
      else if (settings.debugMode) healer.addLog('info', 'Diagnostics passed');
  };

  const forceHeal = async () => {
      await healer.attemptAutoHeal();
  };

  const renderContent = () => {
      switch (activeTab) {
          case 'system':
              return (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                      <section className="space-y-4">
                          <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-white/30"><Palette size={14}/> Интерфейс</div>
                          <div className="grid grid-cols-2 gap-4">
                              {themePreviews.map(t => {
                                  const isActive = currentTheme === t.id;
                                  return (
                                    <button 
                                        key={t.id} 
                                        onClick={() => onThemeChange(t.id)}
                                        onMouseEnter={() => onThemePreview(t.id)}
                                        onMouseLeave={() => onThemePreview(null)}
                                        className={`group relative rounded-2xl border-2 transition-all overflow-hidden text-left flex flex-col shadow-lg hover:scale-[1.02] active:scale-95 duration-200 ${isActive ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-transparent hover:border-white/10'}`}
                                        style={{ backgroundColor: t.colors.bg }}
                                    >
                                        {/* Theme Visual Preview (Mini Mockup) */}
                                        <div className="relative w-full h-24 p-3 flex gap-2 overflow-hidden">
                                            {/* Sidebar Mock */}
                                            <div className="w-1/4 h-full rounded-lg opacity-80" style={{ backgroundColor: t.colors.surface }}></div>
                                            {/* Content Mock */}
                                            <div className="flex-1 flex flex-col gap-2">
                                                <div className="w-full h-1/2 rounded-lg opacity-50 border border-white/5" style={{ backgroundColor: t.colors.surface }}></div>
                                                <div className="flex gap-2">
                                                     <div className="w-8 h-8 rounded-full" style={{ backgroundColor: t.colors.accent }}></div>
                                                     <div className="flex-1 h-2 rounded-full mt-3 opacity-20" style={{ backgroundColor: t.colors.text }}></div>
                                                </div>
                                            </div>
                                            
                                            {/* Active Checkmark Overlay */}
                                            {isActive && (
                                                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center shadow-lg">
                                                    <Check size={12} className="text-white" strokeWidth={4} />
                                                </div>
                                            )}
                                        </div>

                                        {/* Label */}
                                        <div className="px-3 py-3 border-t border-white/5 bg-black/5 backdrop-blur-sm flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-widest transition-colors" style={{ color: isActive ? t.colors.accent : t.colors.text, opacity: isActive ? 1 : 0.6 }}>
                                                {t.label}
                                            </span>
                                            {t.id === 'light' ? <Sun size={12} style={{ color: t.colors.text, opacity: 0.5 }}/> : <Moon size={12} style={{ color: t.colors.text, opacity: 0.5 }}/>}
                                        </div>
                                    </button>
                                  );
                              })}
                          </div>
                      </section>
                      <section className="space-y-4">
                          <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-white/30"><Database size={14}/> Данные и Синхронизация</div>
                          <div className="bg-white/5 rounded-2xl p-4 space-y-4 border border-white/5">
                              <div className="flex items-center justify-between">
                                  <span className="text-xs text-white/80 font-medium">Облако Supabase</span>
                                  <button onClick={() => setSettings(s => ({...s, syncToSupabase: !s.syncToSupabase}))} className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-colors ${settings.syncToSupabase ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                      {settings.syncToSupabase ? 'АКТИВНО' : 'ОТКЛЮЧЕНО'}
                                  </button>
                              </div>
                              <div className="flex items-center justify-between">
                                  <span className="text-xs text-white/80 font-medium">Debug Mode (Logs)</span>
                                  <button onClick={() => setSettings({...settings, debugMode: !settings.debugMode})} className={`w-8 h-4 rounded-full p-0.5 transition-colors ${settings.debugMode ? 'bg-indigo-500' : 'bg-white/10'}`}>
                                      <div className={`w-3 h-3 rounded-full bg-white transition-transform ${settings.debugMode ? 'translate-x-4' : ''}`} />
                                  </button>
                              </div>
                              <div className="w-full h-px bg-white/5" />
                              <div className="flex items-center justify-between">
                                  <span className="text-xs text-white/80 font-medium">Локальное хранилище</span>
                                  <button onClick={() => confirm('Очистить кэш?') && localStorage.clear()} className="text-[9px] text-red-400 hover:text-red-300 uppercase font-bold">Очистить</button>
                              </div>
                              <button 
                                onClick={async () => { setIsSyncing(true); await syncUserSettings(settings); setTimeout(() => setIsSyncing(false), 1000); }} 
                                disabled={isSyncing}
                                className="w-full py-2 bg-indigo-600 rounded-lg text-white text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20"
                              >
                                  {isSyncing ? <Loader2 className="animate-spin w-3 h-3"/> : <Cloud size={12} />}
                                  Синхронизировать принудительно
                              </button>
                          </div>
                      </section>
                  </div>
              );
          case 'integrations':
              return (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[10px] leading-relaxed">
                          Интеграции расширяют возможности студии. Ключи сохраняются локально в зашифрованном виде.
                      </div>
                      
                      <div className="space-y-4">
                          <div className="space-y-2">
                              <label className="text-[9px] uppercase font-black text-white/30 flex items-center gap-2"><Server size={10}/> Custom Proxy URL</label>
                              <input 
                                type="text" 
                                value={settings.integrations.customProxyUrl} 
                                onChange={e => handleIntegrationChange('customProxyUrl', e.target.value)} 
                                placeholder="https://api.proxy.com/v1" 
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-indigo-500 outline-none transition-all font-mono placeholder:text-white/20" 
                              />
                          </div>
                          
                          <div className="w-full h-px bg-white/5 my-4"/>

                          <div className="space-y-2">
                              <label className="text-[9px] uppercase font-black text-white/30 flex items-center gap-2"><Plug2 size={10}/> ElevenLabs API Key (Voice)</label>
                              <input 
                                type="password" 
                                value={settings.integrations.elevenLabsKey} 
                                onChange={e => handleIntegrationChange('elevenLabsKey', e.target.value)} 
                                placeholder="sk_..." 
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-indigo-500 outline-none transition-all font-mono placeholder:text-white/20" 
                              />
                          </div>

                          <div className="space-y-2">
                              <label className="text-[9px] uppercase font-black text-white/30 flex items-center gap-2"><Plug2 size={10}/> Midjourney API Key (Image)</label>
                              <input 
                                type="password" 
                                value={settings.integrations.midjourneyKey} 
                                onChange={e => handleIntegrationChange('midjourneyKey', e.target.value)} 
                                placeholder="mj_..." 
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-indigo-500 outline-none transition-all font-mono placeholder:text-white/20" 
                              />
                          </div>
                      </div>
                  </div>
              );
          case 'healer':
              return (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className={`p-6 rounded-3xl border flex items-center justify-between ${health.status === 'healthy' ? 'bg-green-500/5 border-green-500/20' : health.status === 'critical' ? 'bg-red-500/10 border-red-500/30' : 'bg-yellow-500/5 border-yellow-500/20'}`}>
                          <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Состояние системы</p>
                              <p className={`text-2xl font-black uppercase ${health.status === 'healthy' ? 'text-green-400' : health.status === 'critical' ? 'text-red-400' : 'text-yellow-400'}`}>
                                  {health.status === 'healthy' ? 'СТАБИЛЬНО' : health.status === 'critical' ? 'КРИТИЧЕСКОЕ' : 'ВНИМАНИЕ'}
                              </p>
                          </div>
                          <HeartPulse size={32} className={`${health.status === 'healthy' ? 'text-green-500' : 'text-red-500'} animate-pulse`} />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                              <span className="text-[9px] text-white/30 uppercase font-bold block mb-2">Активные ошибки</span>
                              <span className="text-xl font-mono">{health.activeErrors}</span>
                          </div>
                          <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                              <span className="text-[9px] text-white/30 uppercase font-bold block mb-2">Использование RAM</span>
                              <span className="text-xl font-mono">{health.memoryUsage ? `${health.memoryUsage} MB` : 'N/A'}</span>
                          </div>
                      </div>

                      <section className="space-y-3">
                          <div className="flex items-center justify-between">
                             <span className="text-xs font-bold">Авто-лечение</span>
                             <button onClick={() => setSettings({...settings, autoHeal: !settings.autoHeal})} className={`w-10 h-5 rounded-full p-1 transition-colors ${settings.autoHeal ? 'bg-green-500' : 'bg-white/10'}`}>
                                 <div className={`w-3 h-3 rounded-full bg-white transition-transform ${settings.autoHeal ? 'translate-x-5' : ''}`} />
                             </button>
                          </div>
                          <p className="text-[9px] text-white/40 leading-relaxed">
                              Если включено, Агент Лекарь будет автоматически очищать кэш и перезапускать процессы при обнаружении критических ошибок.
                          </p>
                      </section>

                      <button onClick={forceHeal} className="w-full py-4 rounded-xl border border-white/10 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                          <ShieldCheck size={14}/>
                          Запустить протокол лечения
                      </button>
                  </div>
              );
          case 'logs':
              return (
                  <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="flex items-center justify-between mb-4">
                           <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Системный журнал</span>
                           <button onClick={runDiagnostics} className="text-[9px] text-indigo-400 hover:text-white uppercase font-bold flex items-center gap-1">
                               {testResult === 'idle' ? 'Проверить связь' : testResult === 'ok' ? 'OK' : 'Ошибка'}
                           </button>
                      </div>
                      <div className="flex-1 bg-black/40 rounded-xl border border-white/5 p-4 font-mono text-[9px] text-white/60 overflow-y-auto no-scrollbar space-y-2">
                          {!settings.debugMode ? (
                              <div className="h-full flex flex-col items-center justify-center text-white/20 gap-2">
                                  <Bug size={24} />
                                  <span>Debug Mode is OFF</span>
                                  <button onClick={() => setSettings({...settings, debugMode: true})} className="text-indigo-400 hover:underline">Enable</button>
                              </div>
                          ) : realLogs.length === 0 ? (
                              <div className="text-white/20 text-center mt-10">No logs yet...</div>
                          ) : (
                              realLogs.map((log, idx) => (
                                <div key={idx} className="flex gap-2 border-b border-white/5 pb-1">
                                    <span className="text-white/20 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                    <span className={`shrink-0 ${log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-yellow-400' : 'text-green-400'}`}>[{log.level.toUpperCase()}]</span>
                                    <span className="break-all">{log.message}</span>
                                </div>
                              ))
                          )}
                      </div>
                  </div>
              );
      }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[400]" />
          <motion.div 
            initial={{ x: '100%' }} 
            animate={{ x: 0 }} 
            exit={{ x: '100%' }} 
            transition={{ type: 'spring', damping: 30, stiffness: 350, mass: 1 }} 
            className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-[#090909] border-l border-white/10 z-[401] flex flex-col shadow-2xl"
          >
            
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
              <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-white/80" />
                  </div>
                  <div>
                      <h2 className="text-lg font-black text-white tracking-tighter uppercase leading-none">Админ.Панель</h2>
                      <span className="text-[9px] font-mono text-white/30">v2.5.0 • PRODUCTION</span>
                  </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"><X size={20}/></button>
            </div>

            {/* Sidebar/Tabs (Horizontal for mobile, could be vertical) */}
            <div className="flex px-6 pt-6 gap-4 overflow-x-auto no-scrollbar border-b border-white/5 pb-0">
                <button onClick={() => setActiveTab('system')} className={`pb-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all shrink-0 ${activeTab === 'system' ? 'border-white text-white' : 'border-transparent text-white/30 hover:text-white/60'}`}>Система</button>
                <button onClick={() => setActiveTab('integrations')} className={`pb-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all shrink-0 ${activeTab === 'integrations' ? 'border-white text-white' : 'border-transparent text-white/30 hover:text-white/60'}`}>Интеграции</button>
                <button onClick={() => setActiveTab('healer')} className={`pb-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all shrink-0 flex items-center gap-2 ${activeTab === 'healer' ? 'border-white text-white' : 'border-transparent text-white/30 hover:text-white/60'}`}>
                    Лекарь {health.activeErrors > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/>}
                </button>
                <button onClick={() => setActiveTab('logs')} className={`pb-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all shrink-0 ${activeTab === 'logs' ? 'border-white text-white' : 'border-transparent text-white/30 hover:text-white/60'}`}>Терминал</button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
                {renderContent()}
            </div>
            
            {/* Footer Status */}
            <div className="p-4 border-t border-white/5 bg-black/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${health.status === 'healthy' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500 shadow-[0_0_10px_#ef4444]'}`} />
                    <span className="text-[9px] font-mono text-white/40 uppercase">System: {health.status}</span>
                </div>
                <div className="flex items-center gap-2 text-[9px] font-mono text-white/20">
                    <Activity size={10} />
                    <span>98ms</span>
                </div>
            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SettingsDrawer;
