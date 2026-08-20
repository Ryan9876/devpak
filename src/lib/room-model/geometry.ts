import type { Opening, Point2D, RoomBoundary, RoomObject } from './types';

type Rect = { left: number; top: number; right: number; bottom: number };

function rect(o: RoomObject): Rect {
  const width = o.size.widthUm;
  const depth = o.size.depthUm;
  const angle = ((o.rotationDeg % 360) + 360) % 360 * Math.PI / 180;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  const rotatedWidth = width * cos + depth * sin;
  const rotatedDepth = width * sin + depth * cos;
  const centerX = o.position.xUm + width / 2;
  const centerY = o.position.yUm + depth / 2;
  return {
    left: centerX - rotatedWidth / 2,
    top: centerY - rotatedDepth / 2,
    right: centerX + rotatedWidth / 2,
    bottom: centerY + rotatedDepth / 2,
  };
}

export const overlaps = (a: RoomObject, b: RoomObject) => {
  const A = rect(a), B = rect(b);
  return A.left < B.right && A.right > B.left && A.top < B.bottom && A.bottom > B.top;
};

export const insideRoom = (boundary: RoomBoundary, o: RoomObject) => {
  const r = rect(o);
  return r.left >= 0 && r.top >= 0 && r.right <= boundary.widthUm && r.bottom <= boundary.depthUm;
};

function openingClearanceConflict(boundary: RoomBoundary, opening: Opening, o: RoomObject) {
  const r = rect(o), depth = Math.max(700_000, o.clearanceUm);
  if (opening.wall === 'south') return r.bottom > boundary.depthUm - depth && r.right > opening.offsetUm && r.left < opening.offsetUm + opening.widthUm;
  if (opening.wall === 'north') return r.top < depth && r.right > opening.offsetUm && r.left < opening.offsetUm + opening.widthUm;
  if (opening.wall === 'west') return r.left < depth && r.bottom > opening.offsetUm && r.top < opening.offsetUm + opening.widthUm;
  return r.right > boundary.widthUm - depth && r.bottom > opening.offsetUm && r.top < opening.offsetUm + opening.widthUm;
}

export function validatePlacement(room: { boundary: RoomBoundary; objects: RoomObject[]; openings: Opening[] }, candidate: RoomObject) {
  const conflicts: string[] = [];
  if (!insideRoom(room.boundary, candidate)) conflicts.push(`${candidate.label} extends outside the room boundary.`);
  for (const existing of room.objects) {
    if (existing.id === candidate.id) continue;
    if ((existing.fixed || candidate.fixed) && overlaps(existing, candidate)) conflicts.push(`${candidate.label} overlaps ${existing.label}.`);
  }
  for (const opening of room.openings) {
    if (openingClearanceConflict(room.boundary, opening, candidate)) conflicts.push(`${candidate.label} blocks a ${opening.kind} clearance zone.`);
  }
  return conflicts;
}

export function snapPoint(point: Point2D, gridUm = 50_000): Point2D {
  return { xUm: Math.round(point.xUm / gridUm) * gridUm, yUm: Math.round(point.yUm / gridUm) * gridUm };
}
