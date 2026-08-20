import type { NormalizedBox } from './types';

export type NormalizedPhotoPoint = { x: number; y: number };

export function boxFromPointerDelta(
  original: NormalizedBox,
  start: NormalizedPhotoPoint,
  current: NormalizedPhotoPoint,
): NormalizedBox {
  return {
    ...original,
    x: original.x + (current.x - start.x),
    y: original.y + (current.y - start.y),
  };
}
