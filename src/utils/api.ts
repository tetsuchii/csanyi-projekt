import { projectId, publicAnonKey } from './supabase/info';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-5be515e6`;

const getHeaders = (token: string) => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
});

export const initServer = async () => {
    try {
        // Supabase Edge Functions require Authorization header (Anon Key) even for public routes
        await fetch(`${BASE_URL}/init`, {
            headers: {
                'Authorization': `Bearer ${publicAnonKey}`
            }
        });
    } catch (e) {
        console.error("Failed to init server:", e);
    }
};

export const getUploadUrl = async (token: string, path: string) => {
    const res = await fetch(`${BASE_URL}/storage/upload-url`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({ path })
    });
    if (!res.ok) throw new Error("Failed to get upload URL");
    return res.json();
};

export const getSignedUrl = async (token: string, path: string) => {
    const res = await fetch(`${BASE_URL}/storage/get-url`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({ path })
    });
    if (!res.ok) throw new Error("Failed to get signed URL");
    return res.json();
};

export const uploadFile = async (token: string, file: File, path: string) => {
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
    const res = await fetch(`${BASE_URL}/projects`, {
        headers: getHeaders(token)
    });
    if (!res.ok) throw new Error("Failed to load projects");
    const { projects } = await res.json();
    return projects;
};

export const getSharedProject = async (userId: string, projectId: string) => {
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
    const res = await fetch(`${BASE_URL}/share/resolve?id=${shortId}`, {
        headers: {
             'Authorization': `Bearer ${publicAnonKey}`
        }
    });
    if (!res.ok) throw new Error("Failed to resolve share link");
    return res.json();
};

export const getUserPreferences = async (token: string) => {
    const res = await fetch(`${BASE_URL}/user/preferences`, {
        headers: getHeaders(token)
    });
    if (!res.ok) throw new Error("Failed to load preferences");
    const { preferences } = await res.json();
    return preferences;
};

export const saveUserPreferences = async (token: string, preferences: any) => {
    const res = await fetch(`${BASE_URL}/user/preferences`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(preferences)
    });
    if (!res.ok) throw new Error("Failed to save preferences");
    return res.json();
};
