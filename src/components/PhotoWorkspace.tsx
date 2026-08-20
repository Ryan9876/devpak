'use client';

import { CSSProperties, PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { boxFromPointerDelta, type NormalizedPhotoPoint } from '@/lib/photo/interaction';
import { evaluatePlacement, resolveDrop } from '@/lib/photo/placement';
import {
  DOUBLE_TAP_PHOTO_SCALE,
  MAX_PHOTO_SCALE,
  MIN_PHOTO_SCALE,
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
  startPointer: NormalizedPhotoPoint;
  original: PhotoSceneItem;
  latestBox: NormalizedBox;
  moved: boolean;
};

type GestureSession =
  | { kind: 'idle'; pointerId: number; start: ScreenPoint; moved: boolean }
  | { kind: 'pan'; pointerId: number; start: ScreenPoint; startViewport: PhotoViewport; moved: boolean }
  | {
      kind: 'pinch';
      pointerIds: [number, number];
      startDistance: number;
      startScale: number;
      imageAnchorX: number;
      imageAnchorY: number;
    };

type NativePinchSession = {
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

function boxStyle(box: NormalizedBox): CSSProperties {
  return {
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.w * 100}%`,
    height: `${box.h * 100}%`,
  };
}

function responderStyle(box: NormalizedBox, viewportScale: number): CSSProperties {
  const minCssPx = 44 / Math.max(1, viewportScale);
  return {
    position: 'absolute',
    left: `${(box.x + box.w / 2) * 100}%`,
    top: `${(box.y + box.h / 2) * 100}%`,
    width: `max(${box.w * 100}%, ${minCssPx}px)`,
    height: `max(${box.h * 100}%, ${minCssPx}px)`,
    transform: 'translate(-50%, -50%)',
    zIndex: 16,
    padding: 0,
    border: 0,
    borderRadius: 12,
    background: 'transparent',
    cursor: 'grab',
    touchAction: 'none',
    WebkitTouchCallout: 'none',
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

function touchPoint(touch: Touch): ScreenPoint {
  return { x: touch.clientX, y: touch.clientY };
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
  const nativePinchRef = useRef<NativePinchSession | null>(null);
  const nativePinchActiveRef = useRef(false);

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

  function zoomAroundCenter(nextScale: number) {
    const rect = canvasRect();
    if (!rect) return;
    const next = zoomPhotoViewportAround(
      viewportRef.current,
      nextScale,
      rect.width,
      rect.height,
      rect.width / 2,
      rect.height / 2,
    );
    viewportRef.current = next;
    setViewport(next);
    onStatus?.(next.scale > 1 ? `${next.scale.toFixed(1)}× zoom · drag empty space to pan.` : 'Photo reset to 1×.');
  }

  function resetViewport() {
    viewportRef.current = { scale: 1, tx: 0, ty: 0 };
    setViewport({ scale: 1, tx: 0, ty: 0 });
    onStatus?.('Photo reset to 1×.');
  }

  function beginObjectDrag(pointerId: number, point: ScreenPoint, item: PhotoSceneItem) {
    if (disabled || item.fixed || !item.draggable || nativePinchActiveRef.current) return false;
    const pointer = normalizedClient(point.x, point.y);
    if (!pointer) return false;
    setSelectedId(item.id);
    setDraggingId(item.id);
    setDroppingId(null);
    onStatus?.(`Moving ${item.label} · keep its base on a surface or gravity will take over.`);
    dragRef.current = {
      itemId: item.id,
      pointerId,
      startPointer: pointer,
      original: { ...item, bbox: { ...item.bbox } },
      latestBox: { ...item.bbox },
      moved: false,
    };
    return true;
  }

  function moveObject(point: ScreenPoint) {
    const drag = dragRef.current;
    if (!drag || disabled || nativePinchActiveRef.current) return;
    const pointer = normalizedClient(point.x, point.y);
    if (!pointer) return;
    const current = sceneRef.current.items.find((item) => item.id === drag.itemId);
    if (!current) return;
    const desired = clampBox(boxFromPointerDelta(drag.original.bbox, drag.startPointer, pointer));
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

  function handleObjectPointerDown(event: PointerEvent<HTMLButtonElement>, item: PhotoSceneItem) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const point = { x: event.clientX, y: event.clientY };
    if (!beginObjectDrag(event.pointerId, point, item)) return;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Best effort on mobile Safari. */ }
  }

  function handleObjectPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (dragRef.current?.pointerId !== event.pointerId || nativePinchActiveRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    moveObject({ x: event.clientX, y: event.clientY });
  }

  function handleObjectPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    moveObject({ x: event.clientX, y: event.clientY });
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* Best effort. */ }
    void finishObjectDrag();
  }

  function handleObjectPointerCancel(event: PointerEvent<HTMLButtonElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    cancelObjectDrag('Move cancelled.');
  }

  function beginPointerPinch() {
    if (nativePinchActiveRef.current || dragRef.current) return;
    const entries = Array.from(activePointersRef.current.entries()).slice(0, 2);
    if (entries.length < 2) return;
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

  function updatePointerPinch(gesture: Extract<GestureSession, { kind: 'pinch' }>) {
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

  useEffect(() => {
    const canvasNode = canvasRef.current;
    if (!canvasNode) return;
    const canvas: HTMLDivElement = canvasNode;

    function beginNativePinch(event: TouchEvent) {
      if (event.touches.length < 2) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const a = touchPoint(event.touches[0]);
      const b = touchPoint(event.touches[1]);
      const mid = midpoint(a, b);
      const current = viewportRef.current;
      nativePinchActiveRef.current = true;
      activePointersRef.current.clear();
      gestureRef.current = null;
      cancelObjectDrag();
      nativePinchRef.current = {
        startDistance: Math.max(1, distance(a, b)),
        startScale: current.scale,
        imageAnchorX: (mid.x - rect.left - current.tx) / current.scale,
        imageAnchorY: (mid.y - rect.top - current.ty) / current.scale,
      };
      onStatus?.('Pinch to zoom · lift both fingers when finished.');
    }

    function moveNativePinch(event: TouchEvent) {
      const pinch = nativePinchRef.current;
      if (!pinch || event.touches.length < 2) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const a = touchPoint(event.touches[0]);
      const b = touchPoint(event.touches[1]);
      const mid = midpoint(a, b);
      const nextScale = pinch.startScale * (distance(a, b) / pinch.startDistance);
      const next = clampPhotoViewport({
        scale: nextScale,
        tx: mid.x - rect.left - pinch.imageAnchorX * nextScale,
        ty: mid.y - rect.top - pinch.imageAnchorY * nextScale,
      }, rect.width, rect.height);
      viewportRef.current = next;
      setViewport(next);
    }

    function endNativePinch(event: TouchEvent) {
      if (!nativePinchRef.current) return;
      if (event.touches.length >= 2) return;
      if (event.cancelable) event.preventDefault();
      nativePinchRef.current = null;
      nativePinchActiveRef.current = false;
      activePointersRef.current.clear();
      gestureRef.current = null;
      const current = viewportRef.current;
      onStatus?.(current.scale > 1.001
        ? `${current.scale.toFixed(1)}× zoom · drag empty space to pan or touch an object to move it.`
        : 'Photo reset to 1×.');
    }

    canvas.addEventListener('touchstart', beginNativePinch, { passive: false });
    canvas.addEventListener('touchmove', moveNativePinch, { passive: false });
    canvas.addEventListener('touchend', endNativePinch, { passive: false });
    canvas.addEventListener('touchcancel', endNativePinch, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', beginNativePinch);
      canvas.removeEventListener('touchmove', moveNativePinch);
      canvas.removeEventListener('touchend', endNativePinch);
      canvas.removeEventListener('touchcancel', endNativePinch);
    };
  }, []);

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

  function handleCanvasPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (nativePinchActiveRef.current || dragRef.current) {
      event.preventDefault();
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest('[data-photo-viewport-control]')) return;
    event.preventDefault();
    const point = { x: event.clientX, y: event.clientY };
    activePointersRef.current.set(event.pointerId, point);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Best effort on mobile Safari. */ }

    if (activePointersRef.current.size >= 2) {
      beginPointerPinch();
      return;
    }

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

  function handleCanvasPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (nativePinchActiveRef.current || !activePointersRef.current.has(event.pointerId)) return;
    event.preventDefault();
    const point = { x: event.clientX, y: event.clientY };
    activePointersRef.current.set(event.pointerId, point);
    const gesture = gestureRef.current;
    if (!gesture) return;

    if (gesture.kind === 'pinch') {
      updatePointerPinch(gesture);
      return;
    }
    if (gesture.kind === 'pan' && gesture.pointerId === event.pointerId) {
      const dx = point.x - gesture.start.x;
      const dy = point.y - gesture.start.y;
      if (Math.hypot(dx, dy) > 5) gesture.moved = true;
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

  function transitionAfterPointerPinch() {
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

  function handleCanvasPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (nativePinchActiveRef.current) {
      activePointersRef.current.delete(event.pointerId);
      return;
    }
    event.preventDefault();
    const point = { x: event.clientX, y: event.clientY };
    const gesture = gestureRef.current;

    activePointersRef.current.delete(event.pointerId);
    if (gesture?.kind === 'pinch') {
      transitionAfterPointerPinch();
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

  function handleCanvasPointerCancel(event: PointerEvent<HTMLDivElement>) {
    activePointersRef.current.delete(event.pointerId);
    if (nativePinchActiveRef.current) return;
    if (gestureRef.current?.kind === 'pinch') transitionAfterPointerPinch();
    else gestureRef.current = null;
  }

  const viewportTransform = `translate3d(${viewport.tx}px, ${viewport.ty}px, 0) scale(${viewport.scale})`;
  const zoomOutDisabled = viewport.scale <= MIN_PHOTO_SCALE + 0.001;
  const zoomInDisabled = viewport.scale >= MAX_PHOTO_SCALE - 0.001;

  return (
    <div className={`photo-interaction-stage${refined ? ' refined' : ' fallback'}`}>
      <div className="photo-interaction-canvas-wrap">
        <div
          ref={canvasRef}
          className={`photo-interaction-canvas${draggingId ? ' is-dragging' : ''}${viewport.scale > 1.001 ? ' is-zoomed' : ''}`}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onPointerCancel={handleCanvasPointerCancel}
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
                  <div
                    className={`photo-scene-item${selectedId === item.id ? ' selected' : ''}${draggingId === item.id ? ' dragging' : ''}${droppingId === item.id ? ' dropping' : ''}`}
                    style={{ ...boxStyle(item.bbox), pointerEvents: 'none' }}
                    aria-hidden="true"
                  >
                    {refined && cutoutUrl ? (
                      <span className="photo-object-cutout">
                        <img src={cutoutUrl} alt="" draggable={false} />
                      </span>
                    ) : (
                      <span className="photo-object-crop">
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
                  </div>
                  <button
                    type="button"
                    aria-label={`Select and move ${item.label}`}
                    aria-pressed={selectedId === item.id}
                    style={responderStyle(item.bbox, viewport.scale)}
                    onPointerDown={(event) => handleObjectPointerDown(event, item)}
                    onPointerMove={handleObjectPointerMove}
                    onPointerUp={handleObjectPointerUp}
                    onPointerCancel={handleObjectPointerCancel}
                    onContextMenu={(event) => event.preventDefault()}
                    onClick={() => setSelectedId(item.id)}
                  />
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

          <div className="photo-viewport-controls" data-photo-viewport-control="true" role="group" aria-label="Photo zoom controls">
            <button
              type="button"
              data-photo-viewport-control="true"
              aria-label="Zoom out"
              disabled={zoomOutDisabled}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => { event.stopPropagation(); zoomAroundCenter(viewportRef.current.scale - 0.5); }}
            >−</button>
            <span aria-live="polite">{viewport.scale.toFixed(1)}×</span>
            <button
              type="button"
              data-photo-viewport-control="true"
              aria-label="Zoom in"
              disabled={zoomInDisabled}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => { event.stopPropagation(); zoomAroundCenter(viewportRef.current.scale + 0.5); }}
            >+</button>
            {viewport.scale > 1.001 && (
              <button
                type="button"
                className="reset"
                data-photo-viewport-control="true"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => { event.stopPropagation(); resetViewport(); }}
              >Reset</button>
            )}
          </div>
        </div>
      </div>

      <div className="photo-interaction-footer">
        <span>
          <b>{refined ? 'Refined manipulation' : 'Direct manipulation'}</b>
          {viewport.scale > 1.001 ? ' · drag empty space to pan · touch an object to move' : ' · touch an object to select and move · pinch or use + to zoom'}
        </span>
        <span>{selected?.supportSurfaceId ? `Supported by ${localScene.surfaces.find((surface) => surface.id === selected.supportSurfaceId)?.label ?? selected.supportSurfaceId}` : 'Unsupported'}</span>
      </div>
    </div>
  );
}
