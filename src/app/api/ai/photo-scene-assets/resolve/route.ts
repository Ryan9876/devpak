import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { PhotoScene } from '@/lib/photo/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const ownerId = claimsData?.claims?.sub;
  if (claimsError || !ownerId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const sourceObjectPath = String(body.sourceObjectPath || '');
  const requestedItemId = String(body.itemId || '');
  if (!sourceObjectPath) {
    return NextResponse.json({ error: 'Source photo path is required.' }, { status: 400 });
  }

  const { data: source, error } = await supabase
    .from('room_assets')
    .select('id,room_id,capture_context')
    .eq('owner_id', ownerId)
    .eq('object_path', sourceObjectPath)
    .is('deleted_at', null)
    .single();

  if (error || !source) {
    return NextResponse.json({ error: 'Source room photo not found.' }, { status: 404 });
  }

  const scene = source.capture_context?.scene as PhotoScene | undefined;
  const movable = scene?.items?.find((item) => item.id === requestedItemId && item.draggable)
    ?? scene?.items?.find((item) => item.draggable && !item.fixed);
  if (!scene || !movable) {
    return NextResponse.json({ error: 'Calibrated movable photo object is required.' }, { status: 409 });
  }

  return NextResponse.json({ roomId: source.room_id, sourceAssetId: source.id, itemId: movable.id });
}
