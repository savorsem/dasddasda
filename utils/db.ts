
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { FeedPost, CameoProfile, AgentMessage, StoryboardFrame, GlobalSettings } from '../types';
import { supabase } from '../services/supabaseClient';

// Helper to upload a file (Blob or File) to Supabase Storage
const uploadFile = async (bucket: string, path: string, file: Blob): Promise<string | null> => {
    try {
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(path, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (error) {
            console.warn(`Storage upload warning for ${path}:`, error.message);
            // Even if upload "fails" (e.g. exists), try to get URL
        }

        const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(path);

        return publicUrl;
    } catch (e) {
        console.error(`Upload failed for ${path}:`, e);
        return null;
    }
};

// Helper to convert Base64 string to Blob
export const base64ToBlob = async (base64Data: string): Promise<Blob> => {
    try {
        const response = await fetch(base64Data);
        return await response.blob();
    } catch (e) {
        console.error("Base64 to Blob conversion failed", e);
        return new Blob([]);
    }
};

// --- SETTINGS SYNC ---

export const syncUserSettings = async (settings: GlobalSettings) => {
    try {
        // Since we don't have user Auth fully integrated in UI, we use a local ID or a single 'global' row for this demo.
        // In production with Auth, this would use the user's UUID.
        const userId = localStorage.getItem('user_uuid') || 'anonymous_user';
        if (!localStorage.getItem('user_uuid')) localStorage.setItem('user_uuid', userId);

        const { error } = await supabase
            .from('user_settings')
            .upsert({
                user_id: userId,
                settings: settings,
                updated_at: new Date().toISOString()
            });
            
        if (error) {
            // If table doesn't exist or RLS blocks it, we fallback silently to local
            console.warn("Cloud sync warning (settings):", error.message);
        }
    } catch (e) {
        console.warn("Cloud sync failed (settings)", e);
    }
};

// --- POSTS (FEED) ---

export const savePost = async (post: FeedPost, videoBlob?: Blob) => {
    try {
        const postData = { ...post };

        // 1. Upload Video if a new blob is provided
        if (videoBlob) {
            const fileName = `${post.id}.mp4`;
            const publicUrl = await uploadFile('videos', fileName, videoBlob);
            if (publicUrl) {
                postData.videoUrl = publicUrl;
            }
        } else if (postData.videoUrl && postData.videoUrl.startsWith('blob:')) {
            try {
                const res = await fetch(postData.videoUrl);
                const blob = await res.blob();
                const fileName = `${post.id}.mp4`;
                const publicUrl = await uploadFile('videos', fileName, blob);
                if (publicUrl) postData.videoUrl = publicUrl;
            } catch (e) {
                console.error("Failed to recover blob from URL", e);
            }
        }

        // 2. Save metadata to DB
        const { error } = await supabase
            .from('posts')
            .upsert({
                id: postData.id,
                username: postData.username,
                "avatarUrl": postData.avatarUrl,
                description: postData.description,
                "modelTag": postData.modelTag,
                status: postData.status,
                "videoUrl": postData.videoUrl,
                "errorMessage": postData.errorMessage,
                "referenceImageBase64": postData.referenceImageBase64,
                filters: postData.filters,
                "aspectRatio": postData.aspectRatio,
                resolution: postData.resolution,
                "originalParams": postData.originalParams,
            });

        if (error) throw error;
        await logEvent('info', 'Post saved successfully', { postId: postData.id });

    } catch (e: any) {
        console.error('Error saving post to Supabase:', e.message || e);
        await logEvent('error', 'Error saving post', { error: e.message });
    }
};

export const getAllPosts = async (): Promise<FeedPost[]> => {
    try {
        const { data, error } = await supabase
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data as FeedPost[]) || [];
    } catch (e) {
        console.error('Error fetching posts:', e);
        return [];
    }
};

export const deletePost = async (id: string) => {
    try {
        await supabase.storage.from('videos').remove([`${id}.mp4`]);
        const { error } = await supabase.from('posts').delete().eq('id', id);
        if (error) throw error;
    } catch (e) {
        console.error('Error deleting post:', e);
    }
};

// --- PROFILES (CHARACTERS) ---

const LOCAL_PROFILES_KEY = 'noworries_local_profiles';

export const saveProfile = async (profile: CameoProfile) => {
    // 1. SAVE LOCALLY FIRST (Reliability)
    try {
        const stored = localStorage.getItem(LOCAL_PROFILES_KEY);
        const localProfiles: CameoProfile[] = stored ? JSON.parse(stored) : [];
        
        // Remove existing if any, append new
        const updated = [...localProfiles.filter(p => p.id !== profile.id), profile];
        localStorage.setItem(LOCAL_PROFILES_KEY, JSON.stringify(updated));
    } catch (e: any) {
        console.error("Failed to save profile locally", e);
        if (e.name === 'QuotaExceededError' || e.message?.includes('quota')) {
             throw new Error("Место в браузере закончилось. Удалите старых персонажей.");
        }
    }

    // 2. ATTEMPT CLOUD SYNC (Optional/Background)
    try {
        let finalImageUrl = profile.imageUrl;

        if (profile.imageUrl && profile.imageUrl.startsWith('data:')) {
            const blob = await base64ToBlob(profile.imageUrl);
            const match = profile.imageUrl.match(/^data:image\/(\w+);base64,/);
            const ext = match ? match[1] : 'png';
            const fileName = `${profile.id}.${ext}`;
            
            const publicUrl = await uploadFile('images', fileName, blob);
            if (publicUrl) {
                finalImageUrl = publicUrl;
            }
        }

        const { error } = await supabase
            .from('profiles')
            .upsert({
                id: profile.id,
                name: profile.name,
                "imageUrl": finalImageUrl,
                "group": profile.group
            });

        if (error) console.warn("Cloud sync failed for profile, using local only", error.message);
    } catch (e) {
        console.warn('Error saving profile to cloud (ignoring):', e);
    }
};

export const getUserProfiles = async (): Promise<CameoProfile[]> => {
    let profiles: CameoProfile[] = [];

    // 1. Load Local
    try {
        const stored = localStorage.getItem(LOCAL_PROFILES_KEY);
        if (stored) {
            profiles = JSON.parse(stored);
        }
    } catch (e) {
        console.error("Failed to load local profiles", e);
    }

    // 2. Try Cloud (and merge if successful)
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            const cloudProfiles = data as CameoProfile[];
            // Merge: Cloud overwrites local if ID matches (assuming cloud is source of truth if connected),
            // OR we just append cloud ones that aren't in local.
            // Simple approach: Union based on ID
            const localIds = new Set(profiles.map(p => p.id));
            const newFromCloud = cloudProfiles.filter(p => !localIds.has(p.id));
            profiles = [...profiles, ...newFromCloud];
        }
    } catch (e) {
        console.warn('Error fetching profiles from cloud:', e);
    }

    return profiles;
};

export const deleteProfile = async (id: string) => {
    // 1. Delete Local
    try {
        const stored = localStorage.getItem(LOCAL_PROFILES_KEY);
        if (stored) {
            const profiles: CameoProfile[] = JSON.parse(stored);
            const updated = profiles.filter(p => p.id !== id);
            localStorage.setItem(LOCAL_PROFILES_KEY, JSON.stringify(updated));
        }
    } catch (e) {
        console.error("Failed to delete local profile", e);
    }

    // 2. Delete Cloud
    try {
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) console.warn("Failed to delete from cloud", error.message);
    } catch (e) {
        console.warn('Error deleting profile from cloud:', e);
    }
};

// --- CHAT HISTORY (STUDIO AGENT) ---

export const saveChatMessage = async (message: AgentMessage) => {
    try {
        const { error } = await supabase
            .from('chat_history')
            .insert({
                id: message.id, // Or let DB generate it, but we use client ID for consistency
                role: message.role,
                text: message.text,
                timestamp: new Date(message.timestamp).toISOString(),
                is_action: message.isAction || false
            });

        if (error) throw error;
    } catch (e: any) {
        console.error('Error saving chat message:', e);
    }
};

export const getChatHistory = async (): Promise<AgentMessage[]> => {
    try {
        const { data, error } = await supabase
            .from('chat_history')
            .select('*')
            .order('timestamp', { ascending: true })
            .limit(100);

        if (error) throw error;

        return (data || []).map((row: any) => ({
            id: row.id,
            role: row.role,
            text: row.text,
            timestamp: new Date(row.timestamp).getTime(),
            isAction: row.is_action
        }));
    } catch (e) {
        console.error('Error fetching chat history:', e);
        return [];
    }
};

// --- STORYBOARD FRAMES (FRAME-BY-FRAME) ---

export const saveStoryboardFrame = async (frame: StoryboardFrame) => {
    try {
        let imageUrl = frame.imageUrl;
        let videoUrl = frame.videoUrl;

        // Upload Image if base64
        if (imageUrl && imageUrl.startsWith('data:')) {
            const blob = await base64ToBlob(imageUrl);
            const fileName = `sb_img_${frame.id}.jpg`;
            const url = await uploadFile('images', fileName, blob);
            if (url) imageUrl = url;
        }

        // Upload Video if blob url (requires fetching content first, usually handled in component, 
        // but if passed here as blob url we try to fetch)
        if (videoUrl && videoUrl.startsWith('blob:')) {
            try {
                const res = await fetch(videoUrl);
                const blob = await res.blob();
                const fileName = `sb_vid_${frame.id}.mp4`;
                const url = await uploadFile('videos', fileName, blob);
                if (url) videoUrl = url;
            } catch(e) {
                console.error("Failed to upload frame video blob", e);
            }
        }

        const { error } = await supabase
            .from('storyboard_frames')
            .upsert({
                id: frame.id,
                prompt: frame.prompt,
                image_url: imageUrl,
                video_url: videoUrl,
                status: frame.status,
                camera_movement: frame.cameraMovement
            });

        if (error) throw error;
        
        // Return updated URLs to update local state
        return { imageUrl, videoUrl };

    } catch (e: any) {
        console.error('Error saving storyboard frame:', e);
        await logEvent('error', 'Error saving storyboard frame', { error: e.message });
        return null;
    }
};

export const getStoryboardFrames = async (): Promise<StoryboardFrame[]> => {
    try {
        const { data, error } = await supabase
            .from('storyboard_frames')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;

        return (data || []).map((row: any) => ({
            id: row.id,
            prompt: row.prompt,
            imageUrl: row.image_url,
            videoUrl: row.video_url,
            status: row.status,
            cameraMovement: row.camera_movement
        }));
    } catch (e) {
        console.error('Error fetching storyboard frames:', e);
        return [];
    }
};

// --- LOGGING ---

export const logEvent = async (level: 'info' | 'warn' | 'error', message: string, details?: any) => {
    try {
        // NOTE: We do not call healer.reportError() here to avoid circular dependency.
        // The calling context (e.g. App.tsx) should invoke the Healer if necessary.

        const { error } = await supabase
            .from('app_logs')
            .insert({
                level,
                message,
                details: details ? JSON.stringify(details) : null,
                timestamp: new Date().toISOString()
            });
            
        if (error) console.warn("Failed to write log to DB", error);
    } catch (e) {
        // Silent fail for logs to avoid loop
        console.warn("Logging failed locally", e);
    }
};
