import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { isCopilotEnabled } from "@/lib/feature-flags";
import { CopilotClient } from "./copilot-client";

export const metadata = { title: "Copiloto Financiero — Meridian" };

export default async function CopilotPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await prisma.userProfile.findUnique({
    where: { supabaseId: user.id },
    select: { id: true },
  });
  if (!profile) redirect("/login");

  if (!isCopilotEnabled(user.email ?? "")) {
    redirect("/dashboard");
  }

  return <CopilotClient />;
}
