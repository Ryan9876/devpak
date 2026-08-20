import { generateImage } from 'ai';
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { createClient } from '@/lib/supabase/server';
import type { PhotoScene, PhotoSceneItem } from '@/lib/photo/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
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

function renderMode(asset: AssetRow) {
  return String(asset.capture_context?.renderMode ?? '');
}

function extensionFor(mediaType: string) {
  if (mediaType === 'image/jpeg') return 'jpg';
  if (mediaType === 'image/webp') return 'webp';
  return 'png';
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

function aspectRatioFor(width?: number, height?: number): `${number}:${number}` | undefined {
  if (!width || !height) return undefined;
  const divisor = gcd(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}` as `${number}:${number}`;
}

async function signedAsset(supabase: Awaited<ReturnType<typeof createClient>>, asset: AssetRow) {
  const { data } = await supabase.storage.from('room-assets').createSignedUrl(asset.object_path, 3600);
  return { id: asset.id, signedUrl: data?.signedUrl ?? null, mimeType: asset.mime_type };
}

function sourceMaskSvg(item: PhotoSceneItem, width: number, height: number) {
  const masks = item.sourceMasks ?? [];
  if (!masks.length) throw new Error('Exact source-pixel segmentation mask is missing.');
  const polygons = masks.map((polygon) => {
    const points = polygon.map((point) => `${(point.x * width).toFixed(2)},${(point.y * height).toFixed(2)}`).join(' ');
    return `<polygon points="${points}" fill="white"/>`;
  }).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><filter id="edge"><feGaussianBlur stdDeviation="0.45"/></filter></defs><g filter="url(#edge)">${polygons}</g></svg>`);
}

async function exactCutout(sourceBytes: Uint8Array, item: PhotoSceneItem) {
  const sourceBox = item.sourceBbox ?? item.bbox;
  const image = sharp(Buffer.from(sourceBytes));
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error('Unable to read source-photo dimensions.');

  const left = Math.max(0, Math.round(sourceBox.x * metadata.width));
  const top = Math.max(0, Math.round(sourceBox.y * metadata.height));
  const width = Math.max(2, Math.min(metadata.width - left, Math.round(sourceBox.w * metadata.width)));
  const height = Math.max(2, Math.min(metadata.height - top, Math.round(sourceBox.h * metadata.height)));
  const crop = await sharp(Buffer.from(sourceBytes)).extract({ left, top, width, height }).ensureAlpha().png().toBuffer();
  const mask = sourceMaskSvg(item, width, height);
  const bytes = await sharp(crop)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { bytes, width: metadata.width, height: metadata.height };
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
  if (!movable.sourceMasks?.length) return NextResponse.json({ error: 'V3 source-pixel segmentation is not calibrated for this object yet.' }, { status: 409 });

  const { data: roomAssets, error: listError } = await supabase
    .from('room_assets')
    .select('id,object_path,mime_type,byte_length,capture_context,created_at')
    .eq('room_id', roomId)
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100);
  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });

  const rows = (roomAssets ?? []) as AssetRow[];
  const existingBackground = rows.find((asset) => method(asset) === 'scene_background_plate' && sourceId(asset) === sourceAssetId);
  const existingExactCutout = rows.find((asset) =>
    method(asset) === 'scene_object_cutout'
      && sourceId(asset) === sourceAssetId
      && itemId(asset) === movable.id
      && renderMode(asset) === 'exact_source_mask_v3');

  if (existingBackground && existingExactCutout) {
    return NextResponse.json({
      prepared: true,
      reused: true,
      renderMode: 'exact_source_mask_v3',
      background: await signedAsset(supabase, existingBackground),
      object: await signedAsset(supabase, existingExactCutout),
    });
  }

  const { data: sourceBlob, error: downloadError } = await supabase.storage.from('room-assets').download(sourceRow.object_path);
  if (downloadError || !sourceBlob) return NextResponse.json({ error: 'Unable to read the private source photo.' }, { status: 500 });
  const sourceBytes = new Uint8Array(await sourceBlob.arrayBuffer());

  let cutout;
  try {
    cutout = await exactCutout(sourceBytes, movable);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Exact object extraction failed.' }, { status: 500 });
  }

  let backgroundAsset = existingBackground ?? null;
  if (!backgroundAsset) {
    const sourceBox = movable.sourceBbox ?? movable.bbox;
    const location = `${Math.round(sourceBox.x * 100)}% from the left, ${Math.round(sourceBox.y * 100)}% from the top, spanning about ${Math.round(sourceBox.w * 100)}% of the image width and ${Math.round(sourceBox.h * 100)}% of the image height`;
    const backgroundPrompt = [
      'Edit this exact room photograph to create a clean background plate for direct object manipulation.',
      `Remove only the ${movable.label.toLowerCase()} located ${location}.`,
      'Reconstruct only the dresser top, mirror reflection, wall, lighting, shadows, and surfaces hidden behind that object.',
      'Do not remove, move, replace, restyle, or add any other object.',
      'Preserve the exact camera viewpoint, crop, perspective, architecture, color, exposure, texture, bedding, dresser, folded clothing, lamp, window treatment, floor items, and all other scene details.',
      'The result must look like the same untouched photograph except that this single object was never there.',
      'Do not add text, labels, borders, watermarks, UI, or design changes.',
    ].join(' ');

    let backgroundImage;
    try {
      const result = await generateImage({
        model: process.env.NESTMETRIC_BACKGROUND_MODEL || 'openai/gpt-image-2',
        prompt: { text: backgroundPrompt, images: [sourceBytes] },
        aspectRatio: aspectRatioFor(cutout.width, cutout.height),
        providerOptions: { openai: { quality: 'high' } },
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(95_000),
      });
      backgroundImage = result.image;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Background preparation failed.';
      return NextResponse.json({ error: message, code: 'background_preparation_failed' }, { status: 502 });
    }

    const mediaType = backgroundImage.mediaType || 'image/png';
    const bytes = Buffer.from(backgroundImage.uint8Array);
    const objectPath = `${ownerId}/${roomId}/scene/${sourceAssetId}/background-${crypto.randomUUID()}.${extensionFor(mediaType)}`;
    const { error: uploadError } = await supabase.storage.from('room-assets').upload(objectPath, new Blob([bytes], { type: mediaType }), { contentType: mediaType, upsert: false });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
    const { data: inserted, error: insertError } = await supabase.from('room_assets').insert({
      room_id: roomId,
      owner_id: ownerId,
      object_path: objectPath,
      mime_type: mediaType,
      byte_length: bytes.byteLength,
      capture_context: {
        captureMethod: 'scene_background_plate',
        sourceAssetId,
        sceneVersion: scene.version,
        model: process.env.NESTMETRIC_BACKGROUND_MODEL || 'openai/gpt-image-2',
        generatedAt: new Date().toISOString(),
      },
    }).select('id,object_path,mime_type,byte_length,capture_context,created_at').single();
    if (insertError || !inserted) {
      await supabase.storage.from('room-assets').remove([objectPath]);
      return NextResponse.json({ error: insertError?.message || 'Unable to save background metadata.' }, { status: 500 });
    }
    backgroundAsset = inserted as AssetRow;
  }

  let exactCutoutAsset = existingExactCutout ?? null;
  if (!exactCutoutAsset) {
    const cutoutPath = `${ownerId}/${roomId}/scene/${sourceAssetId}/${movable.id}-exact-v3-${crypto.randomUUID()}.png`;
    const { error: uploadError } = await supabase.storage.from('room-assets').upload(cutoutPath, new Blob([cutout.bytes], { type: 'image/png' }), { contentType: 'image/png', upsert: false });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
    const { data: inserted, error: insertError } = await supabase.from('room_assets').insert({
      room_id: roomId,
      owner_id: ownerId,
      object_path: cutoutPath,
      mime_type: 'image/png',
      byte_length: cutout.bytes.byteLength,
      capture_context: {
        captureMethod: 'scene_object_cutout',
        sourceAssetId,
        itemId: movable.id,
        sceneVersion: scene.version,
        renderMode: 'exact_source_mask_v3',
        segmentation: movable.segmentation ?? 'manual_polygon_v3',
        generatedAt: new Date().toISOString(),
      },
    }).select('id,object_path,mime_type,byte_length,capture_context,created_at').single();
    if (insertError || !inserted) {
      await supabase.storage.from('room-assets').remove([cutoutPath]);
      return NextResponse.json({ error: insertError?.message || 'Unable to save exact cutout metadata.' }, { status: 500 });
    }
    exactCutoutAsset = inserted as AssetRow;
  }

  return NextResponse.json({
    prepared: true,
    reused: Boolean(existingBackground && existingExactCutout),
    renderMode: 'exact_source_mask_v3',
    background: await signedAsset(supabase, backgroundAsset),
    object: await signedAsset(supabase, exactCutoutAsset),
  });
}
