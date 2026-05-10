const AI_ALLOWED_EMAILS = new Set(["bransoft21@gmail.com"]);

export function isAiEnabled(email: string): boolean {
  return AI_ALLOWED_EMAILS.has(email);
}
