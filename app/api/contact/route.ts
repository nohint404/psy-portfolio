import { isAllowedOrigin, validateContact } from "@/lib/contact";

// Instance-local abuse guard. Use an edge/distributed limiter for a high-traffic deployment.
const attempts = new Map<string, { count: number; expires: number }>();
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin, request.headers.get("host"))) return Response.json({ success: false, message: "Send your message from the portfolio." }, { status: 403 });
  const address = (request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || "local").split(",")[0].trim().slice(0, 100);
  const now = Date.now();
  for (const [key, value] of attempts) if (value.expires < now) attempts.delete(key);
  if (attempts.size >= 4096 && !attempts.has(address)) return Response.json({ success: false, message: "The message book is busy. Try again shortly." }, { status: 429 });
  const attempt = attempts.get(address) || { count: 0, expires: now + 60000 };
  attempt.count++; attempts.set(address, attempt);
  if (attempt.count > 5) return Response.json({ success: false, message: "Too many attempts. Please wait one minute." }, { status: 429, headers: { "Retry-After": "60" } });
  if (Number(request.headers.get("content-length") || 0) > 12000) return Response.json({ success: false, message: "Message is too long." }, { status: 413 });
  let data;
  try { const text = await request.text(); if (text.length > 12000) throw new Error("size"); data = validateContact(JSON.parse(text)); } catch { return Response.json({ success: false, message: "The message could not be read. Please try again." }, { status: 400 }); }
  if (!data) return Response.json({ success: false, message: "Check your name, email and message (10-1800 characters)." }, { status: 400 });
  if (data.website) return Response.json({ success: false, message: "Message rejected." }, { status: 400 });
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return Response.json({ success: false, message: "The message book is not connected yet. Reach Psymariux through GitHub instead." }, { status: 503 });
  try {
    const response = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "Psymariux Workshop", allowed_mentions: { parse: [] }, embeds: [{ title: "New portfolio message", color: 0x59c7ec, fields: [{ name: "Name", value: data.name }, { name: "Email", value: data.email }, { name: "Message", value: data.message }], timestamp: new Date().toISOString() }] }), signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("delivery");
    return Response.json({ success: true });
  } catch { return Response.json({ success: false, message: "Your message was not delivered. Please try again, or reach Psymariux through GitHub." }, { status: 502 }); }
}
