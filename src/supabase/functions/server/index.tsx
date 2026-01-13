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