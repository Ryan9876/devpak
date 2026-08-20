import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/supabase/config';
import { createStarterRoom, loadFirstRoom } from '@/lib/room-model/repository';
import { demoRoom } from '@/lib/room-model/demo';
import Studio from '@/components/Studio';

export const dynamic = 'force-dynamic';

export default async function StudioPage() {
  if(!supabaseConfigured) return <Studio initialRoom={demoRoom} ownerId="demo" demo />;
  const supabase = await createClient();
  const { data: claimsData, error } = await supabase.auth.getClaims();
  const ownerId = claimsData?.claims?.sub;
  if (error || !ownerId) redirect('/login');
  const room = await loadFirstRoom(supabase, ownerId);
  if (!room) {
    await createStarterRoom(supabase, ownerId);
    redirect('/studio');
  }
  return <Studio initialRoom={room} ownerId={ownerId} />;
}
