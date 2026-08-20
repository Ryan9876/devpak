'use client';

import { ChangeEvent, PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { PlanningProposal, RoomModel, RoomObject, WorkspaceMode } from '@/lib/room-model/types';
import { deterministicProposal } from '@/lib/planning/deterministic';
import { snapPoint, validatePlacement } from '@/lib/room-model/geometry';
import { buildVerificationGate } from '@/lib/room-model/verification';
import { createClient } from '@/lib/supabase/client';
import MeasurementPanel from './MeasurementPanel';

const copy: Record<WorkspaceMode, string> = {
  organize: 'Use the real room photo to explore a cleaner, more useful version of the space without changing the room itself.',
  arrange: 'Try believable furniture and object arrangements in the photographed room while geometry stays available underneath.',
  build: 'Visualize what could be built in the room, then use verified dimensions and the Geometry view when precision matters.',
};

const modeLabel: Record<WorkspaceMode, string> = {
  organize: 'Organize',
  arrange: 'Arrange',
  build: 'Build',
};

type WorkspaceView = 'photo' | 'plan';

type DragFeedback = {
  objectId: string;
  conflict: string | null;
};

type PhotoAsset = {
  id: string;
  object_path: string;
  mime_type: string;
  byte_length: number;
  capture_context: {
    captureMethod?: string;
    sourceAssetId?: string;
    mode?: WorkspaceMode;
    goal?: string;
    model?: string;
    generatedAt?: string;
  } | null;
  created_at: string;
  signedUrl: string | null;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function isPhotoProposal(asset: PhotoAsset) {
  return asset.capture_context?.captureMethod === 'ai_photo_proposal';
}

function friendlyDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
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
  const [view, setView] = useState<WorkspaceView>('photo');
  const [selected, setSelected] = useState(room.objects.find((x) => !x.fixed)?.id ?? room.objects[0]?.id ?? '');
  const [proposal, setProposal] = useState<PlanningProposal | null>(null);
  const [goal, setGoal] = useState('Make this room more useful, calm, and easy to move through.');
  const [status, setStatus] = useState('');
  const [dragFeedback, setDragFeedback] = useState<DragFeedback | null>(null);
  const [photoAssets, setPhotoAssets] = useState<PhotoAsset[]>([]);
  const [activePhotoId, setActivePhotoId] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoStatus, setPhotoStatus] = useState('');
  const canvas = useRef<HTMLDivElement>(null);

  const selectedObject = room.objects.find((x) => x.id === selected);
  const gate = useMemo(() => buildVerificationGate(room, ['wall width', 'wall depth']), [room]);
  const sourcePhotos = useMemo(() => photoAssets.filter((asset) => !isPhotoProposal(asset)), [photoAssets]);
  const visualProposals = useMemo(() => photoAssets.filter(isPhotoProposal), [photoAssets]);
  const sourcePhoto = sourcePhotos[0] ?? null;
  const activePhoto = photoAssets.find((asset) => asset.id === activePhotoId) ?? visualProposals[0] ?? sourcePhoto;

  async function refreshRoom() {
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

  async function refreshPhotos(preferId?: string) {
    if (demo) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('room_assets')
      .select('id,object_path,mime_type,byte_length,capture_context,created_at')
      .eq('room_id', room.id)
      .eq('owner_id', ownerId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) {
      setPhotoStatus(error.message);
      return;
    }

    const rows = (data ?? []) as Omit<PhotoAsset, 'signedUrl'>[];
    if (!rows.length) {
      setPhotoAssets([]);
      setActivePhotoId('');
      return;
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from('room-assets')
      .createSignedUrls(rows.map((asset) => asset.object_path), 3600);
    if (signedError) {
      setPhotoStatus(signedError.message);
      return;
    }

    const withUrls: PhotoAsset[] = rows.map((asset, index) => ({ ...asset, signedUrl: signed?.[index]?.signedUrl ?? null }));
    setPhotoAssets(withUrls);
    setActivePhotoId((current) => {
      if (preferId && withUrls.some((asset) => asset.id === preferId)) return preferId;
      if (current && withUrls.some((asset) => asset.id === current)) return current;
      return withUrls.find(isPhotoProposal)?.id ?? withUrls.find((asset) => !isPhotoProposal(asset))?.id ?? '';
    });
  }

  useEffect(() => {
    void refreshPhotos();
  }, [room.id]);

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoStatus('Choose an image file.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setPhotoStatus('Room photos must be 15 MB or smaller.');
      return;
    }

    setPhotoBusy(true);
    setPhotoStatus('Saving the room photo privately…');
    const supabase = createClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${ownerId}/${room.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from('room-assets').upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      setPhotoStatus(uploadError.message);
      setPhotoBusy(false);
      return;
    }

    const { data: asset, error: metadataError } = await supabase
      .from('room_assets')
      .insert({
        room_id: room.id,
        owner_id: ownerId,
        object_path: path,
        mime_type: file.type || 'application/octet-stream',
        byte_length: file.size,
        capture_context: {
          platform: navigator.platform || 'web',
          captureMethod: 'guided_web_photo',
          userAgent: navigator.userAgent,
        },
      })
      .select('id')
      .single();

    if (metadataError || !asset) {
      await supabase.storage.from('room-assets').remove([path]);
      setPhotoStatus(metadataError?.message || 'Unable to save the room photo.');
      setPhotoBusy(false);
      return;
    }

    setView('photo');
    setPhotoStatus('Room photo saved. This is now the primary visual workspace.');
    await refreshPhotos(asset.id);
    setPhotoBusy(false);
  }

  async function generatePhotoProposal() {
    if (!sourcePhoto) {
      setPhotoStatus('Add a room photo first.');
      return;
    }
    setPhotoBusy(true);
    setPhotoStatus('Creating a realistic visual proposal from your room photo…');
    try {
      const response = await fetch('/api/ai/photo-proposal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roomId: room.id, mode, goal }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Visual proposal failed.');
      await refreshPhotos(json.asset?.id);
      setPhotoStatus('Visual proposal ready. The original photo and Room Model remain unchanged.');
    } catch (error) {
      setPhotoStatus(error instanceof Error ? error.message : 'Unable to create a visual proposal.');
    } finally {
      setPhotoBusy(false);
    }
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

  async function proposeGeometry() {
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
      setStatus('Geometry proposal ready.');
    } catch (err) {
      setProposal(deterministicProposal(room, mode));
      setStatus(`${err instanceof Error ? err.message : 'AI unavailable'} Deterministic fallback shown.`);
    }
  }

  async function acceptGeometry() {
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
    setStatus('Geometry proposal applied to the Room Model.');
  }

  function selectObject(id: string) {
    setSelected(id);
    setStatus('');
  }

  const scaleX = (v: number) => `${(v / room.boundary.widthUm) * 100}%`;
  const scaleY = (v: number) => `${(v / room.boundary.depthUm) * 100}%`;
  const dragging = dragFeedback?.objectId;

  return (
    <main className="studio-page photo-first-studio">
      <div className="studio-top">
        <div className="studio-title">
          <p className="eyebrow">PHOTO AUGMENTATION</p>
          <h1>{room.name}</h1>
          <p>
            Start with the real room · use geometry only when precision matters
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
                setPhotoStatus('');
              }}
            >
              {modeLabel[x]}
            </button>
          ))}
        </div>
      </div>

      <div className="studio-grid photo-studio-grid">
        <aside className="panel tool-panel">
          <div className="mode-copy">
            <span>{modeLabel[mode]}</span>
            {copy[mode]}
          </div>

          <div className="panel-heading">
            <h2>Room elements</h2>
            <span>{room.objects.length}</span>
          </div>
          <div className="tool-list object-list">
            {room.objects.map((o) => (
              <button key={o.id} className={selected === o.id ? 'active' : ''} onClick={() => selectObject(o.id)}>
                <span>{o.label}</span>
                <small>{o.fixed ? 'Fixed' : 'Known'}</small>
              </button>
            ))}
          </div>

          <div className="utility-stack">
            <details className="utility-section">
              <summary>
                <span>Verified measurements</span>
                <small>{room.measurements.length ? `${room.measurements.length} saved` : 'Optional until precision is needed'}</small>
              </summary>
              <MeasurementPanel ownerId={ownerId} roomId={room.id} measurements={room.measurements} onChanged={refreshRoom} />
            </details>
          </div>
        </aside>

        <section className="panel canvas-panel photo-canvas-panel">
          <div className="workspace-toolbar">
            <div className="view-switch" aria-label="Workspace view">
              <button className={view === 'photo' ? 'active' : ''} onClick={() => setView('photo')}>Photo</button>
              <button className={view === 'plan' ? 'active' : ''} onClick={() => setView('plan')}>Geometry</button>
            </div>
            <div className="workspace-toolbar-note">
              {view === 'photo' ? 'Primary workspace · visual proposals' : 'Secondary precision view · measured Room Model'}
            </div>
          </div>

          {view === 'photo' ? (
            <div className="photo-stage">
              {!sourcePhoto ? (
                <div className="photo-empty-state">
                  <div className="photo-empty-mark" aria-hidden="true">▣</div>
                  <p className="eyebrow">START WITH REALITY</p>
                  <h2>Add a photo of this room</h2>
                  <p>That photo becomes the main NestMetric workspace. The Room Model stays underneath it for dimensions, constraints, and Build verification.</p>
                  <label className={`button primary photo-upload-button${photoBusy ? ' disabled' : ''}`}>
                    {photoBusy ? 'Saving photo…' : 'Take or choose room photo'}
                    <input type="file" accept="image/*" capture="environment" onChange={uploadPhoto} disabled={photoBusy} />
                  </label>
                  <small>Private by default · stored in your room workspace · 15 MB maximum</small>
                  {photoStatus && <div className="status-card workspace-status">{photoStatus}</div>}
                </div>
              ) : (
                <div className="photo-workspace">
                  <div className="photo-frame">
                    {activePhoto?.signedUrl ? (
                      <img src={activePhoto.signedUrl} alt={isPhotoProposal(activePhoto) ? `${modeLabel[activePhoto.capture_context?.mode ?? mode]} visual proposal` : 'Original room photo'} />
                    ) : (
                      <div className="photo-loading">Loading private room photo…</div>
                    )}
                    <div className={`photo-badge${activePhoto && isPhotoProposal(activePhoto) ? ' proposal' : ''}`}>
                      {activePhoto && isPhotoProposal(activePhoto) ? 'Visual proposal' : 'Original room'}
                    </div>
                    {activePhoto && isPhotoProposal(activePhoto) && (
                      <div className="concept-disclaimer">Visual concept · measured geometry remains authoritative</div>
                    )}
                  </div>

                  <div className="photo-strip">
                    <button className={`photo-thumb${activePhoto?.id === sourcePhoto.id ? ' active' : ''}`} onClick={() => setActivePhotoId(sourcePhoto.id)}>
                      <span className="thumb-preview">
                        {sourcePhoto.signedUrl && <img src={sourcePhoto.signedUrl} alt="" />}
                      </span>
                      <span><b>Original</b><small>{friendlyDate(sourcePhoto.created_at)}</small></span>
                    </button>
                    {visualProposals.map((asset, index) => (
                      <button key={asset.id} className={`photo-thumb${activePhoto?.id === asset.id ? ' active' : ''}`} onClick={() => setActivePhotoId(asset.id)}>
                        <span className="thumb-preview">{asset.signedUrl && <img src={asset.signedUrl} alt="" />}</span>
                        <span><b>{modeLabel[asset.capture_context?.mode ?? 'organize']} {visualProposals.length - index}</b><small>{friendlyDate(asset.created_at)}</small></span>
                      </button>
                    ))}
                    <label className="photo-thumb add-photo-thumb">
                      <span className="thumb-add">+</span>
                      <span><b>New photo</b><small>Replace the viewpoint</small></span>
                      <input type="file" accept="image/*" capture="environment" onChange={uploadPhoto} disabled={photoBusy} />
                    </label>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="geometry-workspace">
              <div className="canvas-toolbar">
                <div>
                  <strong>Room geometry</strong>
                  <span>{Math.round(room.boundary.widthUm / 1000)} × {Math.round(room.boundary.depthUm / 1000)} mm</span>
                </div>
                <div className="canvas-toolbar-meta">
                  <span>50 mm snap on release</span>
                  <span>Fixed constraints protected</span>
                </div>
              </div>

              <div className="room-stage">
                <div className="room-canvas" ref={canvas} style={{ aspectRatio: `${room.boundary.widthUm} / ${room.boundary.depthUm}` }}>
                  {room.openings.map((o) => (
                    <div
                      key={o.id}
                      className="opening-marker"
                      title={`${o.kind} opening`}
                      style={
                        o.wall === 'south' || o.wall === 'north'
                          ? { left: scaleX(o.offsetUm), width: scaleX(o.widthUm), height: 6, [o.wall === 'north' ? 'top' : 'bottom']: 0 }
                          : { top: scaleY(o.offsetUm), height: scaleY(o.widthUm), width: 6, [o.wall === 'west' ? 'left' : 'right']: 0 }
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
                      {dragFeedback.conflict ?? 'Release to snap this position to the 50 mm grid'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="panel inspector">
          <div className="inspector-heading">
            <span className="inspector-mode">{modeLabel[mode]} · {view === 'photo' ? 'Photo' : 'Geometry'}</span>
            <h2>{view === 'photo' ? 'Visual direction' : selectedObject?.label ?? 'Room geometry'}</h2>
            <p>{view === 'photo' ? 'Describe the outcome. NestMetric keeps the room itself recognizable.' : selectedObject?.fixed ? 'Fixed room element' : 'Measured object position'}</p>
          </div>

          {view === 'photo' ? (
            <>
              <div className="proposal-controls photo-proposal-controls">
                <label>
                  What should improve?
                  <textarea value={goal} onChange={(event) => setGoal(event.target.value)} rows={5} placeholder="Describe how you want the room to work or look." />
                </label>
                <button className="button primary" onClick={generatePhotoProposal} disabled={photoBusy || !sourcePhoto}>
                  {photoBusy ? 'Working…' : `Generate ${modeLabel[mode].toLowerCase()} visual`}
                </button>
                <p className="concept-note">Visual proposals edit the room photo. They do not change saved measurements, object coordinates, or build-readiness evidence.</p>
              </div>

              {photoStatus && <div className="status-card workspace-status">{photoStatus}</div>}

              <div className="inspector-section geometry-summary">
                <div className="section-kicker">Geometry underneath</div>
                <div className="object-metrics">
                  <div><span>Room</span><strong>{Math.round(room.boundary.widthUm / 1000)} × {Math.round(room.boundary.depthUm / 1000)} mm</strong></div>
                  <div><span>Known elements</span><strong>{room.objects.length}</strong></div>
                  <div><span>Verified measurements</span><strong>{room.measurements.length}</strong></div>
                </div>
                <button className="small-button" onClick={() => setView('plan')}>Open Geometry view</button>
              </div>
            </>
          ) : (
            <>
              {selectedObject && (
                <div className="object-metrics">
                  <div><span>Position</span><strong>{Math.round(selectedObject.position.xUm / 1000)}, {Math.round(selectedObject.position.yUm / 1000)} mm</strong></div>
                  <div><span>Size</span><strong>{Math.round(selectedObject.size.widthUm / 1000)} × {Math.round(selectedObject.size.depthUm / 1000)} mm</strong></div>
                  <div><span>Behavior</span><strong>{selectedObject.fixed ? 'Fixed' : 'Movable'}</strong></div>
                </div>
              )}

              <div className="proposal-controls">
                <label>
                  Geometry goal
                  <textarea value={goal} onChange={(event) => setGoal(event.target.value)} rows={4} />
                </label>
                <button className="button secondary" onClick={proposeGeometry}>Generate geometry proposal</button>
              </div>

              {proposal && (
                <div className="proposal-card">
                  <h3>{proposal.title}</h3>
                  <p>{proposal.summary}</p>
                  <ul>{proposal.rationale.map((item) => <li key={item}>{item}</li>)}</ul>
                  {proposal.conflicts.length > 0 && <p><b>Conflicts:</b> {proposal.conflicts.join(' ')}</p>}
                  <button className="small-button dangerless" onClick={acceptGeometry} disabled={proposal.conflicts.length > 0}>Apply to Room Model</button>
                </div>
              )}

              {status && <div className="status-card workspace-status">{status}</div>}
            </>
          )}

          {mode === 'build' && (
            <div className={`status-card ${gate.allowed ? 'success' : 'warning'}`}>
              <b>{gate.allowed ? 'Build evidence ready' : 'Build evidence locked'}</b><br />
              {gate.allowed ? 'Required dimensions are verified.' : `Still needed: ${[...gate.missing, ...gate.unverified].join(', ') || 'measurement verification'}`}
            </div>
          )}

          {!demo && <form action="/auth/signout" method="post" className="signout-form"><button className="small-button" type="submit">Sign out</button></form>}
        </aside>
      </div>
    </main>
  );
}
