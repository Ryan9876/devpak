import type { RoomObject } from './types';

export type LayoutHistoryEntry = {
  label: string;
  before: RoomObject[];
  after: RoomObject[];
};

export function cloneLayout(objects: RoomObject[]): RoomObject[] {
  return objects.map((object) => ({
    ...object,
    position: { ...object.position },
    size: { ...object.size },
  }));
}

function normalized(objects: RoomObject[]) {
  return cloneLayout(objects)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((object) => ({
      id: object.id,
      label: object.label,
      kind: object.kind,
      position: object.position,
      size: object.size,
      rotationDeg: object.rotationDeg,
      fixed: object.fixed,
      clearanceUm: object.clearanceUm,
      source: object.source,
      confidence: object.confidence ?? null,
      notes: object.notes ?? null,
    }));
}

export function layoutChanged(before: RoomObject[], after: RoomObject[]) {
  return JSON.stringify(normalized(before)) !== JSON.stringify(normalized(after));
}

export function changedObjectIds(before: RoomObject[], after: RoomObject[]) {
  const beforeById = new Map(normalized(before).map((object) => [object.id, object]));
  const afterById = new Map(normalized(after).map((object) => [object.id, object]));
  return [...new Set([...beforeById.keys(), ...afterById.keys()])].filter((id) =>
    JSON.stringify(beforeById.get(id) ?? null) !== JSON.stringify(afterById.get(id) ?? null),
  );
}
