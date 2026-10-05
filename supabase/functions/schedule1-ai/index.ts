import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function consumeRateLimit(rateKey: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { allowed: false, reason: "rate_limit_unavailable" };
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/check_schedule1_ai_rate_limit`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        p_rate_key: rateKey,
        p_minute_limit: 5,
        p_hour_limit: 30,
        p_day_limit: 100,
        p_global_day_limit: 500,
      }),
    },
  );

  if (!response.ok) return { allowed: false, reason: "rate_limit_unavailable" };
  return await response.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  if (!OPENAI_API_KEY) {
    return json({ error: "AI není aktivní: v Supabase chybí secret OPENAI_API_KEY." }, 503);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Neplatný JSON." }, 400);
  }

  const forbiddenKeys = ["file","files","image","images","attachment","attachments","audio","video","blob"];
  const receivedKeys = Object.keys(body || {});
  const unexpected = receivedKeys.filter(k => !["message","context"].includes(k));
  if (unexpected.length || forbiddenKeys.some(k => receivedKeys.includes(k))) {
    return json({ error: "AI přijímá pouze textovou zprávu a volitelný herní kontext. Soubory a obrázky nejsou podporované." }, 400);
  }

  if (typeof body?.message !== "string") {
    return json({ error: "Dotaz musí být text." }, 400);
  }
  const message = body.message.trim().slice(0, 600);
  if (!message) return json({ error: "Chybí dotaz." }, 400);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Pro použití AI se musíš přihlásit." }, 401);
  }

  const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "GET",
    headers: {
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": authHeader,
    },
  });
  if (!authResponse.ok) {
    return json({ error: "Přihlášení není platné nebo vypršelo. Přihlas se znovu." }, 401);
  }
  const user = await authResponse.json();
  if (!user?.id) {
    return json({ error: "Uživatel nebyl ověřen." }, 401);
  }

  const isAdmin = user?.app_metadata?.role === "admin";
  if (!isAdmin) {
    const rateKey = await sha256Hex(`user:${user.id}`);
    const rate = await consumeRateLimit(rateKey);
    if (!rate?.allowed) {
      const reason = rate?.reason;
      const limitMessage =
        reason === "minute"
          ? "AI limit: maximálně 5 dotazů za minutu."
          : reason === "hour"
            ? "AI limit: maximálně 30 dotazů za hodinu."
            : reason === "day"
              ? "AI limit: tento účet už dnes vyčerpal 100 AI dotazů."
              : reason === "global"
                ? "AI pomocník dnes dosáhl bezpečnostního limitu pro všechny běžné uživatele. Zkus to zítra."
                : "AI je dočasně nedostupná. Zkus to za chvíli.";
      return json({ error: limitMessage }, reason === "rate_limit_unavailable" ? 503 : 429);
    }
  }

  const context = body?.context && typeof body.context === "object"
    ? body.context as Record<string, unknown>
    : {};

  const num = (v: unknown) => Number.isFinite(Number(v))
    ? Math.max(0, Math.min(1000, Number(v)))
    : "?";

  const system = `Jsi AI pomocník pro web Schedule 1 Helper. Odpovídej česky, stručně a prakticky. Pomáhej pouze s používáním helperu a hrou Schedule 1. Pokud si nejsi jistý, řekni to. Nevymýšlej přesné mapové souřadnice. Kontext databáze: zákazníci ${num(context.customers)}, dealeři ${num(context.dealers)}, recepty ${num(context.recipes)}, efekty ${num(context.effects)}.`;

  try {
    const openai = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + OPENAI_API_KEY,
      },
      body: JSON.stringify({
        model: "gpt-6-luna",
        reasoning: { effort: "none" },
        store: false,
        input: [
          { role: "system", content: system },
          { role: "user", content: message },
        ],
        max_output_tokens: 300,
      }),
    });

    const data = await openai.json();
    if (!openai.ok) {
      return json({ error: data?.error?.message || "OpenAI request selhal." }, 502);
    }

    const answer =
      data?.output_text ||
      data?.output
        ?.flatMap((item: any) => item?.content || [])
        ?.map((item: any) => item?.text || "")
        ?.join("") ||
      "AI nevrátila odpověď.";

    return json({ answer });
  } catch {
    return json({ error: "Spojení s AI se nepodařilo dokončit." }, 502);
  }
});