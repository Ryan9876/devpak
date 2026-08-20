import { generateImage } from 'ai';
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { createClient } from '@/lib/supabase/server';
import type { PhotoScene, PhotoSceneItem } from '@/lib/photo/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const BACKGROUND_RENDER_MODE = 'localized_mask_inpaint_v3';
const CUTOUT_RENDER_MODE = 'exact_source_mask_v3';

type AssetRow = {
  id: string;
  object_path: string;
  mime_type: string;
  byte_length: number;
  capture_context: Record<string, unknown> | null;
  created_at: string;
};

type PixelRect = { left: number; top: number; width: number; height: number };

type PreparedSource = {
  bytes: Buffer;
  width: number;
  height: number;
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

async function signedAsset(supabase: Awaited<ReturnType<typeof createClient>>, asset: AssetRow) {
  const { data } = await supabase.storage.from('room-assets').createSignedUrl(asset.object_path, 3600);
  return { id: asset.id, signedUrl: data?.signedUrl ?? null, mimeType: asset.mime_type };
}

async function normalizeSource(sourceBytes: Uint8Array): Promise<PreparedSource> {
  const normalized = await sharp(Buffer.from(sourceBytes))
    .rotate()
    .png()
    .toBuffer({ resolveWithObject: true });
  return { bytes: normalized.data, width: normalized.info.width, height: normalized.info.height };
}

function sourceRect(item: PhotoSceneItem, fullWidth: number, fullHeight: number): PixelRect {
  const box = item.sourceBbox ?? item.bbox;
  const left = Math.max(0, Math.round(box.x * fullWidth));
  const top = Math.max(0, Math.round(box.y * fullHeight));
  const width = Math.max(2, Math.min(fullWidth - left, Math.round(box.w * fullWidth)));
  const height = Math.max(2, Math.min(fullHeight - top, Math.round(box.h * fullHeight)));
  return { left, top, width, height };
}

function paddedRect(rect: PixelRect, fullWidth: number, fullHeight: number): PixelRect {
  const padX = Math.max(28, Math.round(rect.width * 0.38));
  const padY = Math.max(28, Math.round(rect.height * 0.34));
  const left = Math.max(0, rect.left - padX);
  const top = Math.max(0, rect.top - padY);
  const right = Math.min(fullWidth, rect.left + rect.width + padX);
  const bottom = Math.min(fullHeight, rect.top + rect.height + padY);
  return { left, top, width: right - left, height: bottom - top };
}

function maskSvg(
  item: PhotoSceneItem,
  source: PixelRect,
  target: PixelRect,
  options: { feather: number; stroke: number },
) {
  const masks = item.sourceMasks ?? [];
  if (!masks.length) throw new Error('Exact source-pixel segmentation mask is missing.');
  const polygons = masks.map((polygon) => {
    const points = polygon.map((point) => {
      const x = source.left + point.x * source.width - target.left;
      const y = source.top + point.y * source.height - target.top;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
    return `<polygon points=\"${points}\" fill=\"white\" stroke=\"white\" stroke-width=\"${options.stroke}\" stroke-linejoin=\"round\"/>`;
  }).join('');
  return Buffer.from(
    `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"${target.width}\" height=\"${target.height}\" viewBox=\"0 0 ${target.width} ${target.height}\">` +
    `<defs><filter id=\"edge\"><feGaussianBlur stdDeviation=\"${options.feather}\"/></filter></defs>` +
    `<g filter=\"url(#edge)\">${polygons}</g></svg>`,
  );
}

async function exactCutout(source: PreparedSource, item: PhotoSceneItem) {
  const rect = sourceRect(item, source.width, source.height);
  const crop = await sharp(source.bytes)
    .extract(rect)
    .ensureAlpha()
    .png()
    .toBuffer();
  const mask = maskSvg(item, rect, rect, { feather: 0.55, stroke: 1.2 });
  const bytes = await sharp(crop)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { bytes, rect };
}

async function localizedBackground(source: PreparedSource, item: PhotoSceneItem) {
  const objectRect = sourceRect(item, source.width, source.height);
  const patchRect = paddedRect(objectRect, source.width, source.height);
  const patch = await sharp(source.bytes)
    .extract(patchRect)
    .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
    .toBuffer();

  const prompt = [
    'This is a tight crop from an existing room photograph used only to reconstruct pixels hidden by one plant.',
    'Remove only the plant and reconstruct the dresser, mirror reflection, wall, light, and surface directly behind it.',
    'Do not move, add, remove, restyle, resize, or replace any other visible object in this crop.',
    'Preserve the exact camera angle, exposure, color, material texture, dresser edge, mirror frame, lamp, clothing, and neighboring details.',
    'Do not improve or redesign the room. This is local inpainting, not a room makeover.',
    'Do not add text, labels, borders, watermarks, or UI.',
  ].join(' ');

  const model = process.env.NESTMETRIC_BACKGROUND_MODEL || 'openai/gpt-image-2';
  let generatedBytes: Uint8Array;
  try {
    const result = await generateImage({
      model,
      prompt: { text: prompt, images: [new Uint8Array(patch)] },
      providerOptions: { openai: { quality: 'medium' } },
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(105_000),
    });
    generatedBytes = result.image.uint8Array;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Background preparation failed.';
    console.error('NESTMETRIC_BACKGROUND_PREPARATION_FAILED', {
      model,
      quality: 'medium',
      patchWidth: patchRect.width,
      patchHeight: patchRect.height,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      message,
    });
    throw new Error(message);
  }

  const inpaintMask = maskSvg(item, objectRect, patchRect, { feather: 1.4, stroke: 8 });
  const generatedPatch = await sharp(Buffer.from(generatedBytes))
    .resize(patchRect.width, patchRect.height, { fit: 'fill' })
    .ensureAlpha()
    .composite([{ input: inpaintMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const background = await sharp(source.bytes)
    .composite([{ input: generatedPatch, left: patchRect.left, top: patchRect.top, blend: 'over' }])
    .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
    .toBuffer();

  return { background, patchRect, objectRect };
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

  const { data: sourceRowData, error: sourceError } = await supabase
    .from('room_assets')
    .select('id,object_path,mime_type,byte_length,capture_context,created_at')
    .eq('id', sourceAssetId)
    .eq('room_id', roomId)
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .single();
  if (sourceError || !sourceRowData) return NextResponse.json({ error: 'Source room photo not found.' }, { status: 404 });

  const sourceRow = sourceRowData as AssetRow;
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
  const existingBackground = rows.find((asset) =>
    method(asset) === 'scene_background_plate'
      && sourceId(asset) === sourceAssetId
      && renderMode(asset) === BACKGROUND_RENDER_MODE);
  const existingExactCutout = rows.find((asset) =>
    method(asset) === 'scene_object_cutout'
      && sourceId(asset) === sourceAssetId
      && itemId(asset) === movable.id
      && renderMode(asset) === CUTOUT_RENDER_MODE);

  if (existingBackground && existingExactCutout) {
    return NextResponse.json({
      prepared: true,
      reused: true,
      renderMode: CUTOUT_RENDER_MODE,
      background: await signedAsset(supabase, existingBackground),
      object: await signedAsset(supabase, existingExactCutout),
    });
  }

  const { data: sourceBlob, error: downloadError } = await supabase.storage.from('room-assets').download(sourceRow.object_path);
  if (downloadError || !sourceBlob) return NextResponse.json({ error: 'Unable to read the private source photo.' }, { status: 500 });

  let preparedSource: PreparedSource;
  let cutout: Awaited<ReturnType<typeof exactCutout>>;
  try {
    const rawSource = new Uint8Array(await sourceBlob.arrayBuffer());
    preparedSource = await normalizeSource(rawSource);
    cutout = await exactCutout(preparedSource, movable);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Exact object extraction failed.' }, { status: 500 });
  }

  let backgroundAsset = existingBackground ?? null;
  if (!backgroundAsset) {
    let localized;
    try {
      localized = await localizedBackground(preparedSource, movable);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Background preparation failed.', code: 'background_preparation_failed' }, { status: 502 });
    }

    const objectPath = `${ownerId}/${roomId}/scene/${sourceAssetId}/background-local-v3-${crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await supabase.storage.from('room-assets').upload(
      objectPath,
      new Blob([localized.background], { type: 'image/jpeg' }),
      { contentType: 'image/jpeg', upsert: false },
    );
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { data: inserted, error: insertError } = await supabase.from('room_assets').insert({
      room_id: roomId,
      owner_id: ownerId,
      object_path: objectPath,
      mime_type: 'image/jpeg',
      byte_length: localized.background.byteLength,
      capture_context: {
        captureMethod: 'scene_background_plate',
        sourceAssetId,
        sceneVersion: scene.version,
        renderMode: BACKGROUND_RENDER_MODE,
        model: process.env.NESTMETRIC_BACKGROUND_MODEL || 'openai/gpt-image-2',
        patchRect: localized.patchRect,
        objectRect: localized.objectRect,
        sourceInvariant: 'outside_object_mask',
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
    const { error: uploadError } = await supabase.storage.from('room-assets').upload(
      cutoutPath,
      new Blob([cutout.bytes], { type: 'image/png' }),
      { contentType: 'image/png', upsert: false },
    );
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
        renderMode: CUTOUT_RENDER_MODE,
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
    renderMode: CUTOUT_RENDER_MODE,
    background: await signedAsset(supabase, backgroundAsset),
    object: await signedAsset(supabase, exactCutoutAsset),
  });
}
