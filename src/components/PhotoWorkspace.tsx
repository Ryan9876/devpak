'use client';

import { ComponentProps, useEffect, useMemo, useRef, useState } from 'react';
import type { PhotoScene } from '@/lib/photo/types';
import PhotoWorkspaceCore from './PhotoWorkspaceCore';

type Props = ComponentProps<typeof PhotoWorkspaceCore>;
type PreparationPhase = 'idle' | 'preparing' | 'failed';
type PreparedAssets = {
  backgroundImageUrl: string;
  objectImageUrls: Record<string, string>;
};
type PickPoint = { x: number; y: number };

const PREPARATION_TIMEOUT_MS = 115_000;

function sourceObjectPathFromSignedUrl(value: string) {
  try {
    const url = new URL(value);
    const marker = '/storage/v1/object/sign/room-assets/';
    const start = url.pathname.indexOf(marker);
    if (start < 0) return null;
    const encodedPath = url.pathname.slice(start + marker.length);
    return encodedPath ? decodeURIComponent(encodedPath) : null;
  } catch {
    return null;
  }
}

function pillButtonStyle(disabled: boolean) {
  return {
    minHeight: 44,
    border: '1px solid rgba(36,53,46,.18)',
    borderRadius: 999,
    background: disabled ? 'rgba(255,255,255,.55)' : '#fff',
    color: '#24352e',
    font: 'inherit',
    fontWeight: 760,
    padding: '0 14px',
    opacity: disabled ? 0.55 : 1,
  } as const;
}

export default function PhotoWorkspace(props: Props) {
  const { refined = false, disabled = false, scene, sourceImageUrl, onStatus, onSceneChanged } = props;
  const [workingScene, setWorkingScene] = useState<PhotoScene>(scene);
  const [phase, setPhase] = useState<PreparationPhase>('idle');
  const [failure, setFailure] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const [preparedAssets, setPreparedAssets] = useState<PreparedAssets | null>(null);
  const [selecting, setSelecting] = useState(scene.calibration !== 'vision_assisted');
  const [selectionBusy, setSelectionBusy] = useState(false);
  const [selectionPoint, setSelectionPoint] = useState<PickPoint | null>(null);
  const attemptedKeyRef = useRef('');
  const pickerDownRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setWorkingScene(scene);
    if (scene.calibration !== 'vision_assisted') setSelecting(true);
  }, [scene]);

  const movable = useMemo(
    () => workingScene.items.find((item) => item.draggable && !item.fixed) ?? null,
    [workingScene],
  );
  const parentMovable = useMemo(
    () => scene.items.find((item) => item.draggable && !item.fixed) ?? null,
    [scene],
  );
  const sourceObjectPath = useMemo(
    () => sourceObjectPathFromSignedUrl(sourceImageUrl),
    [sourceImageUrl],
  );
  const canPrepare = Boolean(
    workingScene.calibration === 'vision_assisted'
      && sourceObjectPath
      && movable?.sourceBbox
      && movable.sourceMasks?.length,
  );
  const attemptKey = canPrepare
    ? `${sourceObjectPath}:${movable!.id}:${workingScene.version}:${retryToken}`
    : '';
  const inheritedRefined = Boolean(refined && parentMovable?.id && parentMovable.id === movable?.id);

  useEffect(() => {
    setPreparedAssets(null);
    attemptedKeyRef.current = '';
    setPhase('idle');
    setFailure('');
  }, [movable?.id]);

  useEffect(() => {
    if (selecting || selectionBusy || inheritedRefined || preparedAssets || disabled || !canPrepare || !attemptKey) return;
    if (attemptedKeyRef.current === attemptKey) return;
    attemptedKeyRef.current = attemptKey;

    let cancelled = false;

    async function prepare() {
      setPhase('preparing');
      setFailure('');
      onStatus?.(`Preparing ${movable?.label ?? 'selected object'} for realistic movement. You can keep using the photo.`);

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), PREPARATION_TIMEOUT_MS);

      try {
        const resolveResponse = await fetch('/api/ai/photo-scene-assets/resolve', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sourceObjectPath,
            itemId: movable?.id,
          }),
          signal: controller.signal,
        });
        const resolved = await resolveResponse.json().catch(() => ({}));
        if (!resolveResponse.ok) throw new Error(resolved.error || 'Unable to resolve this room photo.');

        const prepareResponse = await fetch('/api/ai/photo-scene-assets-v4', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            roomId: resolved.roomId,
            sourceAssetId: resolved.sourceAssetId,
            itemId: resolved.itemId,
          }),
          signal: controller.signal,
        });
        const prepared = await prepareResponse.json().catch(() => ({}));
        if (!prepareResponse.ok) throw new Error(prepared.error || 'Unable to prepare refined object manipulation.');

        const backgroundImageUrl = String(prepared.background?.signedUrl || '');
        const objectImageUrl = String(prepared.object?.signedUrl || '');
        if (!backgroundImageUrl || !objectImageUrl || !movable?.id) {
          throw new Error('Refined room assets were created but could not be loaded.');
        }

        if (cancelled) return;
        setPreparedAssets({
          backgroundImageUrl,
          objectImageUrls: { [movable.id]: objectImageUrl },
        });
        setPhase('idle');
        onStatus?.(prepared.reused
          ? `${movable.label} is ready to move.`
          : `${movable.label} isolated from the photo. Refined manipulation is ready.`);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof DOMException && error.name === 'AbortError'
          ? 'Object preparation took too long and was stopped.'
          : error instanceof Error
            ? error.message
            : 'Refined object preparation failed.';
        setFailure(message);
        setPhase('failed');
        onStatus?.('Refinement unavailable. Choose the object again or retry preparation.');
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void prepare();
    return () => {
      cancelled = true;
    };
  }, [attemptKey, canPrepare, disabled, inheritedRefined, movable?.id, movable?.label, onStatus, preparedAssets, selecting, selectionBusy, sourceObjectPath]);

  function retry() {
    attemptedKeyRef.current = '';
    setFailure('');
    setPhase('idle');
    setRetryToken((value) => value + 1);
  }

  function beginSelection() {
    if (disabled || phase === 'preparing') return;
    attemptedKeyRef.current = '';
    setPreparedAssets(null);
    setFailure('');
    setPhase('idle');
    setSelectionPoint(null);
    setSelecting(true);
    onStatus?.('Tap the center of one object you want to move.');
  }

  async function selectObjectAt(point: PickPoint) {
    if (!sourceObjectPath || selectionBusy || disabled) return;
    setSelectionPoint(point);
    setSelectionBusy(true);
    onStatus?.('Identifying the object you tapped…');

    try {
      const resolveResponse = await fetch('/api/ai/photo-scene-assets/resolve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceObjectPath }),
      });
      const resolved = await resolveResponse.json().catch(() => ({}));
      if (!resolveResponse.ok) throw new Error(resolved.error || 'Unable to resolve this room photo.');

      const selectResponse = await fetch('/api/ai/photo-object-select', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          roomId: resolved.roomId,
          sourceAssetId: resolved.sourceAssetId,
          point,
        }),
      });
      const selected = await selectResponse.json().catch(() => ({}));
      if (!selectResponse.ok || !selected.scene || !selected.item) {
        throw new Error(selected.error || 'Unable to isolate that object.');
      }

      const nextScene = selected.scene as PhotoScene;
      setWorkingScene(nextScene);
      setPreparedAssets(null);
      attemptedKeyRef.current = '';
      await onSceneChanged(nextScene);
      setSelecting(false);
      setSelectionPoint(null);
      onStatus?.(`${selected.item.label} selected. Preparing its real photo pixels for movement…`);
    } catch (error) {
      setSelectionPoint(null);
      onStatus?.(error instanceof Error ? error.message : 'Unable to identify that object.');
    } finally {
      setSelectionBusy(false);
    }
  }

  function pickerPoint(clientX: number, clientY: number, element: HTMLImageElement): PickPoint {
    const rect = element.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width))),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / Math.max(1, rect.height))),
    };
  }

  if (selecting) {
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: '#0f1e19',
            borderRadius: 12,
          }}
        >
          <img
            src={sourceImageUrl}
            alt="Room photo · tap an object to move"
            draggable={false}
            style={{ display: 'block', width: '100%', height: 'auto', touchAction: 'none', WebkitTouchCallout: 'none' }}
            onContextMenu={(event) => event.preventDefault()}
            onPointerDown={(event) => {
              event.preventDefault();
              pickerDownRef.current = { x: event.clientX, y: event.clientY };
              try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* best effort */ }
            }}
            onPointerUp={(event) => {
              event.preventDefault();
              const start = pickerDownRef.current;
              pickerDownRef.current = null;
              if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) return;
              void selectObjectAt(pickerPoint(event.clientX, event.clientY, event.currentTarget));
            }}
            onPointerCancel={() => { pickerDownRef.current = null; }}
          />

          {selectionPoint && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: `${selectionPoint.x * 100}%`,
                top: `${selectionPoint.y * 100}%`,
                width: 30,
                height: 30,
                border: '3px solid #fff',
                borderRadius: '50%',
                boxShadow: '0 0 0 3px rgba(36,53,46,.85)',
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
              }}
            />
          )}

          {selectionBusy && (
            <div
              role="status"
              aria-live="polite"
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(15,30,25,.22)',
                color: '#fff',
                fontWeight: 780,
                pointerEvents: 'none',
              }}
            >
              Identifying object…
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 12px',
            borderRadius: 12,
            background: 'rgba(220,230,220,.84)',
            color: '#24352e',
            fontSize: '.72rem',
            lineHeight: 1.4,
          }}
        >
          <span><b>Choose something to move.</b> Tap near the center of one distinct object in the real photo.</span>
          {scene.calibration === 'vision_assisted' && (
            <button type="button" onClick={() => setSelecting(false)} disabled={selectionBusy} style={pillButtonStyle(selectionBusy)}>
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  const effectiveRefined = inheritedRefined || Boolean(preparedAssets);
  const core = (
    <PhotoWorkspaceCore
      {...props}
      scene={workingScene}
      backgroundImageUrl={preparedAssets?.backgroundImageUrl ?? props.backgroundImageUrl}
      objectImageUrls={preparedAssets?.objectImageUrls ?? (inheritedRefined ? props.objectImageUrls : {})}
      refined={effectiveRefined}
    />
  );

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {core}

      {phase === 'preparing' && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 12,
            background: 'rgba(220,230,220,.84)',
            color: '#24352e',
            fontSize: '.72rem',
            lineHeight: 1.4,
          }}
        >
          <span aria-hidden="true" style={{ fontSize: '1rem' }}>◌</span>
          <span><b>Preparing {movable?.label ?? 'object'}…</b> Keep zooming and panning while the clean movement layer is created.</span>
        </div>
      )}

      {phase === 'failed' && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 12px',
            borderRadius: 12,
            background: '#fff1d6',
            color: '#5c4930',
            fontSize: '.72rem',
            lineHeight: 1.4,
          }}
        >
          <span><b>Basic manipulation mode.</b> {failure || 'Refined object extraction did not finish.'}</span>
          <button type="button" onClick={retry} disabled={disabled} style={pillButtonStyle(disabled)}>
            Retry
          </button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={beginSelection}
          disabled={disabled || phase === 'preparing'}
          style={pillButtonStyle(disabled || phase === 'preparing')}
        >
          Choose another object
        </button>
      </div>
    </div>
  );
}
