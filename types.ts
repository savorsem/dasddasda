
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
export enum AppState {
  IDLE,
  LOADING,
  SUCCESS,
  ERROR,
}

export enum VeoModel {
  VEO_FAST = 'veo-3.1-fast-generate-preview',
  VEO_31 = 'veo-3.1-generate-preview',
  VEO_3_FAST = 'veo-3.0-fast-generate-preview',
  VEO_3 = 'veo-3.0-generate-preview',
  VEO_2 = 'veo-2.0-generate-preview',
}

export enum AspectRatio {
  LANDSCAPE = '16:9',
  PORTRAIT = '9:16',
}

export enum Resolution {
  P720 = '720p',
  P1080 = '1080p',
}

export enum GenerationMode {
  TEXT_TO_VIDEO = 'Text to Video',
  FRAMES_TO_VIDEO = 'Frames to Video',
  REFERENCES_TO_VIDEO = 'References to Video',
  VIDEO_TO_VIDEO = 'Video to Video',
  IMAGE_EDIT_TO_VIDEO = 'Image Edit to Video',
  CHARACTER_REPLACEMENT = 'Character Replacement',
}

export interface ImageFile {
  file: File;
  base64: string;
}

export interface VideoFile {
  file: File;
  base64: string;
}

export interface GenerateVideoParams {
  prompt: string;
  model: VeoModel;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  mode: GenerationMode;
  startFrame?: ImageFile | null;
  endFrame?: ImageFile | null;
  referenceImages?: ImageFile[];
  styleImage?: ImageFile | null;
  inputVideo?: VideoFile | null;
  isLooping?: boolean;
}

export enum PostStatus {
  GENERATING = 'generating',
  SUCCESS = 'success',
  ERROR = 'error',
  UPGRADING = 'upgrading',
}

export interface VideoFilters {
  brightness: number;
  contrast: number;
  saturate: number;
  grayscale: number;
  sepia: number;
}

export interface FeedPost {
  id: string;
  videoUrl?: string;
  username: string;
  avatarUrl: string;
  description: string;
  modelTag: string;
  status?: PostStatus;
  errorMessage?: string;
  referenceImageBase64?: string;
  filters?: VideoFilters;
  aspectRatio?: AspectRatio; 
  resolution?: Resolution;
  originalParams?: GenerateVideoParams;
}

export interface CameoProfile {
  id: string;
  name: string;
  imageUrl: string;
  group?: string; 
}

export type AgentRole = 'Director' | 'Producer' | 'Writer' | 'Cinematographer' | 'Researcher';

export interface AgentMessage {
  id: string;
  role: AgentRole;
  text: string;
  timestamp: number;
  isAction?: boolean;
}

export interface StoryboardFrame {
  id: string;
  prompt: string;
  cameraMovement?: string; 
  imageUrl?: string; 
  videoUrl?: string; 
  status: 'pending' | 'generating_image' | 'image_ready' | 'generating_video' | 'complete' | 'error';
}

export type DirectorStyle = 'Cinematic' | 'Cyberpunk' | 'Noir' | 'Documentary' | 'Anime' | 'Minimalist' | 'Vintage';

export interface StudioSettings {
    visualStyle: DirectorStyle;
    pacing: 'Slow' | 'Medium' | 'Fast';
    motionIntensity: 'Low' | 'Medium' | 'High';
}

// --- NEW SETTINGS TYPES ---

export interface ApiIntegrations {
  elevenLabsKey?: string;
  midjourneyKey?: string;
  runwayKey?: string;
  customProxyUrl?: string;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  lastCheck: number;
  activeErrors: number;
  memoryUsage?: number;
}

export interface HealerLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface GlobalSettings {
  theme: string;
  integrations: ApiIntegrations;
  autoHeal: boolean;
  syncToSupabase: boolean;
  debugMode: boolean;
}
