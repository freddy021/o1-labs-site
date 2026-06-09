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

// Best-effort email notification via Resend. No-op unless RESEND_API_KEY and
// RESEND_TO are configured as function secrets. Never throws to the caller.
async function notify(fields: {
  name: string;
  email: string;
  company: string | null;
  interest: string | null;
  message: string | null;
}): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("RESEND_TO");
  if (!apiKey || !to) return; // not configured yet

  const from = Deno.env.get("RESEND_FROM") ?? "o1 Labs <onboarding@resend.dev>";
  const subject = `New o1 Labs inquiry — ${fields.name}` +
    (fields.company ? ` (${fields.company})` : "");
  const text = [
    "New contact form submission from o1-labs.com:",
    "",
    `Name: ${fields.name}`,
    `Email: ${fields.email}`,
    `Company: ${fields.company ?? "—"}`,
    `Interest: ${fields.interest ?? "—"}`,
    "",
    "Message:",
    fields.message ?? "—",
    "",
  ].join("\n");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: fields.email,
        subject,
        text,
      }),
    });
    if (!res.ok) {
      console.error("Resend notification failed:", res.status, await res.text());
    }
  } catch (e) {
    console.error("Resend notification error:", e);
  }
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

  // Fire the notification but don't let it affect the user's response.
  await notify({ name, email, company, interest, message });

  return json({ ok: true }, 200, cors);
});
