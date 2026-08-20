export type NormalizedPoint = { x: number; y: number };
export type NormalizedBox = { x: number; y: number; w: number; h: number };

export type PhotoSurfaceKind = 'dresser_top' | 'bed' | 'floor' | 'shelf' | 'table' | 'other';
export type PhotoSceneItemKind = 'plant' | 'blocker' | 'decor';

export type PhotoSurface = {
  id: string;
  label: string;
  kind: PhotoSurfaceKind;
  polygon: NormalizedPoint[];
  zOrder: number;
  settleInset?: number;
  acceptsKinds?: PhotoSceneItemKind[];
};

export type PhotoSceneItem = {
  id: string;
  label: string;
  kind: PhotoSceneItemKind;
  bbox: NormalizedBox;
  sourceBbox?: NormalizedBox;
  supportSurfaceId: string | null;
  footprint: { width: number; height: number };
  draggable: boolean;
  fixed: boolean;
};

export type PhotoScene = {
  version: 1;
  coordinateSpace: 'normalized_image';
  calibration: 'manual_v1' | 'vision_assisted';
  surfaces: PhotoSurface[];
  items: PhotoSceneItem[];
};

export type PlacementState = 'supported' | 'blocked' | 'falling' | 'invalid';

export type PlacementPreview = {
  state: PlacementState;
  surfaceId: string | null;
  surfaceLabel: string | null;
  blockerLabel: string | null;
  landingY: number | null;
  message: string;
};

export type DropResolution = {
  kind: 'placed' | 'snapped' | 'dropped' | 'rejected';
  surfaceId: string | null;
  bbox: NormalizedBox;
  message: string;
};
