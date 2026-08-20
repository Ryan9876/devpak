'use client';

import { ComponentProps, useEffect, useMemo, useRef, useState } from 'react';
import PhotoWorkspaceCore from './PhotoWorkspaceCore';

type Props = ComponentProps<typeof PhotoWorkspaceCore>;
type PreparationPhase = 'idle' | 'preparing' | 'failed';

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
    ? `${sourceObjectPath}:${movable!.id}:${scene.version}`
    : '';

  useEffect(() => {
    if (refined || disabled || !canPrepare || !attemptKey || phase !== 'idle') return;
    if (attemptedKeyRef.current === attemptKey) return;
    attemptedKeyRef.current = attemptKey;

    let cancelled = false;

    async function prepare() {
      setPhase('preparing');
      setFailure('');
      onStatus?.('Preparing room objects…');

      try {
        const resolveResponse = await fetch('/api/ai/photo-scene-assets/resolve', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sourceObjectPath,
            itemId: movable?.id,
          }),
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
        });
        const prepared = await prepareResponse.json().catch(() => ({}));
        if (!prepareResponse.ok) {
          throw new Error(prepared.error || 'Unable to prepare refined object manipulation.');
        }

        if (cancelled) return;
        onStatus?.(prepared.reused
          ? 'Refined room objects are ready.'
          : 'Room objects prepared. Loading the refined photo layer…');
        window.location.reload();
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Refined object preparation failed.';
        setFailure(message);
        setPhase('failed');
        onStatus?.('Refinement unavailable. Basic manipulation remains available; retry when ready.');
      }
    }

    void prepare();
    return () => {
      cancelled = true;
    };
  }, [attemptKey, canPrepare, disabled, movable?.id, onStatus, phase, refined, sourceObjectPath]);

  function retry() {
    attemptedKeyRef.current = '';
    setFailure('');
    setPhase('idle');
  }

  if (refined || !canPrepare) {
    return <PhotoWorkspaceCore {...props} />;
  }

  if (phase === 'preparing' || phase === 'idle') {
    return (
      <div
        aria-live="polite"
        style={{
          position: 'relative',
          width: '100%',
          minHeight: 520,
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
          background: '#111713',
          color: '#fff',
        }}
      >
        <img
          src={sourceImageUrl}
          alt="Original room"
          draggable={false}
          style={{ width: '100%', height: '100%', maxHeight: '68vh', objectFit: 'contain', opacity: 0.62 }}
        />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(86%, 360px)',
            padding: '16px 18px',
            borderRadius: 18,
            background: 'rgba(18, 27, 23, .88)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            boxShadow: '0 16px 36px rgba(0,0,0,.24)',
            textAlign: 'center',
            lineHeight: 1.45,
          }}
        >
          <b style={{ display: 'block', marginBottom: 5 }}>Preparing room objects…</b>
          <span style={{ fontSize: '.78rem', opacity: 0.82 }}>
            Isolating the photographed object and reconstructing only the pixels hidden behind it. This runs once for this calibrated photo.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <PhotoWorkspaceCore {...props} refined={false} />
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
          <b>Basic manipulation mode.</b> Refined object extraction did not finish{failure ? `: ${failure}` : '.'}
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
    </div>
  );
}
