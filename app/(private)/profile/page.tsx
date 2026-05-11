import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProfileClient } from "./profile-client";

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <ProfileClient
      userEmail={user.email ?? null}
      userName={getDisplayName(user.user_metadata)}
    />
  );
}

function getDisplayName(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.full_name ?? metadata?.name;
  return typeof value === "string" ? value : null;
}
