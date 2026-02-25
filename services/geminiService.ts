
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  GoogleGenAI,
  VideoGenerationReferenceImage,
  VideoGenerationReferenceType,
  Chat,
} from '@google/genai';
import {GenerateVideoParams, GenerationMode, ImageFile, Resolution, AspectRatio, StudioSettings, VeoModel} from '../types';

const getActiveKey = () => process.env.API_KEY || '';

export const testApiConnection = async (): Promise<boolean> => {
    try {
        const ai = new GoogleGenAI({apiKey: getActiveKey()});
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: 'ping',
            config: { maxOutputTokens: 1 }
        });
        return !!response.text;
    } catch (e) {
        console.error("Диагностика API не удалась", e);
        return false;
    }
};

export const enhancePrompt = async (currentPrompt: string): Promise<string> => {
    const ai = new GoogleGenAI({apiKey: getActiveKey()});
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Ты — профессиональный промпт-инженер для генерации видео AI (Veo/Sora). 
        Твоя задача: взять короткую идею пользователя и превратить её в детальный, богатый кинематографический промпт на РУССКОМ языке.
        
        Включи описание:
        1. Освещения (Golden hour, cinematic lighting, neon, etc.)
        2. Движения камеры (Dolly zoom, panning, drone shot)
        3. Деталей окружения и атмосферы
        4. Визуального стиля (Photorealistic, 35mm film, Cyberpunk, etc.)
        
        Идея пользователя: "${currentPrompt}"
        
        Верни ТОЛЬКО улучшенный текст промпта без кавычек и лишних слов.`,
    });
    return response.text || currentPrompt;
};

export const analyzeImage = async (base64: string, mimeType: string): Promise<string> => {
    const ai = new GoogleGenAI({apiKey: getActiveKey()});
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: { mimeType, data: base64 } },
                { text: "Опиши это изображение детально для создания видео-промпта. Опиши субъект, действие, стиль, освещение и атмосферу. Отвечай на русском языке одним сплошным текстом." }
            ]
        }
    });
    return response.text || "";
};

export const analyzeVideoFrame = async (base64: string, mimeType: string): Promise<string> => {
    // Uses Gemini 3 Pro for deep reasoning about the scene context
    const ai = new GoogleGenAI({apiKey: getActiveKey()});
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
            parts: [
                { inlineData: { mimeType, data: base64 } },
                { text: "Проанализируй этот кадр из видео. Опиши окружение, освещение, угол камеры и действие максимально подробно для генерации видео. ИГНОРИРУЙ внешность человека, опиши только его позу и действия (например, 'человек бежит', 'человек сидит'). Верни детальный промпт на английском языке." }
            ]
        }
    });
    return response.text || "";
};

export const replaceCharacterInFrame = async (frameBase64: string, frameMime: string, charBase64: string, charMime: string): Promise<string> => {
    // Uses "Nano Banana" (Gemini 2.5 Flash Image) for visual editing
    const ai = new GoogleGenAI({apiKey: getActiveKey()});
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: { mimeType: frameMime, data: frameBase64 } },
                { inlineData: { mimeType: charMime, data: charBase64 } },
                { text: "Replace the person in the first image with the character from the second image. Keep the exact same pose, background, lighting, and composition. Output only the image." }
            ]
        }
    });
    
    // Find image part
    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    return part?.inlineData?.data || "";
};

export const createDirectorSession = (settings?: StudioSettings, useThinking: boolean = false): Chat => {
    const ai = new GoogleGenAI({apiKey: getActiveKey()});
    const model = useThinking ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
    
    const styleContext = settings?.visualStyle ? `CURRENT VISUAL STYLE: ${settings.visualStyle}` : '';
    
    const instruction = `Вы — СТЭНЛИ, ИИ-кинорежиссер и визионер.
    Ваша цель: Помочь продюсеру создать выдающийся визуальный контент.
    
    ${styleContext}
    
    РОЛИ В КОМАНДЕ (вы можете переключаться между ними по необходимости):
    - РЕЖИССЕР (Стэнли): Общее видение, композиция, эмоции.
    - ОПЕРАТОР (Текс): Камеры, объективы (35mm, 85mm), движение (Dolly, Truck, Pan, Tilt), освещение.
    - СЦЕНАРИСТ (Хлоя): Сюжет, диалоги, описание персонажей.

    ИНСТРУКЦИИ:
    1. Всегда предлагайте конкретные визуальные решения (ракурс, свет, цвет).
    2. Если пользователь просит "предложить идею", дайте 3 коротких, но ярких варианта сцены.
    3. Если пользователь выбрал идею, предложите, как её снять (движение камеры).
    4. Отвечайте всегда на РУССКОМ языке.
    
    ГЕНЕРАЦИЯ:
    Чтобы создать кадр, выведите СТРОГО следующий JSON в конце сообщения: 
    :::JSON {"action": "generate_frame", "prompt": "ПОЛНЫЙ_ДЕТАЛЬНЫЙ_ПРОМПТ_ДЛЯ_ВИДЕО"} :::
    
    Настройки студии: ${JSON.stringify(settings || {})}`;

    const config: any = {
        systemInstruction: instruction,
        temperature: 0.9,
    };

    if (useThinking) config.thinkingConfig = { thinkingBudget: 32768 };

    return ai.chats.create({ model, config });
};

// Extremely fast preview generation
export const generateFastPreview = async (prompt: string): Promise<string> => {
    const ai = new GoogleGenAI({apiKey: getActiveKey()});
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { text: `Fast sketch concept art, dynamic composition, cinematic lighting: ${prompt}` }
                ]
            },
            config: {
                 // No thinking needed for speed
                 responseMimeType: 'application/json' // Trick to force structured thought is NOT used here, just raw speed
            }
        });
        
        // Find image part
        const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        return part?.inlineData?.data || "";
    } catch (e) {
        console.warn("Fast preview failed", e);
        return "";
    }
};

export const generateImage = async (prompt: string): Promise<string> => {
    const ai = new GoogleGenAI({apiKey: getActiveKey()});
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: `Cinematic frame: ${prompt}`,
            config: { numberOfImages: 1, aspectRatio: '16:9', outputMimeType: 'image/jpeg' }
        });
        return response.generatedImages?.[0]?.image?.imageBytes || '';
    } catch (e) {
        const res = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: `Кинематографичный кадр: ${prompt}` }] }
        });
        return res.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data || '';
    }
};

export const editImage = async (base64: string, mimeType: string, prompt: string): Promise<string> => {
    const ai = new GoogleGenAI({apiKey: getActiveKey()});
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [{ inlineData: { mimeType, data: base64 } }, { text: `Отредактируй это изображение: ${prompt}. Сохрани композицию.` }]
        }
    });
    return response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data || '';
};

// New Pipeline for Full Character Replacement
export const generateCharacterReplacement = async (params: GenerateVideoParams, statusCallback?: (status: string) => void): Promise<{url: string; blob: Blob}> => {
    if (!params.startFrame || !params.referenceImages?.[0]) {
        throw new Error("Missing video frame or character reference");
    }

    // 1. Analyze Original Video Frame (Gemini 3 Pro)
    statusCallback?.("Анализ сцены (Gemini 3 Pro)...");
    const scenePrompt = await analyzeVideoFrame(params.startFrame.base64, params.startFrame.file.type);
    console.log("Analyzed Scene:", scenePrompt);

    // 2. Edit Frame to Swap Character (Gemini 2.5 Flash / Nano Banana)
    statusCallback?.("Вклейка персонажа (Nano Banana)...");
    const editedFrameBase64 = await replaceCharacterInFrame(
        params.startFrame.base64, 
        params.startFrame.file.type, 
        params.referenceImages[0].base64, 
        params.referenceImages[0].file.type
    );
    
    if (!editedFrameBase64) throw new Error("Не удалось заменить персонажа на фото");

    // 3. Generate Video using Edited Frame + Analyzed Prompt (Veo)
    statusCallback?.("Рендеринг видео (Veo)...");
    const veoParams: GenerateVideoParams = {
        ...params,
        prompt: scenePrompt, // Use the AI generated description of the scene
        startFrame: { file: new File([], 'edited.png', { type: 'image/png' }), base64: editedFrameBase64 },
        referenceImages: params.referenceImages // Pass ref again to ensure consistency in motion
    };

    return generateVideo(veoParams);
};

export const generateVideo = async (params: GenerateVideoParams): Promise<{url: string; blob: Blob}> => {
  const ai = new GoogleGenAI({apiKey: getActiveKey()});
  
  const runGeneration = async (model: VeoModel) => {
      const payload: any = {
          model,
          prompt: params.prompt,
          config: {
              numberOfVideos: 1,
              aspectRatio: params.aspectRatio,
              resolution: params.resolution,
          }
      };

      const references: VideoGenerationReferenceImage[] = [];
      if (params.referenceImages) {
          params.referenceImages.forEach(img => {
              references.push({ 
                  image: { imageBytes: img.base64, mimeType: img.file.type }, 
                  referenceType: VideoGenerationReferenceType.ASSET 
              });
          });
      }

      if (params.startFrame) {
          if (references.length > 0 && params.mode !== GenerationMode.CHARACTER_REPLACEMENT) {
             // In regular modes, if we have references, startFrame is also a reference usually
             references.push({ 
                  image: { imageBytes: params.startFrame.base64, mimeType: params.startFrame.file.type }, 
                  referenceType: VideoGenerationReferenceType.ASSET 
              });
          } else {
              // For character replacement (and standard image-to-video), startFrame IS the starting image
              payload.image = { imageBytes: params.startFrame.base64, mimeType: params.startFrame.file.type };
          }
      }

      if (references.length > 0) payload.config.referenceImages = references;

      let op = await ai.models.generateVideos(payload);
      while (!op.done) {
          await new Promise(r => setTimeout(r, 10000));
          op = await ai.operations.getVideosOperation({operation: op});
      }
      return op;
  };

  // Determine model chain. 
  // IMPORTANT: If referenceImages are present (cameo/batch), we MUST use Veo 3.1 Pro (preview)
  // as Veo Fast does not reliably support multiple Asset references or the feature might be gated.
  let primaryModel = params.model;
  
  if (params.referenceImages && params.referenceImages.length > 0 && primaryModel === VeoModel.VEO_FAST) {
       console.log("Upgrading to Veo 3.1 Pro for Reference Image support");
       primaryModel = VeoModel.VEO_31;
  }

  // Removed VEO_2 from chain to prevent 404
  const modelChain = [primaryModel, VeoModel.VEO_FAST];
  // Remove duplicate if user selected VEO_FAST (and we didn't upgrade)
  const uniqueChain = Array.from(new Set(modelChain));

  let lastError = null;

  for (const model of uniqueChain) {
      try {
          const op = await runGeneration(model as VeoModel);
          if (op.response?.generatedVideos?.[0]) {
              const videoUri = op.response.generatedVideos[0].video.uri;
              const res = await fetch(`${videoUri}&key=${getActiveKey()}`);
              const blob = await res.blob();
              return { url: URL.createObjectURL(blob), blob };
          }
      } catch (e: any) {
          console.warn(`Модель ${model} не сработала, пробуем следующую...`, e);
          lastError = e;
      }
  }

  throw lastError || new Error("Конвейер производства остановлен. Проверьте API ключ.");
};
