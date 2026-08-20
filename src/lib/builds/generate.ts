import { validatePlacement } from '../room-model/geometry';
import { buildVerificationGate, measurementIsBuildSafe } from '../room-model/verification';
import type { RoomModel, RoomObject } from '../room-model/types';

export type BuildKind = 'shelving' | 'storage' | 'desk' | 'cabinet';
export type BuildMaterialPreference = 'plywood' | 'solid-wood' | 'melamine';

export type BuildRequest = {
  kind: BuildKind;
  title: string;
  widthUm: number;
  heightUm: number;
  depthUm: number;
  material: BuildMaterialPreference;
};

export type BuildComponent = {
  label: string;
  quantity: number;
  widthUm: number;
  heightUm: number;
  depthUm: number;
};

export type BuildMaterial = {
  item: string;
  specification: string;
  quantity: number;
  unit: string;
  wastePercent: number;
  costLowUsd: number | null;
  costHighUsd: number | null;
};

export type BuildPlanDraft = {
  status: 'ready' | 'conflicted';
  kind: BuildKind;
  title: string;
  overall: { widthUm: number; heightUm: number; depthUm: number };
  placement: { wall: 'north'; xUm: number; yUm: number } | null;
  clearances: { frontUm: number; sideUm: number };
  components: BuildComponent[];
  materials: BuildMaterial[];
  conflicts: string[];
  assumptions: string[];
  verification: Array<{ label: string; valueUm: number; toleranceUm: number; source: string; verification: string }>;
  costEstimate: { currency: 'USD'; low: number; high: number; nonbinding: true };
  effortEstimate: { lowHours: number; highHours: number; skill: 'intermediate'; nonbinding: true };
};

export class BuildEvidenceError extends Error {
  constructor(public readonly missing: string[], public readonly unverified: string[]) {
    super('Verified wall width and wall depth are required before generating a build plan.');
  }
}

const clampInt = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(n)));

function componentsFor(request: BuildRequest): BuildComponent[] {
  const board = 18_000;
  const { widthUm: w, heightUm: h, depthUm: d } = request;
  if (request.kind === 'desk') return [
    { label: 'Desktop', quantity: 1, widthUm: w, heightUm: board, depthUm: d },
    { label: 'Leg', quantity: 4, widthUm: 45_000, heightUm: Math.max(1, h - board), depthUm: 45_000 },
    { label: 'Rear stretcher', quantity: 1, widthUm: Math.max(1, w - 90_000), heightUm: 90_000, depthUm: board },
  ];

  const shelfCount = request.kind === 'shelving' ? clampInt(h / 400_000, 2, 6) : clampInt(h / 500_000, 1, 4);
  const parts: BuildComponent[] = [
    { label: 'Side panel', quantity: 2, widthUm: d, heightUm: h, depthUm: board },
    { label: 'Top / bottom panel', quantity: 2, widthUm: Math.max(1, w - board * 2), heightUm: d, depthUm: board },
    { label: 'Shelf', quantity: shelfCount, widthUm: Math.max(1, w - board * 2), heightUm: d, depthUm: board },
  ];
  if (request.kind === 'cabinet' || request.kind === 'storage') {
    parts.push({ label: 'Back panel', quantity: 1, widthUm: Math.max(1, w - board * 2), heightUm: Math.max(1, h - board * 2), depthUm: 6_000 });
  }
  if (request.kind === 'cabinet') {
    parts.push({ label: 'Door', quantity: 2, widthUm: Math.max(1, Math.floor((w - 6_000) / 2)), heightUm: Math.max(1, h - 12_000), depthUm: board });
  }
  return parts;
}

function materialPlan(request: BuildRequest, components: BuildComponent[]): BuildMaterial[] {
  const sheetAreaUm2 = 2_976_800_000_000;
  const panelAreaUm2 = components.reduce((sum, part) => sum + part.quantity * part.widthUm * part.heightUm, 0);
  const sheets = Math.max(1, Math.ceil(panelAreaUm2 / sheetAreaUm2 * 1.1));
  const panelName = request.material === 'solid-wood' ? 'Furniture-grade wood panels' : request.material === 'melamine' ? 'Melamine panels' : '18 mm plywood';
  const perSheet = request.material === 'solid-wood' ? [85, 160] : request.material === 'melamine' ? [45, 85] : [55, 110];
  return [
    { item: panelName, specification: '1220 × 2440 mm equivalent sheet stock; final cut optimization required', quantity: sheets, unit: 'sheet', wastePercent: 10, costLowUsd: sheets * perSheet[0], costHighUsd: sheets * perSheet[1] },
    { item: 'Fasteners / joinery hardware', specification: 'Select for material and intended loading', quantity: 1, unit: 'allowance', wastePercent: 0, costLowUsd: 20, costHighUsd: 60 },
    { item: 'Finish / edge treatment', specification: 'Optional; confirm selected material and finish', quantity: 1, unit: 'allowance', wastePercent: 10, costLowUsd: 15, costHighUsd: 60 },
  ];
}

function findPlacement(room: RoomModel, request: BuildRequest) {
  const candidateBase: RoomObject = {
    id: `build-preview-${room.id}`,
    label: request.title || `${request.kind} build`,
    kind: 'build',
    position: { xUm: 0, yUm: 0 },
    size: { widthUm: request.widthUm, depthUm: request.depthUm },
    rotationDeg: 0,
    fixed: false,
    clearanceUm: 800_000,
    source: 'build',
    confidence: 1,
    notes: null,
  };
  const step = 100_000;
  for (let xUm = step; xUm + request.widthUm <= room.boundary.widthUm; xUm += step) {
    const candidate = { ...candidateBase, position: { xUm, yUm: step } };
    if (validatePlacement(room, candidate).length === 0) return { placement: { wall: 'north' as const, xUm, yUm: step }, conflicts: [] as string[] };
  }
  const fallback = { ...candidateBase, position: { xUm: step, yUm: step } };
  return { placement: null, conflicts: validatePlacement(room, fallback).length ? validatePlacement(room, fallback) : ['No conflict-free north-wall placement fits the requested build dimensions.'] };
}

export function generateBuildPlan(room: RoomModel, request: BuildRequest): BuildPlanDraft {
  const gate = buildVerificationGate(room, ['wall width', 'wall depth']);
  if (!gate.allowed) throw new BuildEvidenceError(gate.missing, gate.unverified);
  for (const [label, value] of [['width', request.widthUm], ['height', request.heightUm], ['depth', request.depthUm]] as const) {
    if (!Number.isFinite(value) || value < 100_000 || value > 10_000_000) throw new Error(`Build ${label} must be between 100 mm and 10,000 mm.`);
  }

  const components = componentsFor(request);
  const materials = materialPlan(request, components);
  const { placement, conflicts: placementConflicts } = findPlacement(room, request);
  const wallWidth = room.measurements.find((m) => m.label.toLowerCase() === 'wall width')!;
  const wallDepth = room.measurements.find((m) => m.label.toLowerCase() === 'wall depth')!;
  const conflicts = [...placementConflicts];
  if (request.widthUm > wallWidth.valueUm) conflicts.push('Requested build width exceeds the verified wall width.');
  if (request.depthUm + 800_000 > wallDepth.valueUm) conflicts.push('Requested depth does not leave the assumed 800 mm front working clearance within the verified room depth.');

  const materialLow = materials.reduce((sum, material) => sum + (material.costLowUsd ?? 0), 0);
  const materialHigh = materials.reduce((sum, material) => sum + (material.costHighUsd ?? 0), 0);
  const effortBase = request.kind === 'desk' ? [4, 8] : request.kind === 'shelving' ? [5, 10] : request.kind === 'storage' ? [7, 14] : [10, 20];
  const verification = room.measurements.filter(measurementIsBuildSafe).map((m) => ({ label: m.label, valueUm: m.valueUm, toleranceUm: m.toleranceUm, source: m.source, verification: m.verification }));

  return {
    status: conflicts.length ? 'conflicted' : 'ready',
    kind: request.kind,
    title: request.title.trim().slice(0, 120) || `${request.kind[0].toUpperCase()}${request.kind.slice(1)} plan`,
    overall: { widthUm: request.widthUm, heightUm: request.heightUm, depthUm: request.depthUm },
    placement,
    clearances: { frontUm: 800_000, sideUm: 100_000 },
    components,
    materials,
    conflicts,
    assumptions: [
      'Dimensions shown are based on user-supplied build dimensions and the verified Room Model evidence listed with this plan.',
      'Material quantities include a 10% planning waste allowance and still require a final cut layout.',
      'Cost and labor ranges are nonbinding planning estimates and exclude taxes, delivery, tools and site-specific conditions.',
      'This plan is not a code-compliance, structural-engineering or professional construction approval.',
    ],
    verification,
    costEstimate: { currency: 'USD', low: materialLow, high: materialHigh, nonbinding: true },
    effortEstimate: { lowHours: effortBase[0], highHours: effortBase[1], skill: 'intermediate', nonbinding: true },
  };
}
