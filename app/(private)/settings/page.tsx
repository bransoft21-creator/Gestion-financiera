import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getUserPreferences } from "@/server/services/user-preferences";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { userProfile } = await getCurrentUser();
  const preferences = await getUserPreferences(userProfile.id);

  return <SettingsClient preferences={preferences} />;
}
