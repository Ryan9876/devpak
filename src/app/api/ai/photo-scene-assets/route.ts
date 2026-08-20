import { generateImage } from 'ai';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { PhotoScene } from '@/lib/photo/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type AssetRow = {
  id: string;
  object_path: string;
  mime_type: string;
  byte_length: number;
  capture_context: Record<string, unknown> | null;
  created_at: string;
};

function method(asset: AssetRow) {
  return String(asset.capture_context?.captureMethod ?? '');
}

function sourceId(asset: AssetRow) {
  return String(asset.capture_context?.sourceAssetId ?? '');
}

function itemId(asset: AssetRow) {
  return String(asset.capture_context?.itemId ?? '');
}

function extensionFor(mediaType: string) {
  if (mediaType === 'image/jpeg') return 'jpg';
  if (mediaType === 'image/webp') return 'webp';
  return 'png';
}

function imageDimensions(bytes: Uint8Array, mediaType: string) {
  if (mediaType === 'image/png' && bytes.length > 24) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (mediaType === 'image/jpeg' && bytes.length > 12 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
      const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
      const sof = [0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker);
      if (sof && offset + 8 < bytes.length) {
        return {
          height: (bytes[offset + 5] << 8) + bytes[offset + 6],
          width: (bytes[offset + 7] << 8) + bytes[offset + 8],
        };
      }
      if (!length || length < 2) break;
      offset += length + 2;
    }
  }
  return null;
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

function aspectRatioFor(dimensions: { width: number; height: number } | null): `${number}:${number}` | undefined {
  if (!dimensions?.width || !dimensions?.height) return undefined;
  const divisor = gcd(dimensions.width, dimensions.height);
  return `${Math.round(dimensions.width / divisor)}:${Math.round(dimensions.height / divisor)}` as `${number}:${number}`;
}

function cutoutSizeFor(dimensions: { width: number; height: number } | null): `${number}x${number}` {
  if (!dimensions) return '1024x1536';
  if (dimensions.width > dimensions.height * 1.12) return '1536x1024';
  if (dimensions.height > dimensions.width * 1.12) return '1024x1536';
  return '1024x1024';
}

async function signedAsset(supabase: Awaited<ReturnType<typeof createClient>>, asset: AssetRow) {
  const { data } = await supabase.storage.from('room-assets').createSignedUrl(asset.object_path, 3600);
  return { id: asset.id, signedUrl: data?.signedUrl ?? null, mimeType: asset.mime_type };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const ownerId = claimsData?.claims?.sub;
  if (claimsError || !ownerId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const roomId = String(body.roomId || '');
  const sourceAssetId = String(body.sourceAssetId || '');
  const requestedItemId = String(body.itemId || '');
  if (!roomId || !sourceAssetId) return NextResponse.json({ error: 'Room and source photo are required.' }, { status: 400 });

  const { data: source, error: sourceError } = await supabase
    .from('room_assets')
    .select('id,object_path,mime_type,byte_length,capture_context,created_at')
    .eq('id', sourceAssetId)
    .eq('room_id', roomId)
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .single();
  if (sourceError || !source) return NextResponse.json({ error: 'Source room photo not found.' }, { status: 404 });

  const sourceRow = source as AssetRow;
  const scene = sourceRow.capture_context?.scene as PhotoScene | undefined;
  if (!scene?.items?.length) return NextResponse.json({ error: 'Photo scene calibration is required first.' }, { status: 409 });
  const movable = scene.items.find((item) => item.id === requestedItemId && item.draggable) ?? scene.items.find((item) => item.draggable);
  if (!movable) return NextResponse.json({ error: 'No movable photo object is calibrated.' }, { status: 409 });

  const { data: roomAssets, error: listError } = await supabase
    .from('room_assets')
    .select('id,object_path,mime_type,byte_length,capture_context,created_at')
    .eq('room_id', roomId)
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(80);
  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });

  const rows = (roomAssets ?? []) as AssetRow[];
  const existingBackground = rows.find((asset) => method(asset) === 'scene_background_plate' && sourceId(asset) === sourceAssetId);
  const existingCutout = rows.find((asset) => method(asset) === 'scene_object_cutout' && sourceId(asset) === sourceAssetId && itemId(asset) === movable.id);
  if (existingBackground && existingCutout) {
    return NextResponse.json({
      prepared: true,
      reused: true,
      background: await signedAsset(supabase, existingBackground),
      object: await signedAsset(supabase, existingCutout),
    });
  }

  const { data: sourceBlob, error: downloadError } = await supabase.storage.from('room-assets').download(sourceRow.object_path);
  if (downloadError || !sourceBlob) return NextResponse.json({ error: 'Unable to read the private source photo.' }, { status: 500 });
  const sourceBytes = new Uint8Array(await sourceBlob.arrayBuffer());
  const dimensions = imageDimensions(sourceBytes, sourceRow.mime_type);
  const sourceBox = movable.sourceBbox ?? movable.bbox;
  const location = `${Math.round(sourceBox.x * 100)}% from the left, ${Math.round(sourceBox.y * 100)}% from the top, spanning about ${Math.round(sourceBox.w * 100)}% of the image width and ${Math.round(sourceBox.h * 100)}% of the image height`;

  const backgroundPrompt = [
    'Edit this exact room photograph to create a clean background plate for direct object manipulation.',
    `Remove only the ${movable.label.toLowerCase()} located ${location}.`,
    'Reconstruct the dresser top, mirror reflection, wall, lighting, shadows, and any surfaces hidden behind that object as naturally as possible.',
    'Do not remove, move, replace, restyle, or add any other object.',
    'Preserve the exact camera viewpoint, crop, perspective, architecture, color, exposure, texture, bedding, dresser, folded clothing, lamp, window treatment, floor items, and all other scene details.',
    'The result must look like the same untouched photograph except that this single object was never there.',
    'Do not add text, labels, borders, watermarks, UI, or design changes.',
  ].join(' ');

  const cutoutPrompt = [
    `Extract only the ${movable.label.toLowerCase()} from this room photograph as a reusable photorealistic object cutout.`,
    `The target is located ${location}.`,
    'Preserve the exact plant, pot, leaves, colors, lighting, texture, and viewing angle from the source photograph.',
    'Return the complete object on a transparent background with a tight crop and minimal transparent padding.',
    'Do not include the dresser, lamp, folded clothing, mirror, wall, shadows from unrelated objects, labels, borders, or any other room pixels.',
    'Do not redesign or beautify the object. This is an extraction, not a new plant.',
  ].join(' ');

  let backgroundImage;
  let cutoutImage;
  try {
    const [backgroundResult, cutoutResult] = await Promise.all([
      generateImage({
        model: process.env.NESTMETRIC_BACKGROUND_MODEL || 'openai/gpt-image-2',
        prompt: { text: backgroundPrompt, images: [sourceBytes] },
        aspectRatio: aspectRatioFor(dimensions),
        providerOptions: { openai: { quality: 'high' } },
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(95_000),
      }),
      generateImage({
        model: process.env.NESTMETRIC_CUTOUT_MODEL || 'openai/gpt-image-1.5',
        prompt: { text: cutoutPrompt, images: [sourceBytes] },
        size: cutoutSizeFor(dimensions),
        providerOptions: {
          openai: {
            quality: 'high',
            background: 'transparent',
            outputFormat: 'png',
            inputFidelity: 'high',
          },
        },
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(95_000),
      }),
    ]);
    backgroundImage = backgroundResult.image;
    cutoutImage = cutoutResult.image;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scene preparation failed.';
    return NextResponse.json({ error: message, code: 'scene_preparation_failed' }, { status: 502 });
  }

  const generatedAt = new Date().toISOString();
  const backgroundMediaType = backgroundImage.mediaType || 'image/png';
  const cutoutMediaType = cutoutImage.mediaType || 'image/png';
  const backgroundBytes = Buffer.from(backgroundImage.uint8Array);
  const cutoutBytes = Buffer.from(cutoutImage.uint8Array);
  const backgroundPath = `${ownerId}/${roomId}/scene/${sourceAssetId}/background-${crypto.randomUUID()}.${extensionFor(backgroundMediaType)}`;
  const cutoutPath = `${ownerId}/${roomId}/scene/${sourceAssetId}/${movable.id}-${crypto.randomUUID()}.${extensionFor(cutoutMediaType)}`;

  const [backgroundUpload, cutoutUpload] = await Promise.all([
    supabase.storage.from('room-assets').upload(backgroundPath, new Blob([backgroundBytes], { type: backgroundMediaType }), { contentType: backgroundMediaType, upsert: false }),
    supabase.storage.from('room-assets').upload(cutoutPath, new Blob([cutoutBytes], { type: cutoutMediaType }), { contentType: cutoutMediaType, upsert: false }),
  ]);
  if (backgroundUpload.error || cutoutUpload.error) {
    await supabase.storage.from('room-assets').remove([backgroundPath, cutoutPath]);
    return NextResponse.json({ error: backgroundUpload.error?.message || cutoutUpload.error?.message || 'Unable to store prepared scene assets.' }, { status: 500 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from('room_assets')
    .insert([
      {
        room_id: roomId,
        owner_id: ownerId,
        object_path: backgroundPath,
        mime_type: backgroundMediaType,
        byte_length: backgroundBytes.byteLength,
        capture_context: {
          captureMethod: 'scene_background_plate',
          sourceAssetId,
          sceneVersion: scene.version,
          model: process.env.NESTMETRIC_BACKGROUND_MODEL || 'openai/gpt-image-2',
          generatedAt,
        },
      },
      {
        room_id: roomId,
        owner_id: ownerId,
        object_path: cutoutPath,
        mime_type: cutoutMediaType,
        byte_length: cutoutBytes.byteLength,
        capture_context: {
          captureMethod: 'scene_object_cutout',
          sourceAssetId,
          itemId: movable.id,
          sceneVersion: scene.version,
          model: process.env.NESTMETRIC_CUTOUT_MODEL || 'openai/gpt-image-1.5',
          generatedAt,
        },
      },
    ])
    .select('id,object_path,mime_type,byte_length,capture_context,created_at');

  if (insertError || !inserted || inserted.length !== 2) {
    await supabase.storage.from('room-assets').remove([backgroundPath, cutoutPath]);
    return NextResponse.json({ error: insertError?.message || 'Unable to save prepared scene metadata.' }, { status: 500 });
  }

  const preparedRows = inserted as AssetRow[];
  const background = preparedRows.find((asset) => method(asset) === 'scene_background_plate');
  const object = preparedRows.find((asset) => method(asset) === 'scene_object_cutout');
  if (!background || !object) return NextResponse.json({ error: 'Prepared scene metadata is incomplete.' }, { status: 500 });

  return NextResponse.json({
    prepared: true,
    reused: false,
    background: await signedAsset(supabase, background),
    object: await signedAsset(supabase, object),
  });
}
