
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useState } from 'react';
import { Key, RotateCcw, Trash2, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface ApiKeyDialogProps {
  onContinue: () => void;
}

type KeyStatus = 'checking' | 'valid' | 'invalid';

const ApiKeyDialog: React.FC<ApiKeyDialogProps> = ({ onContinue }) => {
  const [status, setStatus] = useState<KeyStatus>('checking');

  const checkStatus = async () => {
    setStatus('checking');
    try {
      const aistudio = (window as any).aistudio;
      if (aistudio) {
        const hasKey = await aistudio.hasSelectedApiKey();
        setStatus(hasKey ? 'valid' : 'invalid');
      } else {
        // Fallback checks
        const hasEnv = !!process.env.API_KEY;
        setStatus(hasEnv ? 'valid' : 'invalid');
      }
    } catch (e) {
      console.error(e);
      setStatus('invalid');
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleSelectKey = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio) {
      await aistudio.openSelectKey();
      // Assume success to mitigate race condition where hasSelectedApiKey() might briefly return false
      setStatus('valid'); 
    }
    
    // Slight delay to let user see the green checkmark before closing
    setTimeout(() => {
        onContinue();
    }, 500);
  };

  const handleReset = async () => {
    localStorage.removeItem('API_KEY');
    localStorage.removeItem('gemini_api_key');

    const aistudio = (window as any).aistudio;
    if (aistudio) {
      // Often openSelectKey handles the reset/re-select flow
      await aistudio.openSelectKey();
    }
    // We do NOT assume success here as user might cancel reset flow or it might fail
    await checkStatus();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-opacity duration-300">
      <div className="bg-neutral-900/60 border border-white/10 backdrop-blur-2xl rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-md w-full p-8 text-center flex flex-col items-center ring-1 ring-white/5 relative overflow-hidden">
        
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-20 bg-white/5 blur-3xl pointer-events-none"></div>

        <div className="bg-white/5 p-5 rounded-full mb-6 ring-1 ring-white/10 shadow-[inset_0_0_20px_rgba(255,255,255,0.05)] relative z-10 group">
          <Key className={`w-8 h-8 opacity-90 transition-colors duration-500 ${status === 'valid' ? 'text-green-400' : 'text-white'}`} />
          
          {/* Status Badge */}
          <div className="absolute -bottom-1 -right-1 bg-neutral-900 rounded-full p-1 border border-white/10 shadow-sm">
             {status === 'checking' && <Loader2 className="w-4 h-4 text-white/50 animate-spin" />}
             {status === 'valid' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
             {status === 'invalid' && <XCircle className="w-4 h-4 text-red-500" />}
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2 tracking-wide drop-shadow-md">
           {status === 'valid' ? 'Доступ разрешен' : 'Требуется конфигурация'}
        </h2>
        
        <div className={`mb-6 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors duration-300 ${
            status === 'valid' 
            ? 'bg-green-500/10 border-green-500/20 text-green-400' 
            : status === 'checking' 
                ? 'bg-white/5 border-white/10 text-white/40'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
            {status === 'valid' ? 'Ключ активен' : status === 'checking' ? 'Проверка...' : 'Ключ отсутствует'}
        </div>
        
        <p className="text-gray-300 mb-8 text-sm leading-relaxed font-light">
          Это приложение использует Veo, для которого требуется API-ключ из платного проекта Google Cloud с включенным биллингом.
        </p>
        
        <button
          onClick={handleSelectKey}
          className="w-full px-6 py-3.5 bg-white hover:bg-gray-100 text-black font-bold rounded-xl transition-all duration-300 text-sm tracking-wider uppercase shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_35px_rgba(255,255,255,0.4)] hover:scale-105 active:scale-95"
        >
          {status === 'valid' ? 'Сменить API ключ' : 'Выбрать API ключ'}
        </button>

        <div className="w-full h-px bg-white/10 my-6"></div>

        <button
          onClick={handleReset}
          className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-red-400 hover:text-red-300 transition-all rounded-lg hover:bg-red-500/10 w-full border border-white/5 hover:border-red-500/20 group"
        >
          <Trash2 className="w-3.5 h-3.5 transition-transform" />
          Сбросить настройки
        </button>

        <p className="text-gray-500 mt-6 text-xs font-medium">
          Узнайте больше о{' '}
          <a
            href="https://ai.google.dev/gemini-api/docs/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:text-gray-300 transition-colors underline underline-offset-2 decoration-white/30 hover:decoration-white"
          >
            оплате
          </a>{' '}
          и{' '}
          <a
            href="https://ai.google.dev/gemini-api/docs/pricing#veo-3"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:text-gray-300 transition-colors underline underline-offset-2 decoration-white/30 hover:decoration-white"
          >
            ценах
          </a>.
        </p>
      </div>
    </div>
  );
};

export default ApiKeyDialog;
