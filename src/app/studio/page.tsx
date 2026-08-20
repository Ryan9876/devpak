import { redirect } from 'next/navigation';
import Studio from '@/components/Studio';
import { createProjectWithStarterRoom, listProjects } from '@/lib/room-model/repository';
import { demoRoom } from '@/lib/room-model/demo';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function StudioPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (!configured) return <Studio initialRoom={demoRoom} ownerId="demo" demo />;

  const supabase = await createClient();
  const { data: claimsData, error } = await supabase.auth.getClaims();
  const ownerId = claimsData?.claims?.sub;
  if (error || !ownerId) redirect('/login');

  const projects = await listProjects(supabase, ownerId);
  if (projects[0]) redirect(`/projects/${projects[0].id}/studio`);

  const { projectId } = await createProjectWithStarterRoom(supabase, ownerId, 'My first room');
  redirect(`/projects/${projectId}/studio`);
}
