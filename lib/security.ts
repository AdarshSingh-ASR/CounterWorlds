import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const URL = /(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|org|net|edu|io)\b)/i;
const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const PROFANITY = /\b(?:fuck|shit|bitch|cunt|nigger|faggot)\b/i;

export function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6);
}

export function validateNickname(value: string) {
  const nickname = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (nickname.length < 2) throw new Error("Choose a nickname with at least 2 characters");
  if (nickname.length > 24) throw new Error("Keep your nickname to 24 characters or fewer");
  if (EMAIL.test(nickname) || URL.test(nickname) || PHONE.test(nickname)) throw new Error("Use a nickname, not contact information");
  if (PROFANITY.test(nickname)) throw new Error("Choose a classroom-safe nickname");
  if (/^[\p{P}\p{S}\s]+$/u.test(nickname)) throw new Error("Nickname must include letters or numbers");
  return nickname;
}

export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function networkHash(value: string) {
  const secret = process.env.IP_HASH_SECRET ?? process.env.BETTER_AUTH_SECRET ?? "local-ip-hash-secret";
  return createHmac("sha256", secret).update(value || "unknown").digest("hex");
}

export function requestNetworkKey(headers: Headers) {
  const forwarded = headers.get("x-vercel-forwarded-for") ?? headers.get("x-forwarded-for") ?? "unknown";
  return networkHash(forwarded.split(",")[0].trim());
}

function encryptionKey() {
  const encoded = process.env.AI_CREDENTIAL_ENCRYPTION_KEY;
  if (!encoded) throw new Error("AI_CREDENTIAL_ENCRYPTION_KEY is not configured");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("AI_CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return key;
}

export function encryptSecret(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    lastFour: plaintext.slice(-4),
    keyVersion: 1,
  };
}

export function decryptSecret(value: { ciphertext: string; iv: string; auth_tag: string }) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.auth_tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64")), decipher.final()]).toString("utf8");
}
