import type {
  DropResolution,
  NormalizedBox,
  NormalizedPoint,
  PhotoScene,
  PhotoSceneItem,
  PhotoSurface,
  PlacementPreview,
} from './types';

const EPSILON = 0.000001;

export function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function pointInPolygon(point: NormalizedPoint, polygon: NormalizedPoint[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || EPSILON) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function verticalSpanAtX(surface: PhotoSurface, x: number) {
  const intersections: number[] = [];
  const polygon = surface.polygon;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const minX = Math.min(a.x, b.x) - EPSILON;
    const maxX = Math.max(a.x, b.x) + EPSILON;
    if (x < minX || x > maxX) continue;
    if (Math.abs(a.x - b.x) < EPSILON) {
      intersections.push(a.y, b.y);
      continue;
    }
    const t = (x - a.x) / (b.x - a.x);
    if (t >= -EPSILON && t <= 1 + EPSILON) intersections.push(a.y + (b.y - a.y) * t);
  }
  if (intersections.length < 2) return null;
  intersections.sort((a, b) => a - b);
  return { minY: intersections[0], maxY: intersections[intersections.length - 1] };
}

export function anchorForBox(box: NormalizedBox): NormalizedPoint {
  return { x: box.x + box.w / 2, y: box.y + box.h };
}

function footprintScale(item: PhotoSceneItem) {
  const source = item.sourceBbox ?? item.bbox;
  return source.w > EPSILON ? item.bbox.w / source.w : 1;
}

export function footprintForItem(item: PhotoSceneItem) {
  const anchor = anchorForBox(item.bbox);
  const scale = footprintScale(item);
  const width = item.footprint.width * scale;
  const height = item.footprint.height * scale;
  return {
    x: anchor.x - width / 2,
    y: anchor.y - height,
    w: width,
    h: height,
  };
}

export function boxesIntersect(a: NormalizedBox, b: NormalizedBox) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function accepts(surface: PhotoSurface, item: PhotoSceneItem) {
  return !surface.acceptsKinds?.length || surface.acceptsKinds.includes(item.kind);
}

export function surfaceContainingAnchor(scene: PhotoScene, item: PhotoSceneItem, box = item.bbox) {
  const anchor = anchorForBox(box);
  return [...scene.surfaces]
    .filter((surface) => accepts(surface, item) && pointInPolygon(anchor, surface.polygon))
    .sort((a, b) => b.zOrder - a.zOrder)[0] ?? null;
}

export function collidingItem(scene: PhotoScene, item: PhotoSceneItem, surfaceId: string, box = item.bbox) {
  const candidate = footprintForItem({ ...item, bbox: box });
  return scene.items.find((other) => {
    if (other.id === item.id || other.supportSurfaceId !== surfaceId) return false;
    return boxesIntersect(candidate, footprintForItem(other));
  }) ?? null;
}

function landingCandidate(scene: PhotoScene, item: PhotoSceneItem, box = item.bbox) {
  const anchor = anchorForBox(box);
  const candidates = scene.surfaces
    .filter((surface) => accepts(surface, item))
    .map((surface) => {
      const span = verticalSpanAtX(surface, anchor.x);
      if (!span || span.maxY < anchor.y - EPSILON) return null;
      const inset = surface.settleInset ?? 0.012;
      const landingY = Math.max(anchor.y, Math.min(span.maxY - inset, span.minY + inset));
      if (landingY < anchor.y - EPSILON) return null;
      return { surface, landingY };
    })
    .filter((candidate): candidate is { surface: PhotoSurface; landingY: number } => Boolean(candidate))
    .sort((a, b) => a.landingY - b.landingY || b.surface.zOrder - a.surface.zOrder);
  return candidates[0] ?? null;
}

function scaleForLanding(item: PhotoSceneItem, landingY: number) {
  const source = item.sourceBbox ?? item.bbox;
  const sourceAnchorY = source.y + source.h;
  return Math.max(0.82, Math.min(1.28, 1 + (landingY - sourceAnchorY) * 0.72));
}

function boxAtLanding(item: PhotoSceneItem, x: number, landingY: number) {
  const source = item.sourceBbox ?? item.bbox;
  const scale = scaleForLanding(item, landingY);
  const w = source.w * scale;
  const h = source.h * scale;
  const centerX = Math.max(w / 2, Math.min(1 - w / 2, x));
  return {
    x: centerX - w / 2,
    y: Math.max(0, Math.min(1 - h, landingY - h)),
    w,
    h,
  };
}

function nearestValidOnSurface(scene: PhotoScene, item: PhotoSceneItem, surface: PhotoSurface, desiredBox: NormalizedBox) {
  const desiredAnchor = anchorForBox(desiredBox);
  const span = verticalSpanAtX(surface, desiredAnchor.x);
  if (!span) return null;
  const inset = surface.settleInset ?? 0.012;
  const baselineY = Math.max(span.minY + inset, Math.min(span.maxY - inset, desiredAnchor.y));
  const tryAt = (x: number) => {
    const xSpan = verticalSpanAtX(surface, x);
    if (!xSpan) return null;
    const landingY = Math.max(xSpan.minY + inset, Math.min(xSpan.maxY - inset, baselineY));
    const box = boxAtLanding(item, x, landingY);
    if (!pointInPolygon(anchorForBox(box), surface.polygon)) return null;
    if (collidingItem(scene, item, surface.id, box)) return null;
    return box;
  };

  const direct = tryAt(desiredAnchor.x);
  if (direct) return direct;
  for (let step = 1; step <= 22; step++) {
    const delta = step * 0.012;
    const left = tryAt(clamp01(desiredAnchor.x - delta));
    if (left) return left;
    const right = tryAt(clamp01(desiredAnchor.x + delta));
    if (right) return right;
  }
  return null;
}

export function evaluatePlacement(scene: PhotoScene, item: PhotoSceneItem, desiredBox: NormalizedBox): PlacementPreview {
  const directSurface = surfaceContainingAnchor(scene, item, desiredBox);
  if (directSurface) {
    const blocker = collidingItem(scene, item, directSurface.id, desiredBox);
    if (blocker) {
      return {
        state: 'blocked',
        surfaceId: directSurface.id,
        surfaceLabel: directSurface.label,
        blockerLabel: blocker.label,
        landingY: anchorForBox(desiredBox).y,
        message: `Blocked by ${blocker.label}.`,
      };
    }
    return {
      state: 'supported',
      surfaceId: directSurface.id,
      surfaceLabel: directSurface.label,
      blockerLabel: null,
      landingY: anchorForBox(desiredBox).y,
      message: `Supported by ${directSurface.label}.`,
    };
  }

  const landing = landingCandidate(scene, item, desiredBox);
  if (!landing) {
    return {
      state: 'invalid',
      surfaceId: null,
      surfaceLabel: null,
      blockerLabel: null,
      landingY: null,
      message: 'No support surface below this position.',
    };
  }
  return {
    state: 'falling',
    surfaceId: landing.surface.id,
    surfaceLabel: landing.surface.label,
    blockerLabel: null,
    landingY: landing.landingY,
    message: `Unsupported · release to fall onto ${landing.surface.label}.`,
  };
}

export function resolveDrop(scene: PhotoScene, item: PhotoSceneItem, desiredBox: NormalizedBox): DropResolution {
  const directSurface = surfaceContainingAnchor(scene, item, desiredBox);
  if (directSurface) {
    const blocker = collidingItem(scene, item, directSurface.id, desiredBox);
    if (!blocker) {
      return { kind: 'placed', surfaceId: directSurface.id, bbox: desiredBox, message: `Placed on ${directSurface.label}.` };
    }
    const snapped = nearestValidOnSurface(scene, item, directSurface, desiredBox);
    if (snapped) {
      return {
        kind: 'snapped',
        surfaceId: directSurface.id,
        bbox: snapped,
        message: `${blocker.label} was in the way · moved to the nearest clear spot on ${directSurface.label}.`,
      };
    }
    return { kind: 'rejected', surfaceId: item.supportSurfaceId, bbox: item.bbox, message: `${blocker.label} blocks that placement.` };
  }

  const landing = landingCandidate(scene, item, desiredBox);
  if (!landing) return { kind: 'rejected', surfaceId: item.supportSurfaceId, bbox: item.bbox, message: 'No support surface below this position.' };

  const landingBox = boxAtLanding(item, anchorForBox(desiredBox).x, landing.landingY);
  const clear = nearestValidOnSurface(scene, item, landing.surface, landingBox);
  if (!clear) {
    return { kind: 'rejected', surfaceId: item.supportSurfaceId, bbox: item.bbox, message: `No clear landing space on ${landing.surface.label}.` };
  }
  return {
    kind: 'dropped',
    surfaceId: landing.surface.id,
    bbox: clear,
    message: `Gravity moved ${item.label} onto ${landing.surface.label}.`,
  };
}
