'use client';
import { FormEvent, PointerEvent, useMemo, useRef, useState } from 'react';
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

export default function Studio({ initialRoom, ownerId, demo = false }: { initialRoom: RoomModel; ownerId: string; demo?: boolean }) {
  const [room, setRoom] = useState(initialRoom);
  const [mode, setMode] = useState<WorkspaceMode>('organize');
  const [selected, setSelected] = useState(room.objects.find((x) => !x.fixed)?.id ?? room.objects[0]?.id ?? '');
  const [proposal, setProposal] = useState<PlanningProposal | null>(null);
  const [goal, setGoal] = useState('Improve storage and keep a clear path through the room.');
  const [status, setStatus] = useState('');
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
      boundary: { widthUm: Number(r.width_um), depthUm: Number(r.depth_um), ceilingHeightUm: r.ceiling_height_um == null ? null : Number(r.ceiling_height_um) },
      measurements: (m.data ?? []).map((x: any) => ({ id: x.id, label: x.label, valueUm: Number(x.value_um), toleranceUm: Number(x.tolerance_um), confidence: Number(x.confidence), source: x.source, verification: x.verification, deviceContext: x.device_context, calibration: x.calibration, correctionHistory: x.correction_history ?? [] })),
      objects: (o.data ?? []).map((x: any) => ({ id: x.id, label: x.label, kind: x.kind, position: { xUm: Number(x.x_um), yUm: Number(x.y_um) }, size: { widthUm: Number(x.width_um), depthUm: Number(x.depth_um) }, rotationDeg: Number(x.rotation_deg), fixed: x.fixed, clearanceUm: Number(x.clearance_um), source: x.source, confidence: x.confidence == null ? null : Number(x.confidence), notes: x.notes })),
      openings: (op.data ?? []).map((x: any) => ({ id: x.id, wall: x.wall, offsetUm: Number(x.offset_um), widthUm: Number(x.width_um), kind: x.kind, swing: x.swing })),
      updatedAt: r.updated_at,
    }));
  }

  async function persist(obj: RoomObject) {
    if (demo) {
      setRoom((x) => ({ ...x, objects: x.objects.map((o) => o.id === obj.id ? obj : o) }));
      return true;
    }
    const supabase = createClient();
    const { error } = await supabase.from('room_objects').update({
      x_um: obj.position.xUm,
      y_um: obj.position.yUm,
      rotation_deg: obj.rotationDeg,
      width_um: obj.size.widthUm,
      depth_um: obj.size.depthUm,
      updated_at: new Date().toISOString(),
    }).eq('id', obj.id).eq('owner_id', ownerId);
    if (error) {
      setStatus(error.message);
      return false;
    }
    setRoom((x) => ({ ...x, objects: x.objects.map((o) => o.id === obj.id ? obj : o) }));
    return true;
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
      id: crypto.randomUUID(),
      label,
      kind: 'furniture',
      position: { xUm: 0, yUm: 0 },
      size: { widthUm: Math.round(widthMm * 1000), depthUm: Math.round(depthMm * 1000) },
      rotationDeg: 0,
      fixed: false,
      clearanceUm: 50_000,
      source: 'user',
      confidence: 1,
      notes: null,
    };
    const placed = findOpenPlacement(seed);
    if (!placed) {
      setStatus('No valid open placement was found for those dimensions.');
      return;
    }
    if (demo) {
      setRoom((x) => ({ ...x, objects: [...x.objects, placed] }));
      setSelected(placed.id);
      setStatus(`${label} added to the Room Model.`);
      form.reset();
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from('room_objects').insert({
      id: placed.id,
      room_id: room.id,
      owner_id: ownerId,
      label: placed.label,
      kind: placed.kind,
      x_um: placed.position.xUm,
      y_um: placed.position.yUm,
      width_um: placed.size.widthUm,
      depth_um: placed.size.depthUm,
      rotation_deg: placed.rotationDeg,
      fixed: false,
      clearance_um: placed.clearanceUm,
      source: 'user',
      confidence: 1,
    });
    if (error) {
      setStatus(error.message);
      return;
    }
    setRoom((x) => ({ ...x, objects: [...x.objects, placed] }));
    setSelected(placed.id);
    setStatus(`${label} added and saved.`);
    form.reset();
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
    const conflicts = validatePlacement(room, next);
    if (conflicts.length) {
      setStatus(conflicts[0]);
      return;
    }
    if (await persist(next)) setStatus('Object dimensions saved.');
  }

  async function rotateSelected(delta: number) {
    if (!selectedObject || selectedObject.fixed) return;
    const next = { ...selectedObject, rotationDeg: (selectedObject.rotationDeg + delta + 360) % 360 };
    const conflicts = validatePlacement(room, next);
    if (conflicts.length) {
      setStatus(conflicts[0]);
      return;
    }
    if (await persist(next)) setStatus(`Rotation saved at ${next.rotationDeg}°.`);
  }

  async function deleteSelected() {
    if (!selectedObject || selectedObject.fixed) {
      setStatus('Fixed elements are protected.');
      return;
    }
    const remaining = room.objects.filter((o) => o.id !== selectedObject.id);
    if (!demo) {
      const supabase = createClient();
      const { error } = await supabase.from('room_objects').delete().eq('id', selectedObject.id).eq('owner_id', ownerId);
      if (error) {
        setStatus(error.message);
        return;
      }
    }
    setRoom((x) => ({ ...x, objects: x.objects.filter((o) => o.id !== selectedObject.id) }));
    setSelected(remaining.find((o) => !o.fixed)?.id ?? remaining[0]?.id ?? '');
    setStatus(`${selectedObject.label} removed from the Room Model.`);
  }

  function drag(e: PointerEvent<HTMLDivElement>, obj: RoomObject) {
    if (obj.fixed || !canvas.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = canvas.current.getBoundingClientRect();
    const move = (ev: globalThis.PointerEvent) => {
      const x = (ev.clientX - rect.left) / rect.width * room.boundary.widthUm - obj.size.widthUm / 2;
      const y = (ev.clientY - rect.top) / rect.height * room.boundary.depthUm - obj.size.depthUm / 2;
      const next = { ...obj, position: snapPoint({ xUm: Math.round(x), yUm: Math.round(y) }) };
      const conflicts = validatePlacement(room, next);
      setStatus(conflicts[0] ?? 'Placement is clear.');
      if (!conflicts.length) setRoom((r) => ({ ...r, objects: r.objects.map((o) => o.id === obj.id ? next : o) }));
    };
    const up = async () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const current = room.objects.find((o) => o.id === obj.id);
      if (current) await persist(current);
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
      if (o.position.xUm !== before?.position.xUm || o.position.yUm !== before?.position.yUm || o.rotationDeg !== before?.rotationDeg) await persist(o);
    }
    setProposal(null);
    setStatus('Proposal applied to the Room Model.');
  }

  const scaleX = (v: number) => `${v / room.boundary.widthUm * 100}%`;
  const scaleY = (v: number) => `${v / room.boundary.depthUm * 100}%`;

  return <main className="studio-page">
    <div className="studio-top">
      <div className="studio-title"><h1>{room.name} Studio</h1><p>One Room Model · {room.objects.length} objects · {room.measurements.length} measurements {demo && <span className="demo-pill">demo data</span>}</p></div>
      <div className="mode-switch" aria-label="Workspace mode">{(['organize', 'arrange', 'build'] as WorkspaceMode[]).map((x) => <button key={x} className={mode === x ? 'active' : ''} onClick={() => { setMode(x); setProposal(null); }}>{x[0].toUpperCase() + x.slice(1)}</button>)}</div>
    </div>
    <div className="studio-grid">
      <aside className="panel tool-panel">
        <div className="mode-copy">{copy[mode]}</div>
        <h2>Room objects</h2>
        <div className="tool-list">{room.objects.map((o) => <button key={o.id} className={selected === o.id ? 'active' : ''} onClick={() => setSelected(o.id)}>{o.label}{o.fixed ? ' · fixed' : ''}</button>)}</div>
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
        <div className="canvas-toolbar"><span>{Math.round(room.boundary.widthUm / 1000)} × {Math.round(room.boundary.depthUm / 1000)} mm</span><span>50 mm snap · fixed constraints protected</span></div>
        <div className="room-canvas" ref={canvas}>
          {room.openings.map((o) => <div key={o.id} className="opening-marker" title={`${o.kind} opening`} style={o.wall === 'south' || o.wall === 'north' ? { left: scaleX(o.offsetUm), width: scaleX(o.widthUm), height: 6, [o.wall === 'north' ? 'top' : 'bottom']: 0 } : { top: scaleY(o.offsetUm), height: scaleY(o.widthUm), width: 6, [o.wall === 'west' ? 'left' : 'right']: 0 }} />)}
          {room.objects.map((o) => <div key={o.id} className={`canvas-object${o.fixed ? ' fixed' : ''}${selected === o.id ? ' selected' : ''}`} onPointerDown={(e) => drag(e, o)} onClick={() => setSelected(o.id)} style={{ left: scaleX(o.position.xUm), top: scaleY(o.position.yUm), width: scaleX(o.size.widthUm), height: scaleY(o.size.depthUm), transform: `rotate(${o.rotationDeg}deg)` }}>{o.label}</div>)}
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
        <label>Goal<input value={goal} onChange={(e) => setGoal(e.target.value)} /></label>
        <button className="button primary" onClick={propose}>Generate {mode} proposal</button>
        {proposal && <div className="proposal-card"><h3>{proposal.title}</h3><p>{proposal.summary}</p><ul>{proposal.rationale.map((x) => <li key={x}>{x}</li>)}</ul>{proposal.conflicts.length > 0 && <p><b>Conflicts:</b> {proposal.conflicts.join(' ')}</p>}<button className="small-button dangerless" onClick={accept} disabled={proposal.conflicts.length > 0}>Apply proposal</button></div>}
        {status && <div className="status-card">{status}</div>}
        {!demo && <form action="/auth/signout" method="post"><button className="small-button" type="submit">Sign out</button></form>}
      </aside>
    </div>
  </main>;
}
