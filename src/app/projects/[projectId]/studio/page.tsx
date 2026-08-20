import { notFound, redirect } from 'next/navigation';
import Studio from '@/components/Studio';
import { loadProjectRoom } from '@/lib/room-model/repository';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ProjectStudioPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: claimsData, error } = await supabase.auth.getClaims();
  const ownerId = claimsData?.claims?.sub;
  if (error || !ownerId) redirect('/login');

  const room = await loadProjectRoom(supabase, ownerId, projectId);
  if (!room) notFound();

  return <Studio initialRoom={room} ownerId={ownerId} />;
}
