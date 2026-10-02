export function isAllowedOrigin(origin: string | null, host: string | null) {
  if (!origin) return true;
  try { const url = new URL(origin); return (url.protocol === "https:" || url.protocol === "http:") && url.host === host; } catch { return false; }
}

export function validateContact(value: unknown): { name: string; email: string; message: string; website: string } | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (["name", "email", "message"].some(k => typeof data[k] !== "string")) return null;
  const name = (data.name as string).trim(), email = (data.email as string).trim(), message = (data.message as string).trim();
  if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || message.length < 10 || message.length > 1800) return null;
  return { name, email, message, website: typeof data.website === "string" ? data.website : "" };
}
