import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createStarterRoom, loadFirstRoom } from '@/lib/room-model/repository';
import { demoRoom } from '@/lib/room-model/demo';
import Studio from '@/components/Studio';

export const dynamic = 'force-dynamic';

export default async function StudioPage() {
  const configured=Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if(!configured) return <Studio initialRoom={demoRoom} ownerId="demo" demo />;
  const supabase = await createClient();
  const { data: claimsData, error } = await supabase.auth.getClaims();
  const ownerId = claimsData?.claims?.sub;
  if (error || !ownerId) redirect('/login');
  let room = await loadFirstRoom(supabase, ownerId);
  if (!room) { await createStarterRoom(supabase, ownerId); room = await loadFirstRoom(supabase, ownerId); }
  if (!room) throw new Error('Unable to initialize the Room Model.');
  return <Studio initialRoom={room} ownerId={ownerId} />;
}
