import { validatePlacement } from '../room-model/geometry';
import type { PlanningProposal, RoomModel, WorkspaceMode } from '../room-model/types';

const clamp = (n: number) => Math.max(0, Math.min(1, n));

export function deterministicProposal(room: RoomModel, mode: WorkspaceMode): PlanningProposal {
  const movable = room.objects.filter((item) => !item.fixed);
  const placements = movable.map((item, index) => {
    const margin = 180_000;
    const lane = index % 2;
    return {
      objectId: item.id,
      position: {
        xUm: lane === 0 ? margin : Math.max(margin, room.boundary.widthUm - item.size.widthUm - margin),
        yUm: margin + Math.floor(index / 2) * 850_000,
      },
      rotationDeg: item.rotationDeg,
    };
  });
  const conflicts = placements.flatMap((placement) => {
    const original = room.objects.find((item) => item.id === placement.objectId)!;
    return validatePlacement(room, { ...original, position: placement.position, rotationDeg: placement.rotationDeg });
  });
  const verified = room.measurements.filter((m) => m.verification !== 'estimated').length;
  return {
    id: `det-${room.id}-${mode}`,
    mode,
    title: mode === 'organize' ? 'Clear circulation layout' : mode === 'arrange' ? 'Balanced room arrangement' : 'Build placement study',
    summary: mode === 'build' ? 'A geometry-checked starting placement. Final build output remains gated on verified dimensional evidence.' : 'Moves movable objects toward room edges while preserving fixed constraints and openings.',
    rationale: ['Preserves fixed obstacles.', 'Keeps door/opening clearance zones visible.', 'Uses the same Room Model for every mode.'],
    assumptions: room.assumptions,
    placements,
    confidence: clamp(0.55 + verified * 0.06),
    conflicts,
    requiresVerification: mode === 'build' ? room.measurements.filter((m) => m.verification === 'estimated').map((m) => m.label) : [],
  };
}
