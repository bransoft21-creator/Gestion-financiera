import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAiEnabled } from "@/lib/feature-flags";
import { ProfileClient } from "./profile-client";

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const avatarUrl =
    typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null;

  const provider =
    typeof user.app_metadata?.provider === "string" ? user.app_metadata.provider : "email";

  return (
    <ProfileClient
      userEmail={user.email ?? null}
      userName={getDisplayName(user.user_metadata)}
      avatarUrl={avatarUrl}
      provider={provider}
      isAiEnabled={user.email ? isAiEnabled(user.email) : false}
    />
  );
}

function getDisplayName(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.full_name ?? metadata?.name;
  return typeof value === "string" ? value : null;
}
