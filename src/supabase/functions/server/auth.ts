import { Context } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Client with anon key (least privilege)
const getSupabaseAuthClient = () => {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );
};

export async function requireUser(c: Context) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader) {
    return unauthorized(c);
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return unauthorized(c);
  }

  const supabase = getSupabaseAuthClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return unauthorized(c);
  }

  // 🔒 Future checks go here
  // if (data.user.banned) return forbidden(c);

  return { user: data.user, response: null };
}

// Helpers keep responses consistent
function unauthorized(c: Context) {
  return {
    user: null,
    response: c.json({ error: "Unauthorized" }, 401),
  };
}

// (Optional later)
function forbidden(c: Context) {
  return {
    user: null,
    response: c.json({ error: "Forbidden" }, 403),
  };
}
