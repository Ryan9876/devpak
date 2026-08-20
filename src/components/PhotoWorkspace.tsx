'use client';

import { PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { evaluatePlacement, resolveDrop } from '@/lib/photo/placement';
import {
  DOUBLE_TAP_PHOTO_SCALE,
  clampPhotoViewport,
  screenToPhotoNormalized,
  zoomPhotoViewportAround,
  type PhotoViewport,
} from '@/lib/photo/viewport';
import type { NormalizedBox, PhotoScene, PhotoSceneItem, PlacementPreview } from '@/lib/photo/types';

type Props = {
  backgroundImageUrl: string;
  sourceImageUrl: string;
  objectImageUrls?: Record<string, string | null | undefined>;
  scene: PhotoScene;
  refined?: boolean;
  disabled?: boolean;
  onSceneChanged: (scene: PhotoScene) => Promise<void> | void;
  onStatus?: (message: string) => void;
};

type ScreenPoint = { x: number; y: number };

type DragSession = {
  itemId: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  original: PhotoSceneItem;
  latestBox: NormalizedBox;
  moved: boolean;
};

type GestureSession =
  | { kind: 'idle'; pointerId: number; start: ScreenPoint; moved: boolean }
  | { kind: 'object'; pointerId: number }
  | { kind: 'pan'; pointerId: number; start: ScreenPoint; startViewport: PhotoViewport; moved: boolean }
  | {
      kind: 'pinch';
      pointerIds: [number, number];
      startDistance: number;
      startScale: number;
      imageAnchorX: number;
      imageAnchorY: number;
    };

function clampBox(box: NormalizedBox): NormalizedBox {
  return {
    ...box,
    x: Math.max(0, Math.min(1 - box.w, box.x)),
    y: Math.max(0, Math.min(1 - box.h, box.y)),
  };
}

function movedFromSource(item: PhotoSceneItem) {
  const source = item.sourceBbox;
  if (!source) return false;
  return Math.abs(source.x - item.bbox.x) > 0.004 || Math.abs(source.y - item.bbox.y) > 0.004 || Math.abs(source.w - item.bbox.w) > 0.004;
}

function boxStyle(box: NormalizedBox) {
  return {
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.w * 100}%`,
    height: `${box.h * 100}%`,
  };
}

function polygonClip(points: Array<{ x: number; y: number }>) {
  return `polygon(${points.map((point) => `${point.x * 100}% ${point.y * 100}%`).join(',')})`;
}

function shadowStyle(item: PhotoSceneItem, surfaceKind?: string) {
  const anchorX = item.bbox.x + item.bbox.w / 2;
  const anchorY = item.bbox.y + item.bbox.h;
  const depthScale = surfaceKind === 'floor' ? 1.3 : surfaceKind === 'bed' ? 1.05 : 0.82;
  const width = Math.max(0.035, item.footprint.width * depthScale);
  const height = Math.max(0.009, item.footprint.height * 0.58 * depthScale);
  return {
    left: `${(anchorX - width / 2) * 100}%`,
    top: `${(anchorY - height * 0.42) * 100}%`,
    width: `${width * 100}%`,
    height: `${height * 100}%`,
  };
}

function distance(a: ScreenPoint, b: ScreenPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: ScreenPoint, b: ScreenPoint): ScreenPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export default function PhotoWorkspace({
  backgroundImageUrl,
  sourceImageUrl,
  objectImageUrls = {},
  scene,
  refined = false,
  disabled = false,
  onSceneChanged,
  onStatus,
}: Props) {
  const [localScene, setLocalScene] = useState(scene);
  const [selectedId, setSelectedId] = useState(scene.items.find((item) => item.draggable)?.id ?? '');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [droppingId, setDroppingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PlacementPreview | null>(null);
  const [viewport, setViewport] = useState<PhotoViewport>({ scale: 1, tx: 0, ty: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragSession | null>(null);
  const sceneRef = useRef(scene);
  const viewportRef = useRef(viewport);
  const activePointersRef = useRef(new Map<number, ScreenPoint>());
  const gestureRef = useRef<GestureSession | null>(null);
  const lastTapRef = useRef<{ at: number; point: ScreenPoint } | null>(null);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    if (dragRef.current) return;
    sceneRef.current = scene;
    setLocalScene(scene);
    if (!scene.items.some((item) => item.id === selectedId)) {
      setSelectedId(scene.items.find((item) => item.draggable)?.id ?? '');
    }
  }, [scene, selectedId]);

  const movable = useMemo(() => localScene.items.filter((item) => item.draggable && !item.fixed), [localScene]);
  const selected = localScene.items.find((item) => item.id === selectedId) ?? movable[0] ?? null;
  const hiddenSurfaceIds = new Set(movable.map((item) => item.supportSurfaceId).filter((value): value is string => Boolean(value)));

  function replaceItem(itemId: string, updater: (item: PhotoSceneItem) => PhotoSceneItem) {
    const next: PhotoScene = {
      ...sceneRef.current,
      items: sceneRef.current.items.map((item) => (item.id === itemId ? updater(item) : item)),
    };
    sceneRef.current = next;
    setLocalScene(next);
    return next;
  }

  function canvasRect() {
    return canvasRef.current?.getBoundingClientRect() ?? null;
  }

  function normalizedClient(clientX: number, clientY: number) {
    const rect = canvasRect();
    if (!rect) return null;
    return screenToPhotoNormalized(
      viewportRef.current,
      rect.width,
      rect.height,
      clientX - rect.left,
      clientY - rect.top,
    );
  }

  function updateViewport(next: PhotoViewport) {
    const rect = canvasRect();
    if (!rect) return;
    const clamped = clampPhotoViewport(next, rect.width, rect.height);
    viewportRef.current = clamped;
    setViewport(clamped);
  }

  function resetViewport() {
    viewportRef.current = { scale: 1, tx: 0, ty: 0 };
    setViewport({ scale: 1, tx: 0, ty: 0 });
    onStatus?.('Photo reset to 1×.');
  }

  function beginObjectDrag(pointerId: number, point: ScreenPoint, item: PhotoSceneItem) {
    if (disabled || item.fixed || !item.draggable) return false;
    const pointer = normalizedClient(point.x, point.y);
    if (!pointer) return false;
    setSelectedId(item.id);
    setDraggingId(item.id);
    setDroppingId(null);
    onStatus?.(`Moving ${item.label} · keep its base on a surface or gravity will take over.`);
    dragRef.current = {
      itemId: item.id,
      pointerId,
      offsetX: pointer.x - item.bbox.x,
      offsetY: pointer.y - item.bbox.y,
      original: { ...item, bbox: { ...item.bbox } },
      latestBox: { ...item.bbox },
      moved: false,
    };
    gestureRef.current = { kind: 'object', pointerId };
    return true;
  }

  function moveObject(point: ScreenPoint) {
    const drag = dragRef.current;
    if (!drag || disabled) return;
    const pointer = normalizedClient(point.x, point.y);
    if (!pointer) return;
    const current = sceneRef.current.items.find((item) => item.id === drag.itemId);
    if (!current) return;
    const desired = clampBox({
      ...current.bbox,
      x: pointer.x - drag.offsetX,
      y: pointer.y - drag.offsetY,
    });
    if (Math.abs(desired.x - drag.original.bbox.x) > 0.0015 || Math.abs(desired.y - drag.original.bbox.y) > 0.0015) {
      drag.moved = true;
    }
    drag.latestBox = desired;
    const nextPreview = evaluatePlacement(sceneRef.current, current, desired);
    setPreview(nextPreview);
    onStatus?.(nextPreview.message);
    replaceItem(current.id, (item) => ({ ...item, bbox: desired }));
  }

  async function finishObjectDrag() {
    const drag = dragRef.current;
    if (!drag) return;
    const current = sceneRef.current.items.find((item) => item.id === drag.itemId);
    if (!current) {
      dragRef.current = null;
      setDraggingId(null);
      setPreview(null);
      return;
    }
    if (!drag.moved) {
      dragRef.current = null;
      setDraggingId(null);
      setPreview(null);
      return;
    }

    const resolution = resolveDrop(sceneRef.current, current, drag.latestBox);
    const finalItem: PhotoSceneItem =
      resolution.kind === 'rejected'
        ? drag.original
        : { ...current, bbox: resolution.bbox, supportSurfaceId: resolution.surfaceId };

    const next = replaceItem(current.id, () => finalItem);
    if (resolution.kind === 'dropped') {
      setDroppingId(current.id);
      window.setTimeout(() => setDroppingId(null), 360);
    }
    dragRef.current = null;
    setDraggingId(null);
    setPreview(null);
    onStatus?.(resolution.message);
    if (resolution.kind !== 'rejected') await onSceneChanged(next);
  }

  function cancelObjectDrag(message?: string) {
    const drag = dragRef.current;
    if (!drag) return;
    replaceItem(drag.itemId, () => drag.original);
    dragRef.current = null;
    setDraggingId(null);
    setPreview(null);
    if (message) onStatus?.(message);
  }

  function beginPinch() {
    const entries = Array.from(activePointersRef.current.entries()).slice(0, 2);
    if (entries.length < 2) return;
    cancelObjectDrag();
    const rect = canvasRect();
    if (!rect) return;
    const [[idA, a], [idB, b]] = entries;
    const mid = midpoint(a, b);
    const localMidX = mid.x - rect.left;
    const localMidY = mid.y - rect.top;
    const current = viewportRef.current;
    gestureRef.current = {
      kind: 'pinch',
      pointerIds: [idA, idB],
      startDistance: Math.max(1, distance(a, b)),
      startScale: current.scale,
      imageAnchorX: (localMidX - current.tx) / current.scale,
      imageAnchorY: (localMidY - current.ty) / current.scale,
    };
    onStatus?.('Pinch to zoom · move two fingers to reposition the photo.');
  }

  function updatePinch(gesture: Extract<GestureSession, { kind: 'pinch' }>) {
    const a = activePointersRef.current.get(gesture.pointerIds[0]);
    const b = activePointersRef.current.get(gesture.pointerIds[1]);
    const rect = canvasRect();
    if (!a || !b || !rect) return;
    const mid = midpoint(a, b);
    const nextScale = gesture.startScale * (distance(a, b) / gesture.startDistance);
    const localMidX = mid.x - rect.left;
    const localMidY = mid.y - rect.top;
    updateViewport({
      scale: nextScale,
      tx: localMidX - gesture.imageAnchorX * nextScale,
      ty: localMidY - gesture.imageAnchorY * nextScale,
    });
  }

  function processEmptyTap(point: ScreenPoint) {
    const now = performance.now();
    const previous = lastTapRef.current;
    if (previous && now - previous.at < 330 && distance(previous.point, point) < 34) {
      const rect = canvasRect();
      if (!rect) return;
      const current = viewportRef.current;
      const nextScale = current.scale > 1.05 ? 1 : DOUBLE_TAP_PHOTO_SCALE;
      const next = zoomPhotoViewportAround(
        current,
        nextScale,
        rect.width,
        rect.height,
        point.x - rect.left,
        point.y - rect.top,
      );
      viewportRef.current = next;
      setViewport(next);
      lastTapRef.current = null;
      onStatus?.(next.scale > 1 ? `${next.scale.toFixed(1)}× zoom · drag empty space to pan.` : 'Photo reset to 1×.');
      return;
    }
    lastTapRef.current = { at: now, point };
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const point = { x: event.clientX, y: event.clientY };
    activePointersRef.current.set(event.pointerId, point);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Pointer capture is best effort on mobile Safari. */ }

    if (activePointersRef.current.size >= 2) {
      beginPinch();
      return;
    }

    const target = event.target as HTMLElement;
    const itemElement = target.closest<HTMLElement>('[data-photo-item-id]');
    const itemId = itemElement?.dataset.photoItemId;
    const item = itemId ? sceneRef.current.items.find((candidate) => candidate.id === itemId) : null;
    if (item && beginObjectDrag(event.pointerId, point, item)) return;

    if (viewportRef.current.scale > 1.001) {
      gestureRef.current = {
        kind: 'pan',
        pointerId: event.pointerId,
        start: point,
        startViewport: { ...viewportRef.current },
        moved: false,
      };
      return;
    }

    gestureRef.current = { kind: 'idle', pointerId: event.pointerId, start: point, moved: false };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!activePointersRef.current.has(event.pointerId)) return;
    event.preventDefault();
    const point = { x: event.clientX, y: event.clientY };
    activePointersRef.current.set(event.pointerId, point);
    const gesture = gestureRef.current;
    if (!gesture) return;

    if (gesture.kind === 'pinch') {
      updatePinch(gesture);
      return;
    }
    if (gesture.kind === 'object' && gesture.pointerId === event.pointerId) {
      moveObject(point);
      return;
    }
    if (gesture.kind === 'pan' && gesture.pointerId === event.pointerId) {
      const dx = point.x - gesture.start.x;
      const dy = point.y - gesture.start.y;
      if (Math.hypot(dx, dy) > 5) gesture.moved = true;
      const rect = canvasRect();
      if (!rect) return;
      updateViewport({
        ...gesture.startViewport,
        tx: gesture.startViewport.tx + dx,
        ty: gesture.startViewport.ty + dy,
      });
      return;
    }
    if (gesture.kind === 'idle' && gesture.pointerId === event.pointerId) {
      if (distance(gesture.start, point) > 8) gesture.moved = true;
    }
  }

  function transitionAfterPinch() {
    const remaining = Array.from(activePointersRef.current.entries());
    if (remaining.length === 1 && viewportRef.current.scale > 1.001) {
      const [pointerId, point] = remaining[0];
      gestureRef.current = {
        kind: 'pan',
        pointerId,
        start: point,
        startViewport: { ...viewportRef.current },
        moved: false,
      };
    } else if (!remaining.length) {
      gestureRef.current = null;
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const point = { x: event.clientX, y: event.clientY };
    const gesture = gestureRef.current;

    if (gesture?.kind === 'object' && gesture.pointerId === event.pointerId) {
      moveObject(point);
      activePointersRef.current.delete(event.pointerId);
      gestureRef.current = null;
      void finishObjectDrag();
      return;
    }

    activePointersRef.current.delete(event.pointerId);
    if (gesture?.kind === 'pinch') {
      transitionAfterPinch();
      return;
    }

    if (gesture?.kind === 'pan' && gesture.pointerId === event.pointerId) {
      if (!gesture.moved) processEmptyTap(point);
      gestureRef.current = null;
      return;
    }
    if (gesture?.kind === 'idle' && gesture.pointerId === event.pointerId) {
      if (!gesture.moved) processEmptyTap(point);
      gestureRef.current = null;
    }
  }

  function handlePointerCancel(event: PointerEvent<HTMLDivElement>) {
    activePointersRef.current.delete(event.pointerId);
    if (dragRef.current?.pointerId === event.pointerId) cancelObjectDrag('Move cancelled.');
    if (gestureRef.current?.kind === 'pinch') transitionAfterPinch();
    else gestureRef.current = null;
  }

  const viewportTransform = `translate3d(${viewport.tx}px, ${viewport.ty}px, 0) scale(${viewport.scale})`;

  return (
    <div className={`photo-interaction-stage${refined ? ' refined' : ' fallback'}`}>
      <div className="photo-interaction-canvas-wrap">
        <div
          ref={canvasRef}
          className={`photo-interaction-canvas${draggingId ? ' is-dragging' : ''}${viewport.scale > 1.001 ? ' is-zoomed' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onContextMenu={(event) => event.preventDefault()}
        >
          <img className="photo-interaction-sizer" src={backgroundImageUrl} alt="" draggable={false} aria-hidden="true" />
          <div className="photo-viewport-layer" style={{ transform: viewportTransform }}>
            <img className="photo-interaction-base" src={backgroundImageUrl} alt="Room photo" draggable={false} />

            {draggingId && localScene.surfaces.map((surface) => (
              <div
                key={surface.id}
                className={`photo-support-surface${preview?.surfaceId === surface.id ? ' target' : ''}`}
                style={{ clipPath: polygonClip(surface.polygon) }}
                aria-hidden="true"
              />
            ))}

            {localScene.items.filter((item) => item.fixed).map((item) => (
              <div key={item.id} className={`photo-blocker-zone${draggingId ? ' visible' : ''}`} style={boxStyle(item.bbox)} aria-hidden="true" />
            ))}

            {movable.map((item) => {
              const source = item.sourceBbox ?? item.bbox;
              const cutoutUrl = objectImageUrls[item.id];
              const showHole = !refined && Boolean(item.sourceBbox && (movedFromSource(item) || draggingId === item.id));
              const support = localScene.surfaces.find((surface) => surface.id === item.supportSurfaceId);
              return (
                <div key={item.id}>
                  {showHole && item.sourceBbox && <div className="photo-source-hole" style={boxStyle(item.sourceBbox)} aria-hidden="true" />}
                  <div className={`photo-contact-shadow shadow-${support?.kind ?? 'unknown'}`} style={shadowStyle(item, support?.kind)} aria-hidden="true" />
                  <button
                    type="button"
                    aria-label={`Move ${item.label}`}
                    data-photo-item-id={item.id}
                    className={`photo-scene-item${selectedId === item.id ? ' selected' : ''}${draggingId === item.id ? ' dragging' : ''}${droppingId === item.id ? ' dropping' : ''}`}
                    style={boxStyle(item.bbox)}
                    onContextMenu={(event) => event.preventDefault()}
                  >
                    {refined && cutoutUrl ? (
                      <span className="photo-object-cutout" aria-hidden="true">
                        <img src={cutoutUrl} alt="" draggable={false} />
                      </span>
                    ) : (
                      <span className="photo-object-crop" aria-hidden="true">
                        <img
                          src={sourceImageUrl}
                          alt=""
                          draggable={false}
                          style={{
                            width: `${100 / source.w}%`,
                            height: `${100 / source.h}%`,
                            left: `${-(source.x / source.w) * 100}%`,
                            top: `${-(source.y / source.h) * 100}%`,
                          }}
                        />
                      </span>
                    )}
                  </button>
                </div>
              );
            })}

            {refined && (localScene.occluders ?? [])
              .filter((occluder) => occluder.hidesSurfaceIds.some((surfaceId) => hiddenSurfaceIds.has(surfaceId)))
              .map((occluder) => (
                <div key={occluder.id} className="photo-occluder-layer" style={{ clipPath: polygonClip(occluder.polygon) }} aria-hidden="true">
                  <img src={backgroundImageUrl} alt="" draggable={false} />
                </div>
              ))}
          </div>

          {preview && draggingId && (
            <div className={`photo-physics-hud ${preview.state}`}>
              {preview.state === 'falling' ? '↓ ' : ''}{preview.message}
            </div>
          )}

          {viewport.scale > 1.001 && (
            <button type="button" className="photo-viewport-reset" onClick={(event) => { event.stopPropagation(); resetViewport(); }}>
              {viewport.scale.toFixed(1)}× · Reset
            </button>
          )}
        </div>
      </div>

      <div className="photo-interaction-footer">
        <span>
          <b>{refined ? 'Refined manipulation' : 'Direct manipulation'}</b>
          {viewport.scale > 1.001 ? ' · drag empty space to pan · pinch to zoom' : ' · pinch to zoom · touch the plant to move'}
        </span>
        <span>{selected?.supportSurfaceId ? `Supported by ${localScene.surfaces.find((surface) => surface.id === selected.supportSurfaceId)?.label ?? selected.supportSurfaceId}` : 'Unsupported'}</span>
      </div>
    </div>
  );
}
