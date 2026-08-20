import { generateImage } from 'ai';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { WorkspaceMode } from '@/lib/room-model/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type AssetRow = {
  id: string;
  object_path: string;
  mime_type: string;
  capture_context: Record<string, unknown> | null;
};

function sourcePhoto(asset: AssetRow) {
  const method = String(asset.capture_context?.captureMethod ?? '');
  return method === 'guided_web_photo' || (!method && !asset.capture_context?.sourceAssetId);
}

function extensionFor(mediaType: string) {
  if (mediaType === 'image/jpeg') return 'jpg';
  if (mediaType === 'image/webp') return 'webp';
  return 'png';
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
    'Preserve the exact camera viewpoint and keep the photographed room recognizable.',
    'Preserve the room shell, doors, windows, permanent architecture, perspective, scale, occlusion, lighting direction, and recognizable existing surfaces unless the user goal explicitly requires changing a non-structural finish.',
    'Make the smallest believable functional changes needed to demonstrate the proposal.',
    'Do not convert the image into a floor plan, CAD drawing, diagram, collage, or mood board.',
    'Do not add text, labels, measurement callouts, dimensions, watermarks, borders, or UI to the image.',
    'Keep materials, shadows, depth, and object placement photorealistic and physically plausible.',
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
    .limit(80);
  if (assetError) return NextResponse.json({ error: assetError.message }, { status: 500 });

  const source = ((assets ?? []) as AssetRow[]).find(sourcePhoto);
  if (!source) return NextResponse.json({ error: 'Add a room photo before generating a visual proposal.' }, { status: 400 });

  const { data: sourceBlob, error: downloadError } = await supabase.storage.from('room-assets').download(source.object_path);
  if (downloadError || !sourceBlob) return NextResponse.json({ error: 'Unable to read the private room photo.' }, { status: 500 });

  const prompt = buildPrompt(mode, goal, room.name);
  const model = process.env.NESTMETRIC_IMAGE_MODEL || 'openai/gpt-image-2';

  let generated;
  try {
    const sourceBytes = new Uint8Array(await sourceBlob.arrayBuffer());
    const result = await generateImage({
      model,
      prompt: {
        text: prompt,
        images: [sourceBytes],
      },
      providerOptions: {
        openai: { quality: 'medium' },
      },
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(55_000),
    });
    generated = result.image;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Photo generation failed.';
    return NextResponse.json({ error: message, code: 'photo_ai_failed' }, { status: 502 });
  }

  const bytes = Buffer.from(generated.uint8Array);
  const mediaType = generated.mediaType || 'image/png';
  const extension = extensionFor(mediaType);
  const objectPath = `${ownerId}/${roomId}/proposals/${crypto.randomUUID()}.${extension}`;
  const proposalBlob = new Blob([bytes], { type: mediaType });
  const { error: uploadError } = await supabase.storage.from('room-assets').upload(objectPath, proposalBlob, {
    contentType: mediaType,
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: asset, error: metadataError } = await supabase
    .from('room_assets')
    .insert({
      room_id: roomId,
      owner_id: ownerId,
      object_path: objectPath,
      mime_type: mediaType,
      byte_length: bytes.byteLength,
      capture_context: {
        captureMethod: 'ai_photo_proposal',
        sourceAssetId: source.id,
        mode,
        goal,
        model,
        gateway: 'vercel_ai_gateway',
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
