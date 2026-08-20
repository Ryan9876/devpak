'use client';

import { PointerEvent, useMemo, useRef, useState } from 'react';
import type { PlanningProposal, RoomModel, RoomObject, WorkspaceMode } from '@/lib/room-model/types';
import { deterministicProposal } from '@/lib/planning/deterministic';
import { snapPoint, validatePlacement } from '@/lib/room-model/geometry';
import { buildVerificationGate } from '@/lib/room-model/verification';
import { createClient } from '@/lib/supabase/client';
import CapturePanel from './CapturePanel';
import MeasurementPanel from './MeasurementPanel';

const copy: Record<WorkspaceMode, string> = {
  organize: 'Optimize usable space and circulation without changing the physical room.',
  arrange: 'Move and compare objects freely while keeping room dimensions and fixed constraints intact.',
  build: 'Design against verified dimensions. Build-ready status stays locked until required evidence is verified.',
};

const modeLabel: Record<WorkspaceMode, string> = {
  organize: 'Organize',
  arrange: 'Arrange',
  build: 'Build',
};

type DragFeedback = {
  objectId: string;
  conflict: string | null;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export default function Studio({
  initialRoom,
  ownerId,
  demo = false,
}: {
  initialRoom: RoomModel;
  ownerId: string;
  demo?: boolean;
}) {
  const [room, setRoom] = useState(initialRoom);
  const [mode, setMode] = useState<WorkspaceMode>('organize');
  const [selected, setSelected] = useState(room.objects.find((x) => !x.fixed)?.id ?? room.objects[0]?.id ?? '');
  const [proposal, setProposal] = useState<PlanningProposal | null>(null);
  const [goal, setGoal] = useState('Improve storage and keep a clear path through the room.');
  const [status, setStatus] = useState('');
  const [dragFeedback, setDragFeedback] = useState<DragFeedback | null>(null);
  const canvas = useRef<HTMLDivElement>(null);

  const selectedObject = room.objects.find((x) => x.id === selected);
  const gate = useMemo(() => buildVerificationGate(room, ['wall width', 'wall depth']), [room]);

  async function refresh() {
    if (demo) return;
    const supabase = createClient();
    const { data: r, error } = await supabase.from('rooms').select('*').eq('id', room.id).single();
    if (error || !r) return;
    const [m, o, op] = await Promise.all([
      supabase.from('room_measurements').select('*').eq('room_id', room.id),
      supabase.from('room_objects').select('*').eq('room_id', room.id),
      supabase.from('room_openings').select('*').eq('room_id', room.id),
    ]);
    if (m.error || o.error || op.error) return;
    setRoom((prev) => ({
      ...prev,
      boundary: {
        widthUm: Number(r.width_um),
        depthUm: Number(r.depth_um),
        ceilingHeightUm: r.ceiling_height_um == null ? null : Number(r.ceiling_height_um),
      },
      measurements: (m.data ?? []).map((x: any) => ({
        id: x.id,
        label: x.label,
        valueUm: Number(x.value_um),
        toleranceUm: Number(x.tolerance_um),
        confidence: Number(x.confidence),
        source: x.source,
        verification: x.verification,
        deviceContext: x.device_context,
        calibration: x.calibration,
        correctionHistory: x.correction_history ?? [],
      })),
      objects: (o.data ?? []).map((x: any) => ({
        id: x.id,
        label: x.label,
        kind: x.kind,
        position: { xUm: Number(x.x_um), yUm: Number(x.y_um) },
        size: { widthUm: Number(x.width_um), depthUm: Number(x.depth_um) },
        rotationDeg: Number(x.rotation_deg),
        fixed: x.fixed,
        clearanceUm: Number(x.clearance_um),
        source: x.source,
        confidence: x.confidence == null ? null : Number(x.confidence),
        notes: x.notes,
      })),
      openings: (op.data ?? []).map((x: any) => ({
        id: x.id,
        wall: x.wall,
        offsetUm: Number(x.offset_um),
        widthUm: Number(x.width_um),
        kind: x.kind,
        swing: x.swing,
      })),
      updatedAt: r.updated_at,
    }));
  }

  async function persist(obj: RoomObject) {
    if (demo) {
      setRoom((current) => ({ ...current, objects: current.objects.map((o) => (o.id === obj.id ? obj : o)) }));
      return true;
    }
    const supabase = createClient();
    const { error } = await supabase
      .from('room_objects')
      .update({
        x_um: obj.position.xUm,
        y_um: obj.position.yUm,
        rotation_deg: obj.rotationDeg,
        width_um: obj.size.widthUm,
        depth_um: obj.size.depthUm,
        updated_at: new Date().toISOString(),
      })
      .eq('id', obj.id)
      .eq('owner_id', ownerId);
    if (error) {
      setStatus(error.message);
      return false;
    }
    setRoom((current) => ({ ...current, objects: current.objects.map((o) => (o.id === obj.id ? obj : o)) }));
    return true;
  }

  function drag(event: PointerEvent<HTMLDivElement>, obj: RoomObject) {
    if (obj.fixed || !canvas.current) return;

    event.preventDefault();
    setSelected(obj.id);
    setStatus('');
    event.currentTarget.setPointerCapture(event.pointerId);

    const rect = canvas.current.getBoundingClientRect();
    const pointerXUm = ((event.clientX - rect.left) / rect.width) * room.boundary.widthUm;
    const pointerYUm = ((event.clientY - rect.top) / rect.height) * room.boundary.depthUm;
    const grabOffsetXUm = pointerXUm - obj.position.xUm;
    const grabOffsetYUm = pointerYUm - obj.position.yUm;
    const original = obj;
    let latest = obj;

    setDragFeedback({ objectId: obj.id, conflict: null });

    const move = (ev: globalThis.PointerEvent) => {
      const rawX = ((ev.clientX - rect.left) / rect.width) * room.boundary.widthUm - grabOffsetXUm;
      const rawY = ((ev.clientY - rect.top) / rect.height) * room.boundary.depthUm - grabOffsetYUm;
      const xUm = clamp(Math.round(rawX), 0, room.boundary.widthUm - obj.size.widthUm);
      const yUm = clamp(Math.round(rawY), 0, room.boundary.depthUm - obj.size.depthUm);
      latest = { ...obj, position: { xUm, yUm } };
      const conflict = validatePlacement(room, latest)[0] ?? null;
      setDragFeedback({ objectId: obj.id, conflict });
      setRoom((current) => ({
        ...current,
        objects: current.objects.map((o) => (o.id === obj.id ? latest : o)),
      }));
    };

    const up = async () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);

      const snapped = { ...latest, position: snapPoint(latest.position) };
      snapped.position.xUm = clamp(snapped.position.xUm, 0, room.boundary.widthUm - snapped.size.widthUm);
      snapped.position.yUm = clamp(snapped.position.yUm, 0, room.boundary.depthUm - snapped.size.depthUm);
      const conflict = validatePlacement(room, snapped)[0] ?? null;

      if (conflict) {
        setRoom((current) => ({
          ...current,
          objects: current.objects.map((o) => (o.id === original.id ? original : o)),
        }));
        setStatus(`Can't place ${obj.label} there. ${conflict}`);
        setDragFeedback(null);
        return;
      }

      setRoom((current) => ({
        ...current,
        objects: current.objects.map((o) => (o.id === snapped.id ? snapped : o)),
      }));
      const saved = await persist(snapped);
      if (saved) setStatus(`${obj.label} moved · snapped to the 50 mm grid.`);
      setDragFeedback(null);
    };

    const cancel = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      setRoom((current) => ({
        ...current,
        objects: current.objects.map((o) => (o.id === original.id ? original : o)),
      }));
      setDragFeedback(null);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    window.addEventListener('pointercancel', cancel, { once: true });
  }

  async function propose() {
    setStatus('Generating a geometry-checked proposal…');
    if (demo) {
      setProposal(deterministicProposal(room, mode));
      setStatus('Local deterministic proposal ready.');
      return;
    }
    try {
      const res = await fetch('/api/ai/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode, goal }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Proposal failed');
      setProposal(json.proposal);
      setStatus('Proposal ready. Geometry conflicts are shown separately.');
    } catch (err) {
      setProposal(deterministicProposal(room, mode));
      setStatus(`${err instanceof Error ? err.message : 'AI unavailable'} Deterministic fallback shown.`);
    }
  }

  async function accept() {
    if (!proposal) return;
    const changed = room.objects.map((o) => {
      const p = proposal.placements.find((x) => x.objectId === o.id);
      return p ? { ...o, position: p.position, rotationDeg: p.rotationDeg } : o;
    });
    const conflicts = changed.flatMap((o) => validatePlacement({ ...room, objects: changed }, o));
    if (conflicts.length) {
      setStatus(conflicts[0]);
      return;
    }
    for (const o of changed) {
      const before = room.objects.find((x) => x.id === o.id);
      if (o.position.xUm !== before?.position.xUm || o.position.yUm !== before?.position.yUm) await persist(o);
    }
    setProposal(null);
    setStatus('Proposal applied to the Room Model.');
  }

  function selectObject(id: string) {
    setSelected(id);
    setStatus('');
  }

  const scaleX = (v: number) => `${(v / room.boundary.widthUm) * 100}%`;
  const scaleY = (v: number) => `${(v / room.boundary.depthUm) * 100}%`;
  const dragging = dragFeedback?.objectId;

  return (
    <main className="studio-page">
      <div className="studio-top">
        <div className="studio-title">
          <p className="eyebrow">ROOM MODEL</p>
          <h1>{room.name}</h1>
          <p>
            {Math.round(room.boundary.widthUm / 1000)} × {Math.round(room.boundary.depthUm / 1000)} mm · {room.objects.length} objects
            {demo && <span className="demo-pill">demo data</span>}
          </p>
        </div>
        <div className="mode-switch" aria-label="Workspace mode">
          {(['organize', 'arrange', 'build'] as WorkspaceMode[]).map((x) => (
            <button
              key={x}
              className={mode === x ? 'active' : ''}
              onClick={() => {
                setMode(x);
                setProposal(null);
                setStatus('');
              }}
            >
              {modeLabel[x]}
            </button>
          ))}
        </div>
      </div>

      <div className="studio-grid">
        <aside className="panel tool-panel">
          <div className="mode-copy">
            <span>{modeLabel[mode]}</span>
            {copy[mode]}
          </div>

          <div className="panel-heading">
            <h2>Room objects</h2>
            <span>{room.objects.length}</span>
          </div>
          <div className="tool-list object-list">
            {room.objects.map((o) => (
              <button key={o.id} className={selected === o.id ? 'active' : ''} onClick={() => selectObject(o.id)}>
                <span>{o.label}</span>
                <small>{o.fixed ? 'Fixed' : 'Movable'}</small>
              </button>
            ))}
          </div>

          <div className="utility-stack">
            <details className="utility-section">
              <summary>
                <span>Capture</span>
                <small>Photos & room evidence</small>
              </summary>
              <CapturePanel ownerId={ownerId} roomId={room.id} onSaved={refresh} />
            </details>
            <details className="utility-section">
              <summary>
                <span>Measurements</span>
                <small>{room.measurements.length ? `${room.measurements.length} verified` : 'Add verified dimensions'}</small>
              </summary>
              <MeasurementPanel ownerId={ownerId} roomId={room.id} measurements={room.measurements} onChanged={refresh} />
            </details>
          </div>
        </aside>

        <section className="panel canvas-panel">
          <div className="canvas-toolbar">
            <div>
              <strong>Floor plan</strong>
              <span>Drag movable objects freely</span>
            </div>
            <div className="canvas-toolbar-meta">
              <span>50 mm snap on release</span>
              <span>Fixed constraints protected</span>
            </div>
          </div>

          <div className="room-stage">
            <div
              className="room-canvas"
              ref={canvas}
              style={{ aspectRatio: `${room.boundary.widthUm} / ${room.boundary.depthUm}` }}
            >
              {room.openings.map((o) => (
                <div
                  key={o.id}
                  className="opening-marker"
                  title={`${o.kind} opening`}
                  style={
                    o.wall === 'south' || o.wall === 'north'
                      ? {
                          left: scaleX(o.offsetUm),
                          width: scaleX(o.widthUm),
                          height: 6,
                          [o.wall === 'north' ? 'top' : 'bottom']: 0,
                        }
                      : {
                          top: scaleY(o.offsetUm),
                          height: scaleY(o.widthUm),
                          width: 6,
                          [o.wall === 'west' ? 'left' : 'right']: 0,
                        }
                  }
                />
              ))}

              {room.objects.map((o) => {
                const isDragging = dragging === o.id;
                const hasConflict = isDragging && Boolean(dragFeedback?.conflict);
                return (
                  <div
                    key={o.id}
                    className={`canvas-object${o.fixed ? ' fixed' : ''}${selected === o.id ? ' selected' : ''}${isDragging ? ' dragging' : ''}${hasConflict ? ' invalid' : ''}`}
                    onPointerDown={(e) => drag(e, o)}
                    onClick={() => selectObject(o.id)}
                    style={{
                      left: scaleX(o.position.xUm),
                      top: scaleY(o.position.yUm),
                      width: scaleX(o.size.widthUm),
                      height: scaleY(o.size.depthUm),
                      transform: `rotate(${o.rotationDeg}deg)`,
                    }}
                  >
                    <span>{o.label}</span>
                    {o.fixed && <small>fixed</small>}
                  </div>
                );
              })}

              {dragFeedback && (
                <div className={`placement-hint${dragFeedback.conflict ? ' warning' : ''}`}>
                  {dragFeedback.conflict ?? 'Release to snap to the 50 mm grid'}
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="panel inspector">
          <div className="inspector-heading">
            <span className="inspector-mode">{modeLabel[mode]}</span>
            <h2>{selectedObject?.label ?? 'Select an object'}</h2>
            {selectedObject && <p>{selectedObject.fixed ? 'Fixed room element' : 'Movable room object'}</p>}
          </div>

          {selectedObject && (
            <div className="object-metrics">
              <div>
                <span>Position</span>
                <strong>
                  {Math.round(selectedObject.position.xUm / 1000)}, {Math.round(selectedObject.position.yUm / 1000)} mm
                </strong>
              </div>
              <div>
                <span>Size</span>
                <strong>
                  {Math.round(selectedObject.size.widthUm / 1000)} × {Math.round(selectedObject.size.depthUm / 1000)} mm
                </strong>
              </div>
            </div>
          )}

          {mode === 'build' && (
            <div className={`status-card ${gate.allowed ? 'success' : 'warning'}`}>
              <b>{gate.allowed ? 'Build evidence ready' : 'Build evidence locked'}</b>
              <br />
              {gate.allowed ? 'Required measurements are verified.' : `Missing: ${[...gate.missing, ...gate.unverified].join(', ') || 'verification'}`}
            </div>
          )}

          <div className="proposal-controls">
            <label>
              Goal
              <input value={goal} onChange={(e) => setGoal(e.target.value)} />
            </label>
            <button className="button primary" onClick={propose}>
              Generate {modeLabel[mode].toLowerCase()} proposal
            </button>
          </div>

          {proposal && (
            <div className="proposal-card">
              <h3>{proposal.title}</h3>
              <p>{proposal.summary}</p>
              <ul>{proposal.rationale.map((x) => <li key={x}>{x}</li>)}</ul>
              {proposal.conflicts.length > 0 && <p><b>Conflicts:</b> {proposal.conflicts.join(' ')}</p>}
              <button className="small-button dangerless" onClick={accept} disabled={proposal.conflicts.length > 0}>
                Apply proposal
              </button>
            </div>
          )}

          {status && <div className="status-card workspace-status">{status}</div>}

          <div className="inspector-footer">
            <span>Changes save when you release an object.</span>
            {!demo && (
              <form action="/auth/signout" method="post">
                <button className="text-button" type="submit">Sign out</button>
              </form>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
