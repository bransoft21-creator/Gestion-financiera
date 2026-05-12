import { createHash } from "node:crypto";

export function safeUserId(id: string) {
  return createHash("sha256").update(id).digest("hex").slice(0, 16);
}
