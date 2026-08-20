'use client';

import { ComponentProps, useEffect, useMemo, useRef, useState } from 'react';
import PhotoWorkspaceCore from './PhotoWorkspaceCore';

type Props = ComponentProps<typeof PhotoWorkspaceCore>;
type PreparationPhase = 'idle' | 'preparing' | 'failed';
type PreparedAssets = {
  backgroundImageUrl: string;
  objectImageUrls: Record<string, string>;
};

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

export default function PhotoWorkspace(props: Props) {
  const { refined = false, disabled = false, scene, sourceImageUrl, onStatus } = props;
  const [phase, setPhase] = useState<PreparationPhase>('idle');
  const [failure, setFailure] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const [preparedAssets, setPreparedAssets] = useState<PreparedAssets | null>(null);
  const attemptedKeyRef = useRef('');

  const movable = useMemo(
    () => scene.items.find((item) => item.draggable && !item.fixed) ?? null,
    [scene],
  );
  const sourceObjectPath = useMemo(
    () => sourceObjectPathFromSignedUrl(sourceImageUrl),
    [sourceImageUrl],
  );
  const canPrepare = Boolean(sourceObjectPath && movable?.sourceMasks?.length);
  const attemptKey = canPrepare
    ? `${sourceObjectPath}:${movable!.id}:${scene.version}:${retryToken}`
    : '';

  useEffect(() => {
    if (refined || preparedAssets || disabled || !canPrepare || !attemptKey) return;
    if (attemptedKeyRef.current === attemptKey) return;
    attemptedKeyRef.current = attemptKey;

    let cancelled = false;

    async function prepare() {
      setPhase('preparing');
      setFailure('');
      onStatus?.('Improving object edges in the background. You can keep using the photo.');

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
        if (!resolveResponse.ok) {
          throw new Error(resolved.error || 'Unable to resolve this calibrated room photo.');
        }

        const prepareResponse = await fetch('/api/ai/photo-scene-assets', {
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
        if (!prepareResponse.ok) {
          throw new Error(prepared.error || 'Unable to prepare refined object manipulation.');
        }

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
          ? 'Refined room objects are ready.'
          : 'Room objects prepared. Refined manipulation is ready.');
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof DOMException && error.name === 'AbortError'
          ? 'Refinement took too long and was stopped.'
          : error instanceof Error
            ? error.message
            : 'Refined object preparation failed.';
        setFailure(message);
        setPhase('failed');
        onStatus?.('Refinement unavailable. Basic manipulation remains usable.');
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void prepare();
    return () => {
      cancelled = true;
    };
  }, [attemptKey, canPrepare, disabled, movable?.id, onStatus, preparedAssets, refined, sourceObjectPath]);

  function retry() {
    attemptedKeyRef.current = '';
    setFailure('');
    setPhase('idle');
    setRetryToken((value) => value + 1);
  }

  if (refined || preparedAssets || !canPrepare) {
    return (
      <PhotoWorkspaceCore
        {...props}
        backgroundImageUrl={preparedAssets?.backgroundImageUrl ?? props.backgroundImageUrl}
        objectImageUrls={preparedAssets?.objectImageUrls ?? props.objectImageUrls}
        refined={refined || Boolean(preparedAssets)}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <PhotoWorkspaceCore {...props} refined={false} />

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
          <span><b>Improving object edges…</b> Keep zooming, panning, and moving objects while refinement finishes.</span>
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
          <span>
            <b>Basic manipulation mode.</b> {failure || 'Refined object extraction did not finish.'}
          </span>
          <button
            type="button"
            onClick={retry}
            disabled={disabled}
            style={{
              minWidth: 92,
              minHeight: 44,
              border: '1px solid rgba(92,73,48,.2)',
              borderRadius: 999,
              background: '#fff',
              color: '#3f3425',
              font: 'inherit',
              fontWeight: 760,
              padding: '0 12px',
            }}
          >
            Retry refinement
          </button>
        </div>
      )}
    </div>
  );
}
