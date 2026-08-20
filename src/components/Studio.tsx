'use client';
import { FormEvent, PointerEvent, useMemo, useRef, useState } from 'react';
import type { PlanningProposal, RoomModel, RoomObject, WorkspaceMode } from '@/lib/room-model/types';
import { deterministicProposal } from '@/lib/planning/deterministic';
import { snapPoint, validatePlacement } from '@/lib/room-model/geometry';
import { buildVerificationGate } from '@/lib/room-model/verification';
import { changedObjectIds, cloneLayout, layoutChanged, type LayoutHistoryEntry } from '@/lib/room-model/history';
import { createClient } from '@/lib/supabase/client';
import CapturePanel from './CapturePanel';
import MeasurementPanel from './MeasurementPanel';

const copy: Record<WorkspaceMode, string> = {
  organize: 'Optimize usable space and circulation without changing the physical room.',
  arrange: 'Move and compare objects freely while keeping room dimensions and fixed constraints intact.',
  build: 'Design against verified dimensions. Build-ready status stays locked until required evidence is verified.',
};

export default function Studio({ initialRoom, ownerId, demo = false }: { initialRoom: RoomModel; ownerId: string; demo?: boolean }) {
  const [room, setRoom] = useState(initialRoom);
  const [mode, setMode] = useState<WorkspaceMode>('organize');
  const [selected, setSelected] = useState(room.objects.find((x) => !x.fixed)?.id ?? room.objects[0]?.id ?? '');
  const [proposal, setProposal] = useState<PlanningProposal | null>(null);
  const [goal, setGoal] = useState('Improve storage and keep a clear path through the room.');
  const [status, setStatus] = useState('');
  const [history, setHistory] = useState<LayoutHistoryEntry[]>([]);
  const [future, setFuture] = useState<LayoutHistoryEntry[]>([]);
  const [compare, setCompare] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const baseline = useRef(cloneLayout(initialRoom.objects));
  const canvas = useRef<HTMLDivElement>(null);
  const selectedObject = room.objects.find((x) => x.id === selected);
  const gate = useMemo(() => buildVerificationGate(room, ['wall width', 'wall depth']), [room]);
  const comparisonIds = useMemo(() => new Set(changedObjectIds(baseline.current, room.objects)), [room.objects]);

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
      boundary: { widthUm: Number(r.width_um), depthUm: Number(r.depth_um), ceilingHeightUm: r.ceiling_height_um == null ? null : Number(r.ceiling_height_um) },
      measurements: (m.data ?? []).map((x: any) => ({ id: x.id, label: x.label, valueUm: Number(x.value_um), toleranceUm: Number(x.tolerance_um), confidence: Number(x.confidence), source: x.source, verification: x.verification, deviceContext: x.device_context, calibration: x.calibration, correctionHistory: x.correction_history ?? [] })),
      objects: (o.data ?? []).map((x: any) => ({ id: x.id, label: x.label, kind: x.kind, position: { xUm: Number(x.x_um), yUm: Number(x.y_um) }, size: { widthUm: Number(x.width_um), depthUm: Number(x.depth_um) }, rotationDeg: Number(x.rotation_deg), fixed: x.fixed, clearanceUm: Number(x.clearance_um), source: x.source, confidence: x.confidence == null ? null : Number(x.confidence), notes: x.notes })),
      openings: (op.data ?? []).map((x: any) => ({ id: x.id, wall: x.wall, offsetUm: Number(x.offset_um), widthUm: Number(x.width_um), kind: x.kind, swing: x.swing })),
      updatedAt: r.updated_at,
    }));
  }

  function objectRow(obj: RoomObject) {
    return {
      id: obj.id,
      room_id: room.id,
      owner_id: ownerId,
      label: obj.label,
      kind: obj.kind,
      x_um: obj.position.xUm,
      y_um: obj.position.yUm,
      width_um: obj.size.widthUm,
      depth_um: obj.size.depthUm,
      rotation_deg: obj.rotationDeg,
      fixed: obj.fixed,
      clearance_um: obj.clearanceUm,
      source: obj.source,
      confidence: obj.confidence ?? null,
      notes: obj.notes ?? null,
      updated_at: new Date().toISOString(),
    };
  }

  async function syncLayout(current: RoomObject[], target: RoomObject[]) {
    if (demo) return true;
    const changedIds = new Set(changedObjectIds(current, target));
    if (changedIds.size === 0) return true;
    const targetIds = new Set(target.map((object) => object.id));
    const changedRows = target.filter((object) => changedIds.has(object.id)).map(objectRow);
    const removedIds = current.filter((object) => changedIds.has(object.id) && !targetIds.has(object.id)).map((object) => object.id);
    const supabase = createClient();

    if (changedRows.length) {
      const { error } = await supabase.from('room_objects').upsert(changedRows, { onConflict: 'id' });
      if (error) {
        setStatus(error.message);
        return false;
      }
    }
    if (removedIds.length) {
      const { error } = await supabase.from('room_objects').delete().eq('room_id', room.id).eq('owner_id', ownerId).in('id', removedIds);
      if (error) {
        setStatus(`${error.message} Refreshing server state.`);
        await refresh();
        return false;
      }
    }
    return true;
  }

  function layoutConflicts(objects: RoomObject[]) {
    const model = { ...room, objects };
    return objects.flatMap((object) => validatePlacement(model, object));
  }

  async function commitLayout(label: string, before: RoomObject[], after: RoomObject[]) {
    if (!layoutChanged(before, after)) return true;
    const conflicts = layoutConflicts(after);
    if (conflicts.length) {
      setStatus(conflicts[0]);
      return false;
    }
    if (!await syncLayout(before, after)) return false;
    const entry: LayoutHistoryEntry = { label, before: cloneLayout(before), after: cloneLayout(after) };
    setHistory((items) => [...items, entry].slice(-50));
    setFuture([]);
    setRoom((value) => ({ ...value, objects: cloneLayout(after) }));
    setStatus(`${label} saved.`);
    return true;
  }

  async function undo() {
    const entry = history[history.length - 1];
    if (!entry || historyBusy) return;
    setHistoryBusy(true);
    try {
      if (!await syncLayout(room.objects, entry.before)) return;
      setRoom((value) => ({ ...value, objects: cloneLayout(entry.before) }));
      setHistory((items) => items.slice(0, -1));
      setFuture((items) => [entry, ...items]);
      setSelected((id) => entry.before.some((object) => object.id === id) ? id : (entry.before.find((object) => !object.fixed)?.id ?? entry.before[0]?.id ?? ''));
      setStatus(`Undid: ${entry.label}.`);
    } finally {
      setHistoryBusy(false);
    }
  }

  async function redo() {
    const entry = future[0];
    if (!entry || historyBusy) return;
    setHistoryBusy(true);
    try {
      if (!await syncLayout(room.objects, entry.after)) return;
      setRoom((value) => ({ ...value, objects: cloneLayout(entry.after) }));
      setHistory((items) => [...items, entry].slice(-50));
      setFuture((items) => items.slice(1));
      setSelected((id) => entry.after.some((object) => object.id === id) ? id : (entry.after.find((object) => !object.fixed)?.id ?? entry.after[0]?.id ?? ''));
      setStatus(`Redid: ${entry.label}.`);
    } finally {
      setHistoryBusy(false);
    }
  }

  function findOpenPlacement(seed: RoomObject) {
    const step = 100_000;
    for (let y = step; y + seed.size.depthUm <= room.boundary.depthUm; y += step) {
      for (let x = step; x + seed.size.widthUm <= room.boundary.widthUm; x += step) {
        const candidate = { ...seed, position: { xUm: x, yUm: y } };
        if (validatePlacement(room, candidate).length === 0) return candidate;
      }
    }
    return null;
  }

  async function addObject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const label = String(data.get('label') ?? '').trim();
    const widthMm = Number(data.get('widthMm'));
    const depthMm = Number(data.get('depthMm'));
    if (!label || !Number.isFinite(widthMm) || !Number.isFinite(depthMm) || widthMm < 50 || depthMm < 50) {
      setStatus('Enter a label and dimensions of at least 50 mm.');
      return;
    }
    const seed: RoomObject = {
      id: crypto.randomUUID(), label, kind: 'furniture', position: { xUm: 0, yUm: 0 },
      size: { widthUm: Math.round(widthMm * 1000), depthUm: Math.round(depthMm * 1000) },
      rotationDeg: 0, fixed: false, clearanceUm: 50_000, source: 'user', confidence: 1, notes: null,
    };
    const placed = findOpenPlacement(seed);
    if (!placed) {
      setStatus('No valid open placement was found for those dimensions.');
      return;
    }
    const after = [...room.objects, placed];
    if (await commitLayout(`Added ${label}`, room.objects, after)) {
      setSelected(placed.id);
      form.reset();
    }
  }

  async function resizeSelected(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedObject || selectedObject.fixed) return;
    const data = new FormData(event.currentTarget);
    const widthMm = Number(data.get('widthMm'));
    const depthMm = Number(data.get('depthMm'));
    if (!Number.isFinite(widthMm) || !Number.isFinite(depthMm) || widthMm < 50 || depthMm < 50) {
      setStatus('Dimensions must be at least 50 mm.');
      return;
    }
    const next = { ...selectedObject, size: { widthUm: Math.round(widthMm * 1000), depthUm: Math.round(depthMm * 1000) } };
    const after = room.objects.map((object) => object.id === next.id ? next : object);
    await commitLayout(`Resized ${next.label}`, room.objects, after);
  }

  async function rotateSelected(delta: number) {
    if (!selectedObject || selectedObject.fixed) return;
    const next = { ...selectedObject, rotationDeg: (selectedObject.rotationDeg + delta + 360) % 360 };
    const after = room.objects.map((object) => object.id === next.id ? next : object);
    await commitLayout(`Rotated ${next.label}`, room.objects, after);
  }

  async function deleteSelected() {
    if (!selectedObject || selectedObject.fixed) {
      setStatus('Fixed elements are protected.');
      return;
    }
    const after = room.objects.filter((object) => object.id !== selectedObject.id);
    if (await commitLayout(`Removed ${selectedObject.label}`, room.objects, after)) {
      setSelected(after.find((object) => !object.fixed)?.id ?? after[0]?.id ?? '');
    }
  }

  function drag(e: PointerEvent<HTMLDivElement>, obj: RoomObject) {
    if (obj.fixed || !canvas.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const bounds = canvas.current.getBoundingClientRect();
    const before = cloneLayout(room.objects);
    let latestValid = obj;
    const move = (ev: globalThis.PointerEvent) => {
      const x = (ev.clientX - bounds.left) / bounds.width * room.boundary.widthUm - obj.size.widthUm / 2;
      const y = (ev.clientY - bounds.top) / bounds.height * room.boundary.depthUm - obj.size.depthUm / 2;
      const next = { ...obj, position: snapPoint({ xUm: Math.round(x), yUm: Math.round(y) }) };
      const conflicts = validatePlacement({ ...room, objects: before }, next);
      setStatus(conflicts[0] ?? 'Placement is clear.');
      if (!conflicts.length) {
        latestValid = next;
        setRoom((value) => ({ ...value, objects: value.objects.map((object) => object.id === obj.id ? next : object) }));
      }
    };
    const up = async () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const after = before.map((object) => object.id === obj.id ? latestValid : object);
      if (!await commitLayout(`Moved ${obj.label}`, before, after)) {
        setRoom((value) => ({ ...value, objects: before }));
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  }

  async function propose() {
    setStatus('Generating a geometry-checked proposal…');
    if (demo) {
      setProposal(deterministicProposal(room, mode));
      setStatus('Local deterministic proposal ready.');
      return;
    }
    try {
      const res = await fetch('/api/ai/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode, goal }) });
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
    const changed = room.objects.map((object) => {
      const placement = proposal.placements.find((item) => item.objectId === object.id);
      return placement ? { ...object, position: placement.position, rotationDeg: placement.rotationDeg } : object;
    });
    if (await commitLayout(`Applied ${mode} proposal`, room.objects, changed)) setProposal(null);
  }

  const scaleX = (v: number) => `${v / room.boundary.widthUm * 100}%`;
  const scaleY = (v: number) => `${v / room.boundary.depthUm * 100}%`;

  return <main className="studio-page">
    <div className="studio-top">
      <div className="studio-title"><a className="studio-project-link" href="/projects">← Projects</a><h1>{room.name} Studio</h1><p>One Room Model · {room.objects.length} objects · {room.measurements.length} measurements {demo && <span className="demo-pill">demo data</span>}</p></div>
      <div className="mode-switch" aria-label="Workspace mode">{(['organize', 'arrange', 'build'] as WorkspaceMode[]).map((value) => <button key={value} className={mode === value ? 'active' : ''} onClick={() => { setMode(value); setProposal(null); }}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
    </div>
    <div className="studio-grid">
      <aside className="panel tool-panel">
        <div className="mode-copy">{copy[mode]}</div>
        <h2>Room objects</h2>
        <div className="tool-list">{room.objects.map((object) => <button key={object.id} className={selected === object.id ? 'active' : ''} onClick={() => setSelected(object.id)}>{object.label}{object.fixed ? ' · fixed' : ''}</button>)}</div>
        <form className="object-add-form" onSubmit={addObject}>
          <h2>Add object</h2>
          <label>Label<input name="label" placeholder="Accent chair" required /></label>
          <div className="dimension-pair"><label>Width mm<input name="widthMm" type="number" min="50" defaultValue="600" required /></label><label>Depth mm<input name="depthMm" type="number" min="50" defaultValue="600" required /></label></div>
          <button className="small-button" type="submit">Add to room</button>
        </form>
        <CapturePanel ownerId={ownerId} roomId={room.id} onSaved={refresh} />
        <MeasurementPanel ownerId={ownerId} roomId={room.id} measurements={room.measurements} onChanged={refresh} />
      </aside>
      <section className="panel canvas-panel">
        <div className="canvas-toolbar history-toolbar">
          <div><span>{Math.round(room.boundary.widthUm / 1000)} × {Math.round(room.boundary.depthUm / 1000)} mm</span><span className="canvas-rule">50 mm snap · fixed constraints protected</span></div>
          <div className="history-actions"><button className="small-button" onClick={undo} disabled={!history.length || historyBusy}>Undo</button><button className="small-button" onClick={redo} disabled={!future.length || historyBusy}>Redo</button><button className={`small-button${compare ? ' compare-active' : ''}`} onClick={() => setCompare((value) => !value)}>Compare</button></div>
        </div>
        {compare && <div className="compare-legend"><span><i className="before-swatch" /> Before</span><span><i className="current-swatch" /> Current</span><span>{comparisonIds.size} changed object{comparisonIds.size === 1 ? '' : 's'}</span></div>}
        <div className="room-canvas" ref={canvas}>
          {room.openings.map((opening) => <div key={opening.id} className="opening-marker" title={`${opening.kind} opening`} style={opening.wall === 'south' || opening.wall === 'north' ? { left: scaleX(opening.offsetUm), width: scaleX(opening.widthUm), height: 6, [opening.wall === 'north' ? 'top' : 'bottom']: 0 } : { top: scaleY(opening.offsetUm), height: scaleY(opening.widthUm), width: 6, [opening.wall === 'west' ? 'left' : 'right']: 0 }} />)}
          {compare && baseline.current.filter((object) => comparisonIds.has(object.id)).map((object) => <div key={`before-${object.id}`} className="canvas-object compare-before" style={{ left: scaleX(object.position.xUm), top: scaleY(object.position.yUm), width: scaleX(object.size.widthUm), height: scaleY(object.size.depthUm), transform: `rotate(${object.rotationDeg}deg)` }}>{object.label}</div>)}
          {room.objects.map((object) => <div key={object.id} className={`canvas-object${object.fixed ? ' fixed' : ''}${selected === object.id ? ' selected' : ''}${compare && comparisonIds.has(object.id) ? ' compare-current' : ''}`} onPointerDown={(e) => drag(e, object)} onClick={() => setSelected(object.id)} style={{ left: scaleX(object.position.xUm), top: scaleY(object.position.yUm), width: scaleX(object.size.widthUm), height: scaleY(object.size.depthUm), transform: `rotate(${object.rotationDeg}deg)` }}>{object.label}</div>)}
        </div>
      </section>
      <aside className="panel inspector">
        <h2>{mode[0].toUpperCase() + mode.slice(1)}</h2>
        {selectedObject && <>
          <p><b>{selectedObject.label}</b>{selectedObject.fixed ? ' · fixed' : ''}</p>
          <div className="status-card">Position {Math.round(selectedObject.position.xUm / 1000)}, {Math.round(selectedObject.position.yUm / 1000)} mm<br />Size {Math.round(selectedObject.size.widthUm / 1000)} × {Math.round(selectedObject.size.depthUm / 1000)} mm<br />Rotation {selectedObject.rotationDeg}°</div>
          {selectedObject.fixed ? <div className="status-card warning">Fixed elements are protected from direct editing.</div> : <div className="object-tools">
            <h3>Object tools</h3>
            <div className="rotate-row"><button className="small-button" onClick={() => rotateSelected(-15)}>↺ 15°</button><button className="small-button" onClick={() => rotateSelected(15)}>15° ↻</button></div>
            <form key={selectedObject.id} className="resize-form" onSubmit={resizeSelected}>
              <div className="dimension-pair"><label>Width mm<input name="widthMm" type="number" min="50" defaultValue={Math.round(selectedObject.size.widthUm / 1000)} required /></label><label>Depth mm<input name="depthMm" type="number" min="50" defaultValue={Math.round(selectedObject.size.depthUm / 1000)} required /></label></div>
              <button className="small-button" type="submit">Save size</button>
            </form>
            <button className="small-button object-delete" onClick={deleteSelected}>Remove object</button>
          </div>}
        </>}
        {mode === 'build' && <div className={`status-card ${gate.allowed ? '' : 'warning'}`}><b>{gate.allowed ? 'Build evidence ready' : 'Build evidence locked'}</b><br />{gate.allowed ? 'Required measurements are verified.' : `Missing: ${[...gate.missing, ...gate.unverified].join(', ') || 'verification'}`}</div>}
        <label>Goal<input value={goal} onChange={(event) => setGoal(event.target.value)} /></label>
        <button className="button primary" onClick={propose}>Generate {mode} proposal</button>
        {proposal && <div className="proposal-card"><h3>{proposal.title}</h3><p>{proposal.summary}</p><ul>{proposal.rationale.map((item) => <li key={item}>{item}</li>)}</ul>{proposal.conflicts.length > 0 && <p><b>Conflicts:</b> {proposal.conflicts.join(' ')}</p>}<button className="small-button dangerless" onClick={accept} disabled={proposal.conflicts.length > 0}>Apply proposal</button></div>}
        {history.length > 0 && <div className="history-summary"><b>{history.length} change{history.length === 1 ? '' : 's'} this session</b><span>Last: {history[history.length - 1].label}</span></div>}
        {status && <div className="status-card">{status}</div>}
        {!demo && <form action="/auth/signout" method="post"><button className="small-button" type="submit">Sign out</button></form>}
      </aside>
    </div>
  </main>;
}
