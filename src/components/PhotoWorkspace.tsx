'use client';

import { PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { evaluatePlacement, resolveDrop } from '@/lib/photo/placement';
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

type DragSession = {
  itemId: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  original: PhotoSceneItem;
  latestBox: NormalizedBox;
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
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragSession | null>(null);
  const sceneRef = useRef(scene);

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

  function normalizedPointer(event: PointerEvent<HTMLElement>) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>, item: PhotoSceneItem) {
    if (disabled || item.fixed || !item.draggable) return;
    const pointer = normalizedPointer(event);
    if (!pointer) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(item.id);
    setDraggingId(item.id);
    setDroppingId(null);
    onStatus?.(`Moving ${item.label} · keep its base on a surface or gravity will take over.`);
    dragRef.current = {
      itemId: item.id,
      pointerId: event.pointerId,
      offsetX: pointer.x - item.bbox.x,
      offsetY: pointer.y - item.bbox.y,
      original: { ...item, bbox: { ...item.bbox } },
      latestBox: { ...item.bbox },
    };
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || disabled) return;
    const pointer = normalizedPointer(event);
    if (!pointer) return;
    const current = sceneRef.current.items.find((item) => item.id === drag.itemId);
    if (!current) return;

    event.preventDefault();
    const desired = clampBox({
      ...current.bbox,
      x: pointer.x - drag.offsetX,
      y: pointer.y - drag.offsetY,
    });
    drag.latestBox = desired;
    const nextPreview = evaluatePlacement(sceneRef.current, current, desired);
    setPreview(nextPreview);
    onStatus?.(nextPreview.message);
    replaceItem(current.id, (item) => ({ ...item, bbox: desired }));
  }

  async function finishDrag() {
    const drag = dragRef.current;
    if (!drag) return;
    const current = sceneRef.current.items.find((item) => item.id === drag.itemId);
    if (!current) {
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

  function cancelDrag() {
    const drag = dragRef.current;
    if (!drag) return;
    replaceItem(drag.itemId, () => drag.original);
    dragRef.current = null;
    setDraggingId(null);
    setPreview(null);
    onStatus?.('Move cancelled.');
  }

  return (
    <div className={`photo-interaction-stage${refined ? ' refined' : ' fallback'}`}>
      <div className="photo-interaction-canvas-wrap">
        <div
          ref={canvasRef}
          className={`photo-interaction-canvas${draggingId ? ' is-dragging' : ''}`}
          onPointerMove={moveDrag}
          onPointerUp={() => void finishDrag()}
          onPointerCancel={cancelDrag}
          onContextMenu={(event) => event.preventDefault()}
        >
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
                  className={`photo-scene-item${selectedId === item.id ? ' selected' : ''}${draggingId === item.id ? ' dragging' : ''}${droppingId === item.id ? ' dropping' : ''}`}
                  style={boxStyle(item.bbox)}
                  onPointerDown={(event) => startDrag(event, item)}
                  onClick={() => setSelectedId(item.id)}
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
                  <span className="photo-object-handle" aria-hidden="true" />
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

          {preview && draggingId && (
            <div className={`photo-physics-hud ${preview.state}`}>
              {preview.state === 'falling' ? '↓ ' : ''}{preview.message}
            </div>
          )}
        </div>
      </div>

      <div className="photo-interaction-footer">
        <span><b>{refined ? 'Refined manipulation' : 'Direct manipulation'}</b> · touch the plant and drag</span>
        <span>{selected?.supportSurfaceId ? `Supported by ${localScene.surfaces.find((surface) => surface.id === selected.supportSurfaceId)?.label ?? selected.supportSurfaceId}` : 'Unsupported'}</span>
      </div>
    </div>
  );
}
