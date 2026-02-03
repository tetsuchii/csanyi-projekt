// localStorage fallback for when Supabase Edge Function is not deployed
// This allows the app to work immediately without backend deployment

const STORAGE_PREFIX = 'soundmap_';

// Helper to convert File to base64 for localStorage storage
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

// Helper to convert base64 back to File
const base64ToFile = (base64: string, filename: string, mimeType: string): File => {
    const arr = base64.split(',');
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mimeType });
};

// Store file and return a local path reference
export const storeFileLocally = async (file: File, path: string): Promise<string> => {
    try {
        const base64 = await fileToBase64(file);
        const fileData = {
            base64,
            name: file.name,
            type: file.type,
            size: file.size
        };
        localStorage.setItem(`${STORAGE_PREFIX}file_${path}`, JSON.stringify(fileData));
        console.log('📁 File stored locally:', path);
        return path;
    } catch (e) {
        console.error('Failed to store file locally:', e);
        throw new Error('Failed to store file locally');
    }
};

// Retrieve file URL from localStorage
export const getFileUrl = async (path: string): Promise<string> => {
    try {
        const stored = localStorage.getItem(`${STORAGE_PREFIX}file_${path}`);
        if (!stored) {
            throw new Error('File not found in local storage');
        }
        const fileData = JSON.parse(stored);
        return fileData.base64; // Return the base64 data URL
    } catch (e) {
        console.error('Failed to retrieve file locally:', e);
        throw new Error('Failed to retrieve file locally');
    }
};

// Save projects to localStorage
export const saveProjectsLocally = (userId: string, projects: any[]): void => {
    try {
        // Store with timestamp for debugging
        const data = {
            projects,
            lastSaved: Date.now()
        };
        localStorage.setItem(`${STORAGE_PREFIX}projects_${userId}`, JSON.stringify(data));
        console.log('💾 Projects saved locally:', projects.length, 'projects');
    } catch (e) {
        console.error('Failed to save projects locally:', e);
        // Check if it's a quota exceeded error
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
            alert('Local storage is full. Please delete some projects or clear browser data.');
        }
        throw e;
    }
};

// Load projects from localStorage
export const loadProjectsLocally = (userId: string): any[] => {
    try {
        const stored = localStorage.getItem(`${STORAGE_PREFIX}projects_${userId}`);
        if (!stored) {
            console.log('📂 No local projects found');
            return [];
        }
        const data = JSON.parse(stored);
        console.log('📂 Projects loaded locally:', data.projects.length, 'projects');
        return data.projects || [];
    } catch (e) {
        console.error('Failed to load projects locally:', e);
        return [];
    }
};

// Save user preferences to localStorage
export const savePreferencesLocally = (userId: string, preferences: any): void => {
    try {
        localStorage.setItem(`${STORAGE_PREFIX}prefs_${userId}`, JSON.stringify(preferences));
        console.log('⚙️ Preferences saved locally');
    } catch (e) {
        console.error('Failed to save preferences locally:', e);
    }
};

// Load user preferences from localStorage
export const loadPreferencesLocally = (userId: string): any => {
    try {
        const stored = localStorage.getItem(`${STORAGE_PREFIX}prefs_${userId}`);
        if (!stored) {
            return {};
        }
        return JSON.parse(stored);
    } catch (e) {
        console.error('Failed to load preferences locally:', e);
        return {};
    }
};

// Create a mock share link (just stores locally, not actually shareable without backend)
export const createShareLinkLocally = (userId: string, projectId: string): string => {
    const shortId = Math.random().toString(36).substring(2, 8);
    const shareData = { userId, projectId };
    localStorage.setItem(`${STORAGE_PREFIX}share_${shortId}`, JSON.stringify(shareData));
    console.log('🔗 Share link created locally (Note: only works on this device)');
    return shortId;
};

// Resolve a local share link
export const resolveShareLinkLocally = (shortId: string): { userId: string; projectId: string } | null => {
    try {
        const stored = localStorage.getItem(`${STORAGE_PREFIX}share_${shortId}`);
        if (!stored) {
            return null;
        }
        return JSON.parse(stored);
    } catch (e) {
        console.error('Failed to resolve share link locally:', e);
        return null;
    }
};

// Get shared project from localStorage
export const getSharedProjectLocally = (userId: string, projectId: string): any | null => {
    try {
        const projects = loadProjectsLocally(userId);
        const project = projects.find((p: any) => p.id === projectId);
        return project || null;
    } catch (e) {
        console.error('Failed to get shared project locally:', e);
        return null;
    }
};

// Check if we're in local-only mode
export const isLocalMode = (): boolean => {
    const mode = localStorage.getItem(`${STORAGE_PREFIX}mode`);
    return mode === 'local';
};

// Set local-only mode
export const setLocalMode = (enabled: boolean): void => {
    if (enabled) {
        localStorage.setItem(`${STORAGE_PREFIX}mode`, 'local');
        console.log('📍 Running in LOCAL MODE - data stored in browser only');
    } else {
        localStorage.removeItem(`${STORAGE_PREFIX}mode`);
        console.log('☁️ Running in CLOUD MODE - data synced to Supabase');
    }
};

// Get storage stats
export const getStorageStats = () => {
    let totalSize = 0;
    let fileCount = 0;
    let projectCount = 0;

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
            const value = localStorage.getItem(key);
            if (value) {
                totalSize += value.length;
                if (key.includes('_file_')) fileCount++;
                if (key.includes('_projects_')) projectCount++;
            }
        }
    }

    return {
        totalSize,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        fileCount,
        projectCount,
        percentUsed: ((totalSize / (5 * 1024 * 1024)) * 100).toFixed(1) // Assume 5MB limit
    };
};

// Clear all local storage data (for debugging)
export const clearAllLocalData = (): void => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
            keys.push(key);
        }
    }
    keys.forEach(key => localStorage.removeItem(key));
    console.log('🗑️ All local Sound Map data cleared');
};
