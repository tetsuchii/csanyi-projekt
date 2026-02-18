import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// CONSTANTS
const BUCKET_NAME = "make-5be515e6-assets";

// Helper to create Supabase Admin Client
const getSupabaseAdmin = () => {
    return createClient(
        Deno.env.get('SUPABASE_URL') || '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );
}

// Initialize Bucket
app.get("/make-server-5be515e6/init", async (c) => {
    const supabase = getSupabaseAdmin();
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME);
    if (!bucketExists) {
      await supabase.storage.createBucket(BUCKET_NAME, {
          public: false,
          fileSizeLimit: 52428800, // 50MB
      });
    }
    return c.json({ status: "initialized" });
});

// Health check endpoint
app.get("/make-server-5be515e6/health", (c) => {
  return c.json({ status: "ok" });
});

// ... (Signup and Invite routes remain the same)

// ---------------------------------------------------------------------------
// ASSET MANAGEMENT (Storage)
// ---------------------------------------------------------------------------

app.post("/make-server-5be515e6/storage/upload-url", async (c) => {
    try {
        const accessToken = c.req.header('Authorization')?.split(' ')[1];
        if (!accessToken) return c.json({ error: "Unauthorized" }, 401);

        const { path } = await c.req.json();
        if (!path) return c.json({ error: "Path required" }, 400);

        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUploadUrl(path);

        if (error) return c.json({ error: error.message }, 400);
        return c.json({ url: data.signedUrl, token: data.token, path: path });
    } catch (err) {
        return c.json({ error: "Internal server error" }, 500);
    }
});

app.post("/make-server-5be515e6/storage/get-url", async (c) => {
    try {
        const accessToken = c.req.header('Authorization')?.split(' ')[1];
        if (!accessToken) return c.json({ error: "Unauthorized" }, 401);

        const { path } = await c.req.json();
        if (!path) return c.json({ error: "Path required" }, 400);

        const supabase = getSupabaseAdmin();
        // Create a signed URL valid for 2 hours (7200 seconds)
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(path, 7200);

        if (error) return c.json({ error: error.message }, 400);
        return c.json({ url: data.signedUrl });
    } catch (err) {
        return c.json({ error: "Internal server error" }, 500);
    }
});

// ---------------------------------------------------------------------------
// DATA PERSISTENCE (KV Store)
// ---------------------------------------------------------------------------

app.get("/make-server-5be515e6/projects", async (c) => {
    try {
        const accessToken = c.req.header('Authorization')?.split(' ')[1];
        if (!accessToken) return c.json({ error: "Unauthorized" }, 401);

        const supabase = getSupabaseAdmin();
        const { data: { user }, error } = await supabase.auth.getUser(accessToken);
        if (error || !user) return c.json({ error: "Unauthorized" }, 401);

        const key = `projects_${user.id}`;
        const value = await kv.get(key);
        
        return c.json({ projects: value || [] });
    } catch (err) {
        console.error(err);
        return c.json({ error: "Internal server error" }, 500);
    }
});

app.post("/make-server-5be515e6/projects", async (c) => {
    try {
        const accessToken = c.req.header('Authorization')?.split(' ')[1];
        if (!accessToken) return c.json({ error: "Unauthorized" }, 401);

        const supabase = getSupabaseAdmin();
        const { data: { user }, error } = await supabase.auth.getUser(accessToken);
        if (error || !user) return c.json({ error: "Unauthorized" }, 401);

        const { projects } = await c.req.json();
        const key = `projects_${user.id}`;
        
        await kv.set(key, projects);
        
        return c.json({ success: true });
    } catch (err) {
        console.error(err);
        return c.json({ error: "Internal server error" }, 500);
    }
});

// Signup Route (Auto-confirm email)
app.post("/make-server-5be515e6/signup", async (c) => {
    try {
        const { email, password, name } = await c.req.json();
        
        if (!email || !password) {
            return c.json({ error: "Email and password are required" }, 400);
        }

        const supabase = getSupabaseAdmin();
        
        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            user_metadata: { full_name: name },
            email_confirm: true
        });

        if (error) {
            console.error("Signup error:", error);
            return c.json({ error: error.message }, 400);
        }

        return c.json({ data });
    } catch (err) {
        console.error("Unexpected signup error:", err);
        return c.json({ error: "Internal server error" }, 500);
    }
});

// Invite Route
app.post("/make-server-5be515e6/invite", async (c) => {
    try {
        const accessToken = c.req.header('Authorization')?.split(' ')[1];
        if (!accessToken) {
            return c.json({ error: "Unauthorized" }, 401);
        }

        const supabase = getSupabaseAdmin();
        // Verify the requester is a valid user
        const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

        if (authError || !user) {
             return c.json({ error: "Unauthorized" }, 401);
        }

        // In a real app, check if 'user' is an admin. 
        // For now, any logged in user can invite (prototype mode).

        const { email } = await c.req.json();
        if (!email) {
            return c.json({ error: "Email is required" }, 400);
        }

        const { data, error } = await supabase.auth.admin.inviteUserByEmail(email);
        
        if (error) {
            return c.json({ error: error.message }, 400);
        }

        return c.json({ message: "Invitation sent (if email configured) or user created." });
    } catch (err) {
        return c.json({ error: "Internal server error" }, 500);
    }
});

// ---------------------------------------------------------------------------
// USER PREFERENCES
// ---------------------------------------------------------------------------

app.get("/make-server-5be515e6/user/preferences", async (c) => {
    try {
        const accessToken = c.req.header('Authorization')?.split(' ')[1];
        if (!accessToken) return c.json({ error: "Unauthorized" }, 401);

        const supabase = getSupabaseAdmin();
        const { data: { user }, error } = await supabase.auth.getUser(accessToken);
        if (error || !user) return c.json({ error: "Unauthorized" }, 401);

        const key = `prefs_${user.id}`;
        const prefs = await kv.get(key);
        
        return c.json({ preferences: prefs || {} });
    } catch (err) {
        return c.json({ error: "Internal server error" }, 500);
    }
});

app.post("/make-server-5be515e6/user/preferences", async (c) => {
    try {
        const accessToken = c.req.header('Authorization')?.split(' ')[1];
        if (!accessToken) return c.json({ error: "Unauthorized" }, 401);

        const supabase = getSupabaseAdmin();
        const { data: { user }, error } = await supabase.auth.getUser(accessToken);
        if (error || !user) return c.json({ error: "Unauthorized" }, 401);

        const body = await c.req.json();
        const key = `prefs_${user.id}`;
        
        // Merge with existing
        const existing = (await kv.get(key)) || {};
        await kv.set(key, { ...existing, ...body });
        
        return c.json({ success: true });
    } catch (err) {
        return c.json({ error: "Internal server error" }, 500);
    }
});

// ---------------------------------------------------------------------------
// AUDIO VALIDATION
// ---------------------------------------------------------------------------

app.post("/make-server-5be515e6/validate-audio", async (c) => {
    try {
        const contentType = c.req.header('content-type');
        
        // Validate MIME type
        const allowedMimeTypes = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/ogg', 'audio/x-m4a'];
        
        if (!contentType || !allowedMimeTypes.some(type => contentType.includes(type))) {
            return c.json({ 
                valid: false, 
                error: 'Unsupported audio format. Only MP3, M4A (AAC), and OGG are allowed.' 
            }, 400);
        }

        // Get file from request
        const formData = await c.req.formData();
        const file = formData.get('file') as File;
        
        if (!file) {
            return c.json({ valid: false, error: 'No file provided' }, 400);
        }

        // Validate file signature (magic bytes)
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        
        // Check for valid audio file signatures
        const isMP3 = (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) || // MP3 frame
                      (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33); // ID3
        const isM4A = bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70; // ftyp
        const isOGG = bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53; // OggS
        
        if (!isMP3 && !isM4A && !isOGG) {
            return c.json({ 
                valid: false, 
                error: 'Invalid or corrupted audio file. File signature does not match allowed formats.' 
            }, 400);
        }

        // Check for executable headers or suspicious content
        const hasExecutableSignature = 
            (bytes[0] === 0x4D && bytes[1] === 0x5A) || // MZ (Windows executable)
            (bytes[0] === 0x7F && bytes[1] === 0x45 && bytes[2] === 0x4C && bytes[3] === 0x46) || // ELF
            (bytes[0] === 0xCA && bytes[1] === 0xFE && bytes[2] === 0xBA && bytes[3] === 0xBE); // Mach-O
        
        if (hasExecutableSignature) {
            return c.json({ 
                valid: false, 
                error: 'File appears to be executable or malicious. Upload rejected.' 
            }, 400);
        }

        return c.json({ valid: true });
    } catch (err) {
        console.error('Audio validation error:', err);
        return c.json({ valid: false, error: 'Validation failed' }, 500);
    }
});

// ---------------------------------------------------------------------------
// REPORTING SYSTEM
// ---------------------------------------------------------------------------

app.post("/make-server-5be515e6/report-audio", async (c) => {
    try {
        const { projectId, hotspotId, reason } = await c.req.json();
        
        if (!projectId || !hotspotId || !reason) {
            return c.json({ error: 'Missing required fields' }, 400);
        }

        const reportId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const key = `report_${reportId}`;
        
        await kv.set(key, {
            projectId,
            hotspotId,
            reason,
            timestamp: new Date().toISOString(),
            status: 'pending'
        });
        
        console.log(`Audio report created: ${reportId} for project ${projectId}, hotspot ${hotspotId}`);
        
        return c.json({ success: true, reportId });
    } catch (err) {
        console.error('Report submission error:', err);
        return c.json({ error: 'Failed to submit report' }, 500);
    }
});

// ---------------------------------------------------------------------------
// PUBLIC ACCESS (Shared Projects)
// ---------------------------------------------------------------------------

app.post("/make-server-5be515e6/share", async (c) => {
    try {
        const { userId, projectId } = await c.req.json();
        if (!userId || !projectId) {
            return c.json({ error: "Missing parameters" }, 400);
        }

        const shortId = Math.random().toString(36).substring(2, 8);
        const key = `share_${shortId}`;
        
        await kv.set(key, { userId, projectId });
        
        return c.json({ shortId });
    } catch (err) {
        return c.json({ error: "Internal server error" }, 500);
    }
});

app.get("/make-server-5be515e6/share/resolve", async (c) => {
    try {
        const shortId = c.req.query('id');
        if (!shortId) {
            return c.json({ error: "Missing ID" }, 400);
        }

        const data = await kv.get(`share_${shortId}`);
        if (!data) {
            return c.json({ error: "Link expired or invalid" }, 404);
        }

        return c.json(data);
    } catch (err) {
        return c.json({ error: "Internal server error" }, 500);
    }
});

app.get("/make-server-5be515e6/public/project", async (c) => {
    try {
        const userId = c.req.query('userId');
        const projectId = c.req.query('projectId');

        if (!userId || !projectId) {
            return c.json({ error: "Missing parameters" }, 400);
        }

        const key = `projects_${userId}`;
        const projects = await kv.get(key) as any[]; 

        if (!projects || !Array.isArray(projects)) {
            return c.json({ error: "Project not found" }, 404);
        }

        const rawProject = projects.find((p: any) => p.id === projectId);

        if (!rawProject) {
            return c.json({ error: "Project not found" }, 404);
        }

        // Hydrate with Signed URLs
        const supabase = getSupabaseAdmin();
        const p = { ...rawProject };

        const sign = async (path: string) => {
            if (!path) return null;
            const { data } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(path, 7200);
            return data?.signedUrl || null;
        };

        if (p.imagePath) p.imageUrl = await sign(p.imagePath);
        if (p.introAudioPath) p.introAudioUrl = await sign(p.introAudioPath);
        
        p.hotspots = await Promise.all(p.hotspots.map(async (h: any) => {
            if (h.audioPath) h.audioUrl = await sign(h.audioPath);
            return h;
        }));
        
        p.globalChannels = await Promise.all((p.globalChannels || []).map(async (c: any) => {
            if (c.audioPath) c.audioUrl = await sign(c.audioPath);
            return c;
        }));

        return c.json({ project: p });
    } catch (err) {
        console.error(err);
        return c.json({ error: "Internal server error" }, 500);
    }
});

Deno.serve(app.fetch);