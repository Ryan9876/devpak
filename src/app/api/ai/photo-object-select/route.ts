import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { createClient } from '@/lib/supabase/server';
import type { NormalizedBox, NormalizedPoint, PhotoScene, PhotoSceneItem, PhotoSurface } from '@/lib/photo/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

type AssetRow = {
  id: string;
  object_path: string;
  capture_context: Record<string, unknown> | null;
};

type SelectionPayload = {
  label?: unknown;
  bbox?: unknown;
  polygons?: unknown;
  confidence?: unknown;
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizePoint(value: unknown): NormalizedPoint | null {
  if (!value || typeof value !== 'object') return null;
  const point = value as Record<string, unknown>;
  const x = finiteNumber(point.x);
  const y = finiteNumber(point.y);
  if (x == null || y == null) return null;
  return { x: clamp01(x), y: clamp01(y) };
}

function normalizeBox(value: unknown): NormalizedBox | null {
  if (!value || typeof value !== 'object') return null;
  const box = value as Record<string, unknown>;
  const x = finiteNumber(box.x);
  const y = finiteNumber(box.y);
  const w = finiteNumber(box.w);
  const h = finiteNumber(box.h);
  if (x == null || y == null || w == null || h == null || w <= 0 || h <= 0) return null;
  const left = clamp01(x);
  const top = clamp01(y);
  const width = Math.min(1 - left, Math.max(0.012, w));
  const height = Math.min(1 - top, Math.max(0.012, h));
  if (width <= 0 || height <= 0) return null;
  return { x: left, y: top, w: width, h: height };
}

function normalizePolygons(value: unknown): NormalizedPoint[][] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(Array.isArray)
    .map((polygon) => polygon
      .map(normalizePoint)
      .filter((point): point is NormalizedPoint => Boolean(point))
      .slice(0, 64))
    .filter((polygon) => polygon.length >= 3)
    .slice(0, 6);
}

function stripJsonFence(value: string) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function responseText(payload: any) {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  const pieces = Array.isArray(payload?.output) ? payload.output : [];
  for (const item of pieces) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if ((part?.type === 'output_text' || part?.type === 'text') && typeof part?.text === 'string') return part.text;
    }
  }
  return '';
}

function pointInPolygon(point: NormalizedPoint, polygon: NormalizedPoint[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects = ((a.y > point.y) !== (b.y > point.y))
      && point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || Number.EPSILON) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function supportFor(box: NormalizedBox, surfaces: PhotoSurface[]) {
  const base = { x: box.x + box.w / 2, y: Math.min(1, box.y + box.h + 0.008) };
  return [...surfaces]
    .sort((a, b) => b.zOrder - a.zOrder)
    .find((surface) => pointInPolygon(base, surface.polygon)) ?? null;
}

function overlapRatio(a: NormalizedBox, b: NormalizedBox) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  if (right <= left || bottom <= top) return 0;
  const intersection = (right - left) * (bottom - top);
  return intersection / Math.max(0.000001, Math.min(a.w * a.h, b.w * b.h));
}

function boxContainsPoint(box: NormalizedBox, point: NormalizedPoint, tolerance = 0.035) {
  return point.x >= box.x - tolerance
    && point.x <= box.x + box.w + tolerance
    && point.y >= box.y - tolerance
    && point.y <= box.y + box.h + tolerance;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const ownerId = claimsData?.claims?.sub;
  if (claimsError || !ownerId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const roomId = String(body.roomId || '');
  const sourceAssetId = String(body.sourceAssetId || '');
  const point = normalizePoint(body.point);
  if (!roomId || !sourceAssetId || !point) {
    return NextResponse.json({ error: 'Room, source photo, and a valid photo point are required.' }, { status: 400 });
  }

  const { data: sourceData, error: sourceError } = await supabase
    .from('room_assets')
    .select('id,object_path,capture_context')
    .eq('id', sourceAssetId)
    .eq('room_id', roomId)
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .single();
  if (sourceError || !sourceData) return NextResponse.json({ error: 'Source room photo not found.' }, { status: 404 });

  const source = sourceData as AssetRow;
  const scene = source.capture_context?.scene as PhotoScene | undefined;
  if (!scene?.surfaces?.length) {
    return NextResponse.json({ error: 'This room photo needs scene calibration before object selection.' }, { status: 409 });
  }

  const { data: blob, error: downloadError } = await supabase.storage.from('room-assets').download(source.object_path);
  if (downloadError || !blob) return NextResponse.json({ error: 'Unable to read the private room photo.' }, { status: 500 });

  const sourceBytes = Buffer.from(await blob.arrayBuffer());
  const preview = await sharp(sourceBytes)
    .rotate()
    .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
    .toBuffer({ resolveWithObject: true });

  const markerX = Math.round(point.x * preview.info.width);
  const markerY = Math.round(point.y * preview.info.height);
  const radius = Math.max(12, Math.round(Math.min(preview.info.width, preview.info.height) * 0.014));
  const marker = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${preview.info.width}" height="${preview.info.height}">`
      + `<circle cx="${markerX}" cy="${markerY}" r="${radius}" fill="none" stroke="#ff2d2d" stroke-width="6"/>`
      + `<line x1="${markerX - radius * 1.6}" y1="${markerY}" x2="${markerX + radius * 1.6}" y2="${markerY}" stroke="#ff2d2d" stroke-width="4"/>`
      + `<line x1="${markerX}" y1="${markerY - radius * 1.6}" x2="${markerX}" y2="${markerY + radius * 1.6}" stroke="#ff2d2d" stroke-width="4"/>`
      + `</svg>`,
  );
  const marked = await sharp(preview.data).composite([{ input: marker, blend: 'over' }]).jpeg({ quality: 90 }).toBuffer();

  const model = process.env.NESTMETRIC_OBJECT_SELECTOR_MODEL || 'openai/gpt-5.6-sol';
  const prompt = [
    'You are selecting one movable physical object from a real room photograph.',
    'The red crosshair marks the exact point the user tapped. Identify ONLY the single distinct physical object directly under that crosshair.',
    'Do not choose a wall, floor, ceiling, mirror reflection, the whole dresser, the whole bed, or a broad pile/region unless the crosshair clearly targets that single item.',
    'Return JSON only with this exact shape:',
    '{"label":"short object name","bbox":{"x":0,"y":0,"w":0,"h":0},"polygons":[[{"x":0,"y":0}]],"confidence":0}',
    'bbox coordinates are normalized 0..1 relative to the FULL marked image.',
    'polygons describe the visible silhouette of ONLY the selected object and are normalized 0..1 RELATIVE TO bbox, not the full image.',
    'Use 12-48 polygon points per visible connected silhouette where useful; up to 6 polygons. Exclude nearby objects and background.',
    'The bbox must tightly contain the selected object and the tapped crosshair must fall inside or immediately adjacent to it.',
  ].join(' ');

  const gatewayToken = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (!gatewayToken) return NextResponse.json({ error: 'Object selection AI is not configured.' }, { status: 503 });

  let selection: SelectionPayload;
  try {
    const aiResponse = await fetch('https://ai-gateway.vercel.sh/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${gatewayToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [{
          type: 'message',
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: `data:image/jpeg;base64,${marked.toString('base64')}`, detail: 'high' },
          ],
        }],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const payload = await aiResponse.json().catch(() => ({}));
    if (!aiResponse.ok) throw new Error(`Object selection model returned ${aiResponse.status}.`);
    const text = stripJsonFence(responseText(payload));
    selection = JSON.parse(text) as SelectionPayload;
  } catch (error) {
    console.error('NESTMETRIC_OBJECT_SELECTION_FAILED', {
      model,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : 'Unknown object-selection failure.',
    });
    return NextResponse.json({ error: 'Unable to identify that object. Tap the center of the item and try again.' }, { status: 502 });
  }

  const bbox = normalizeBox(selection.bbox);
  const polygons = normalizePolygons(selection.polygons);
  const confidence = Math.max(0, Math.min(1, Number(selection.confidence) || 0));
  const label = String(selection.label || 'Selected object').trim().slice(0, 80) || 'Selected object';

  if (!bbox || !boxContainsPoint(bbox, point) || polygons.length === 0 || confidence < 0.45) {
    return NextResponse.json({ error: 'The object boundary was not clear enough. Tap near the center of one distinct item and try again.' }, { status: 422 });
  }
  if (bbox.w * bbox.h > 0.3 || bbox.w > 0.76 || bbox.h > 0.76) {
    return NextResponse.json({ error: 'Choose a smaller movable item rather than a large room surface or furniture region.' }, { status: 422 });
  }

  const support = supportFor(bbox, scene.surfaces);
  const kind: PhotoSceneItem['kind'] = /plant|flower|foliage|succulent/i.test(label) ? 'plant' : 'decor';
  const newItem: PhotoSceneItem = {
    id: `picked-${crypto.randomUUID()}`,
    label,
    kind,
    bbox: { ...bbox },
    sourceBbox: { ...bbox },
    sourceMasks: polygons,
    segmentation: 'vision_mask',
    supportSurfaceId: support?.id ?? null,
    footprint: {
      width: Math.min(0.18, Math.max(0.025, bbox.w * 0.42)),
      height: Math.min(0.06, Math.max(0.012, bbox.h * 0.12)),
    },
    draggable: true,
    fixed: false,
  };

  const retained = scene.items.filter((item) => {
    if (item.draggable && !item.fixed) return false;
    if (item.fixed && overlapRatio(item.bbox, bbox) > 0.34) return false;
    return true;
  });
  const nextScene: PhotoScene = {
    ...scene,
    version: 2,
    calibration: 'vision_assisted',
    items: [...retained, newItem],
  };

  return NextResponse.json({
    selected: true,
    model,
    confidence,
    item: newItem,
    scene: nextScene,
  });
}
