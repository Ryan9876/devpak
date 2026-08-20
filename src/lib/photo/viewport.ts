export type PhotoViewport = {
  scale: number;
  tx: number;
  ty: number;
};

export type PhotoPoint = { x: number; y: number };

export const MIN_PHOTO_SCALE = 1;
export const MAX_PHOTO_SCALE = 5;
export const DOUBLE_TAP_PHOTO_SCALE = 2.5;

export function clampPhotoScale(scale: number) {
  return Math.max(MIN_PHOTO_SCALE, Math.min(MAX_PHOTO_SCALE, scale));
}

export function clampPhotoViewport(
  viewport: PhotoViewport,
  width: number,
  height: number,
): PhotoViewport {
  const scale = clampPhotoScale(viewport.scale);
  if (!width || !height || scale <= 1) return { scale: 1, tx: 0, ty: 0 };
  const minTx = width - width * scale;
  const minTy = height - height * scale;
  return {
    scale,
    tx: Math.max(minTx, Math.min(0, viewport.tx)),
    ty: Math.max(minTy, Math.min(0, viewport.ty)),
  };
}

export function screenToPhotoNormalized(
  viewport: PhotoViewport,
  width: number,
  height: number,
  localX: number,
  localY: number,
): PhotoPoint {
  if (!width || !height) return { x: 0, y: 0 };
  const photoX = (localX - viewport.tx) / viewport.scale;
  const photoY = (localY - viewport.ty) / viewport.scale;
  return {
    x: Math.max(0, Math.min(1, photoX / width)),
    y: Math.max(0, Math.min(1, photoY / height)),
  };
}

export function zoomPhotoViewportAround(
  viewport: PhotoViewport,
  nextScale: number,
  width: number,
  height: number,
  anchorX: number,
  anchorY: number,
): PhotoViewport {
  const scale = clampPhotoScale(nextScale);
  if (scale <= 1) return { scale: 1, tx: 0, ty: 0 };
  const imageX = (anchorX - viewport.tx) / viewport.scale;
  const imageY = (anchorY - viewport.ty) / viewport.scale;
  return clampPhotoViewport({
    scale,
    tx: anchorX - imageX * scale,
    ty: anchorY - imageY * scale,
  }, width, height);
}

export function panPhotoViewport(
  viewport: PhotoViewport,
  dx: number,
  dy: number,
  width: number,
  height: number,
): PhotoViewport {
  return clampPhotoViewport({ ...viewport, tx: viewport.tx + dx, ty: viewport.ty + dy }, width, height);
}
