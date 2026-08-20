import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { WorkspaceMode } from '@/lib/room-model/types';

export const dynamic = 'force-dynamic';

type AssetRow = {
  id: string;
  object_path: string;
  mime_type: string;
  capture_context: Record<string, unknown> | null;
};

function sourcePhoto(asset: AssetRow) {
  return asset.capture_context?.captureMethod !== 'ai_photo_proposal';
}

function buildPrompt(mode: WorkspaceMode, goal: string, roomName: string) {
  const modeInstruction =
    mode === 'organize'
      ? 'Improve organization, storage, visual calm, and clear circulation using the room and belongings already visible where practical.'
      : mode === 'arrange'
        ? 'Create a believable alternative furniture arrangement that improves function and circulation while preserving the room itself.'
        : 'Visualize a practical build concept that fits the photographed space. Treat it as a design concept, not a construction document.';

  return [
    `Edit this photograph of ${roomName} into a realistic NestMetric visual proposal.`,
    modeInstruction,
    `User goal: ${goal || 'Improve the usefulness of the room.'}`,
    'Preserve the camera viewpoint, room shell, doors, windows, permanent architecture, lighting direction, and recognizable existing surfaces unless the user goal explicitly requires changing a non-structural finish.',
    'Do not convert the image into a floor plan, CAD drawing, diagram, collage, or mood board.',
    'Keep perspective, scale, occlusion, shadows, and materials photorealistic. Make the smallest believable changes needed to demonstrate the proposal.',
    'Do not add text, labels, measurement callouts, dimensions, watermarks, or UI to the image.',
  ].join(' ');
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const ownerId = claimsData?.claims?.sub;
  if (claimsError || !ownerId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const roomId = String(body.roomId || '');
  const goal = String(body.goal || '').trim().slice(0, 1200);
  const mode = String(body.mode || 'organize') as WorkspaceMode;
  if (!roomId || !['organize', 'arrange', 'build'].includes(mode)) {
    return NextResponse.json({ error: 'Invalid photo proposal request.' }, { status: 400 });
  }

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('id,name')
    .eq('id', roomId)
    .eq('owner_id', ownerId)
    .single();
  if (roomError || !room) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });

  const { data: assets, error: assetError } = await supabase
    .from('room_assets')
    .select('id,object_path,mime_type,capture_context')
    .eq('room_id', roomId)
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(24);
  if (assetError) return NextResponse.json({ error: assetError.message }, { status: 500 });

  const source = ((assets ?? []) as AssetRow[]).find(sourcePhoto);
  if (!source) return NextResponse.json({ error: 'Add a room photo before generating a visual proposal.' }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Photo generation is not configured for this deployment.', code: 'photo_ai_not_configured' },
      { status: 503 },
    );
  }

  const { data: sourceBlob, error: downloadError } = await supabase.storage.from('room-assets').download(source.object_path);
  if (downloadError || !sourceBlob) return NextResponse.json({ error: 'Unable to read the private room photo.' }, { status: 500 });

  const prompt = buildPrompt(mode, goal, room.name);
  const form = new FormData();
  form.append('model', process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2');
  form.append('quality', 'medium');
  form.append('size', 'auto');
  form.append('image[]', sourceBlob, source.object_path.split('/').pop() || 'room-photo');
  form.append('prompt', prompt);

  const imageResponse = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const imageJson: any = await imageResponse.json().catch(() => null);
  if (!imageResponse.ok) {
    const message = imageJson?.error?.message || `Photo generation failed (${imageResponse.status}).`;
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const base64 = imageJson?.data?.[0]?.b64_json;
  if (!base64) return NextResponse.json({ error: 'Photo generation returned no image.' }, { status: 502 });

  const bytes = Buffer.from(base64, 'base64');
  const objectPath = `${ownerId}/${roomId}/proposals/${crypto.randomUUID()}.png`;
  const proposalBlob = new Blob([bytes], { type: 'image/png' });
  const { error: uploadError } = await supabase.storage.from('room-assets').upload(objectPath, proposalBlob, {
    contentType: 'image/png',
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: asset, error: metadataError } = await supabase
    .from('room_assets')
    .insert({
      room_id: roomId,
      owner_id: ownerId,
      object_path: objectPath,
      mime_type: 'image/png',
      byte_length: bytes.byteLength,
      capture_context: {
        captureMethod: 'ai_photo_proposal',
        sourceAssetId: source.id,
        mode,
        goal,
        model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2',
        generatedAt: new Date().toISOString(),
      },
    })
    .select('id,object_path,created_at,capture_context')
    .single();

  if (metadataError || !asset) {
    await supabase.storage.from('room-assets').remove([objectPath]);
    return NextResponse.json({ error: metadataError?.message || 'Unable to save photo proposal metadata.' }, { status: 500 });
  }

  const { data: signed } = await supabase.storage.from('room-assets').createSignedUrl(objectPath, 3600);
  return NextResponse.json({ asset, signedUrl: signed?.signedUrl ?? null });
}
