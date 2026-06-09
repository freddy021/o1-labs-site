import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Origins allowed to call this function from the browser.
const ALLOWED_ORIGINS = new Set([
  "https://o1-labs.com",
  "https://www.o1-labs.com",
  "https://o1-labs-site.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:5500",
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://o1-labs.com";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, cors);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400, cors);
  }

  // Honeypot: real users never fill the hidden 'website' field. Pretend success for bots.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return json({ ok: true }, 200, cors);
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const name = str(body.name);
  const email = str(body.email);
  const company = str(body.company) || null;
  const interest = str(body.interest) || null;
  const message = str(body.message) || null;

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!name || name.length > 200) {
    return json({ error: "Please enter your name." }, 422, cors);
  }
  if (!emailRe.test(email) || email.length > 320) {
    return json({ error: "Please enter a valid email address." }, 422, cors);
  }
  if (message && message.length > 5000) {
    return json({ error: "Message is too long." }, 422, cors);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await supabase.from("contact_submissions").insert({
    name,
    email,
    company,
    interest,
    message,
    user_agent: req.headers.get("user-agent"),
  });

  if (error) {
    console.error("contact_submissions insert error:", error.message);
    return json({ error: "Something went wrong saving your message. Please try again." }, 500, cors);
  }

  return json({ ok: true }, 200, cors);
});
