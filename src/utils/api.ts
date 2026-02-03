import { projectId, publicAnonKey } from './supabase/info';
import * as localStore from './localStorage';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server`;

// Track if backend is available
let backendAvailable: boolean | null = null;

const getHeaders = (token: string) => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
});

// Health check to verify the Edge Function is deployed and accessible
export const checkHealth = async (): Promise<boolean> => {
    // Return cached result if available
    if (backendAvailable !== null) {
        return backendAvailable;
    }

    try {
        const response = await fetch(`${BASE_URL}/health`, {
            headers: {
                'Authorization': `Bearer ${publicAnonKey}`
            },
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Edge Function is healthy:', data);
            console.log('☁️ Running in CLOUD MODE - data synced to Supabase');
            backendAvailable = true;
            localStore.setLocalMode(false);
            return true;
        } else {
            console.warn('⚠️ Edge Function responded with error:', response.status, response.statusText);
            backendAvailable = false;
            localStore.setLocalMode(true);
            return false;
        }
    } catch (e) {
        console.log('📍 Backend not available - using LOCAL MODE (browser storage)');
        console.log('💡 Your data will be saved locally and work offline');
        console.log('☁️ To enable cloud sync, deploy the Edge Function (see documentation)');
        backendAvailable = false;
        localStore.setLocalMode(true);
        return false;
    }
};

export const initServer = async () => {
    try {
        // First check if the function is even deployed
        const isHealthy = await checkHealth();
        if (!isHealthy) {
            console.log('📍 Running in local-only mode');
            return;
        }

        // Supabase Edge Functions require Authorization header (Anon Key) even for public routes
        const response = await fetch(`${BASE_URL}/init`, {
            headers: {
                'Authorization': `Bearer ${publicAnonKey}`
            }
        });
        
        if (!response.ok) {
            const text = await response.text();
            console.error(`Init server failed: ${response.status} ${response.statusText}`, text);
        } else {
            console.log('✅ Server initialized successfully');
        }
    } catch (e) {
        console.log('📍 Running in local-only mode');
    }
};

export const getUploadUrl = async (token: string, path: string) => {
    const isHealthy = await checkHealth();
    if (!isHealthy) {
        throw new Error('OFFLINE_MODE');
    }
    
    const res = await fetch(`${BASE_URL}/storage/upload-url`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({ path })
    });
    if (!res.ok) throw new Error("Failed to get upload URL");
    return res.json();
};

export const getSignedUrl = async (token: string, path: string) => {
    const isHealthy = await checkHealth();
    if (!isHealthy) {
        // Return locally stored file
        const url = await localStore.getFileUrl(path);
        return { url };
    }
    
    const res = await fetch(`${BASE_URL}/storage/get-url`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({ path })
    });
    if (!res.ok) throw new Error("Failed to get signed URL");
    return res.json();
};

export const uploadFile = async (token: string, file: File, path: string) => {
    const isHealthy = await checkHealth();
    if (!isHealthy) {
        // Store file locally
        await localStore.storeFileLocally(file, path);
        return path;
    }
    
    // 1. Get Upload URL
    const { url } = await getUploadUrl(token, path);
    
    // 2. Upload File
    const uploadRes = await fetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': file.type
        },
        body: file
    });
    
    if (!uploadRes.ok) throw new Error("Failed to upload file");
    return path;
};

export const saveProjects = async (token: string, projects: any[]) => {
    const isHealthy = await checkHealth();
    if (!isHealthy) {
        // Save to localStorage
        // Use a mock user ID based on token
        const userId = token || 'local_user';
        localStore.saveProjectsLocally(userId, projects);
        return { success: true };
    }
    
    // We strip out the actual File objects and blob URLs before saving
    // to avoid circular references or trying to save massive data blobs
    const sanitizedProjects = projects.map(p => ({
        ...p,
        imageFile: null, // Don't save file object
        imageUrl: null, // Don't save blob URL (we rely on stored path)
        introAudioFile: null,
        introAudioUrl: null,
        hotspots: p.hotspots.map((h: any) => ({
            ...h,
            audioFile: null,
            audioUrl: null
        })),
        globalChannels: (p.globalChannels || []).map((c: any) => ({
            ...c,
            audioFile: null,
            audioUrl: null
        }))
    }));

    const res = await fetch(`${BASE_URL}/projects`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({ projects: sanitizedProjects })
    });
    if (!res.ok) throw new Error("Failed to save projects");
    return res.json();
};

export const loadProjects = async (token: string) => {
    const isHealthy = await checkHealth();
    if (!isHealthy) {
        // Load from localStorage
        const userId = token || 'local_user';
        const projects = localStore.loadProjectsLocally(userId);
        return projects;
    }
    
    const res = await fetch(`${BASE_URL}/projects`, {
        headers: getHeaders(token)
    });
    if (!res.ok) throw new Error("Failed to load projects");
    const { projects } = await res.json();
    return projects;
};

export const getSharedProject = async (userId: string, projectId: string) => {
    const isHealthy = await checkHealth();
    if (!isHealthy) {
        // Try to get from local storage
        const project = localStore.getSharedProjectLocally(userId, projectId);
        if (!project) throw new Error("Project not found locally");
        return project;
    }
    
    const res = await fetch(`${BASE_URL}/public/project?userId=${userId}&projectId=${projectId}`, {
        headers: {
             'Authorization': `Bearer ${publicAnonKey}`
        }
    });
    if (!res.ok) throw new Error("Failed to load shared project");
    const { project } = await res.json();
    return project;
};

export const createShareLink = async (userId: string, projectId: string) => {
    const isHealthy = await checkHealth();
    if (!isHealthy) {
        // Create local share link (only works on same device)
        const shortId = localStore.createShareLinkLocally(userId, projectId);
        return { shortId };
    }
    
    const res = await fetch(`${BASE_URL}/share`, {
        method: 'POST',
        headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({ userId, projectId })
    });
    if (!res.ok) throw new Error("Failed to create share link");
    return res.json();
};

export const resolveShareLink = async (shortId: string) => {
    const isHealthy = await checkHealth();
    if (!isHealthy) {
        // Try to resolve locally
        const data = localStore.resolveShareLinkLocally(shortId);
        if (!data) throw new Error("Share link not found locally");
        return data;
    }
    
    const res = await fetch(`${BASE_URL}/share/resolve?id=${shortId}`, {
        headers: {
             'Authorization': `Bearer ${publicAnonKey}`
        }
    });
    if (!res.ok) throw new Error("Failed to resolve share link");
    return res.json();
};

export const getUserPreferences = async (token: string) => {
    const isHealthy = await checkHealth();
    if (!isHealthy) {
        // Load from localStorage
        const userId = token || 'local_user';
        const preferences = localStore.loadPreferencesLocally(userId);
        return preferences;
    }
    
    const res = await fetch(`${BASE_URL}/user/preferences`, {
        headers: getHeaders(token)
    });
    if (!res.ok) throw new Error("Failed to load preferences");
    const { preferences } = await res.json();
    return preferences;
};

export const saveUserPreferences = async (token: string, preferences: any) => {
    const isHealthy = await checkHealth();
    if (!isHealthy) {
        // Save to localStorage
        const userId = token || 'local_user';
        localStore.savePreferencesLocally(userId, preferences);
        return { success: true };
    }
    
    const res = await fetch(`${BASE_URL}/user/preferences`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(preferences)
    });
    if (!res.ok) throw new Error("Failed to save preferences");
    return res.json();
};