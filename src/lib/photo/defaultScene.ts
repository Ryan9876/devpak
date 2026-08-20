import type { PhotoScene } from './types';

export const bedroomDresserSceneV1: PhotoScene = {
  version: 2,
  coordinateSpace: 'normalized_image',
  calibration: 'manual_v3',
  surfaces: [
    {
      id: 'dresser-top',
      label: 'dresser',
      kind: 'dresser_top',
      zOrder: 3,
      settleInset: 0.012,
      acceptsKinds: ['plant', 'decor'],
      polygon: [
        { x: 0.055, y: 0.575 },
        { x: 0.735, y: 0.565 },
        { x: 0.725, y: 0.635 },
        { x: 0.060, y: 0.650 },
      ],
    },
    {
      id: 'bed',
      label: 'bed',
      kind: 'bed',
      zOrder: 2,
      settleInset: 0.018,
      acceptsKinds: ['plant', 'decor'],
      polygon: [
        { x: 0.000, y: 0.635 },
        { x: 0.330, y: 0.615 },
        { x: 0.790, y: 0.815 },
        { x: 0.800, y: 1.000 },
        { x: 0.000, y: 1.000 },
      ],
    },
    {
      id: 'floor',
      label: 'floor',
      kind: 'floor',
      zOrder: 1,
      settleInset: 0.025,
      acceptsKinds: ['plant', 'decor'],
      polygon: [
        { x: 0.690, y: 0.675 },
        { x: 1.000, y: 0.655 },
        { x: 1.000, y: 1.000 },
        { x: 0.720, y: 1.000 },
      ],
    },
  ],
  items: [
    {
      id: 'plant',
      label: 'Plant',
      kind: 'plant',
      sourceBbox: { x: 0.100, y: 0.455, w: 0.205, h: 0.150 },
      bbox: { x: 0.100, y: 0.455, w: 0.205, h: 0.150 },
      segmentation: 'manual_polygon_v3',
      sourceMasks: [
        [
          { x: 0.03, y: 0.48 }, { x: 0.13, y: 0.36 }, { x: 0.21, y: 0.31 },
          { x: 0.16, y: 0.22 }, { x: 0.31, y: 0.25 }, { x: 0.36, y: 0.13 },
          { x: 0.47, y: 0.20 }, { x: 0.52, y: 0.05 }, { x: 0.59, y: 0.20 },
          { x: 0.72, y: 0.13 }, { x: 0.69, y: 0.28 }, { x: 0.86, y: 0.24 },
          { x: 0.80, y: 0.38 }, { x: 0.97, y: 0.43 }, { x: 0.82, y: 0.52 },
          { x: 0.88, y: 0.62 }, { x: 0.68, y: 0.59 }, { x: 0.61, y: 0.70 },
          { x: 0.42, y: 0.67 }, { x: 0.34, y: 0.59 }, { x: 0.18, y: 0.62 },
          { x: 0.22, y: 0.53 }, { x: 0.07, y: 0.57 }
        ],
        [
          { x: 0.31, y: 0.55 }, { x: 0.43, y: 0.51 }, { x: 0.62, y: 0.52 },
          { x: 0.70, y: 0.60 }, { x: 0.68, y: 0.94 }, { x: 0.61, y: 0.99 },
          { x: 0.39, y: 0.99 }, { x: 0.33, y: 0.92 }
        ],
        [
          { x: 0.00, y: 0.43 }, { x: 0.12, y: 0.37 }, { x: 0.25, y: 0.40 },
          { x: 0.31, y: 0.48 }, { x: 0.20, y: 0.54 }, { x: 0.06, y: 0.53 }
        ],
        [
          { x: 0.66, y: 0.35 }, { x: 0.82, y: 0.31 }, { x: 1.00, y: 0.39 },
          { x: 0.96, y: 0.51 }, { x: 0.79, y: 0.50 }, { x: 0.68, y: 0.57 }
        ]
      ],
      supportSurfaceId: 'dresser-top',
      footprint: { width: 0.068, height: 0.026 },
      draggable: true,
      fixed: false,
    },
    {
      id: 'lamp',
      label: 'Lamp',
      kind: 'blocker',
      bbox: { x: 0.047, y: 0.505, w: 0.105, h: 0.105 },
      supportSurfaceId: 'dresser-top',
      footprint: { width: 0.065, height: 0.026 },
      draggable: false,
      fixed: true,
    },
    {
      id: 'clothes-left',
      label: 'Folded clothes',
      kind: 'blocker',
      bbox: { x: 0.285, y: 0.485, w: 0.178, h: 0.112 },
      supportSurfaceId: 'dresser-top',
      footprint: { width: 0.145, height: 0.030 },
      draggable: false,
      fixed: true,
    },
    {
      id: 'clothes-right',
      label: 'Folded clothes',
      kind: 'blocker',
      bbox: { x: 0.455, y: 0.475, w: 0.205, h: 0.126 },
      supportSurfaceId: 'dresser-top',
      footprint: { width: 0.175, height: 0.032 },
      draggable: false,
      fixed: true,
    },
    {
      id: 'shoe-boxes',
      label: 'Boxes',
      kind: 'blocker',
      bbox: { x: 0.825, y: 0.790, w: 0.090, h: 0.150 },
      supportSurfaceId: 'floor',
      footprint: { width: 0.085, height: 0.050 },
      draggable: false,
      fixed: true,
    },
    {
      id: 'floor-bag',
      label: 'Bag',
      kind: 'blocker',
      bbox: { x: 0.900, y: 0.885, w: 0.100, h: 0.115 },
      supportSurfaceId: 'floor',
      footprint: { width: 0.095, height: 0.060 },
      draggable: false,
      fixed: true,
    },
  ],
  occluders: [
    {
      id: 'bed-foreground',
      label: 'bed foreground',
      polygon: [
        { x: 0.000, y: 0.635 },
        { x: 0.330, y: 0.615 },
        { x: 0.790, y: 0.815 },
        { x: 0.800, y: 1.000 },
        { x: 0.000, y: 1.000 },
      ],
      hidesSurfaceIds: ['floor'],
    },
  ],
};
