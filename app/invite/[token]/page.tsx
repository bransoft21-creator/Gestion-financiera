import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InviteClient } from "./invite-client";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/invite/${encodeURIComponent(token)}`);
  }

  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md items-center">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Invitación a hogar</CardTitle>
            <CardDescription>Revisá el espacio compartido y aceptá explícitamente.</CardDescription>
          </CardHeader>
          <CardContent>
            <InviteClient token={token} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
