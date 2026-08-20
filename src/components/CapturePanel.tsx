'use client';
import { ChangeEvent, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type CaptureAsset = {
  id: string;
  objectPath: string;
  signedUrl: string;
  mimeType: string;
  byteLength: number;
  capturedAt: string;
  captureMethod: string;
};

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export default function CapturePanel({ ownerId, roomId, onSaved }: { ownerId: string; roomId: string; onSaved: () => void }) {
  const [status, setStatus] = useState('');
  const [assets, setAssets] = useState<CaptureAsset[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAssets() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('room_assets')
      .select('id,object_path,mime_type,byte_length,capture_context,created_at')
      .eq('room_id', roomId)
      .eq('owner_id', ownerId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }

    const hydrated = await Promise.all((data ?? []).map(async (row: any) => {
      const { data: signed, error: signedError } = await supabase.storage.from('room-assets').createSignedUrl(row.object_path, 600);
      if (signedError || !signed?.signedUrl) return null;
      return {
        id: row.id,
        objectPath: row.object_path,
        signedUrl: signed.signedUrl,
        mimeType: row.mime_type,
        byteLength: Number(row.byte_length),
        capturedAt: row.created_at,
        captureMethod: row.capture_context?.captureMethod ?? 'room capture',
      } satisfies CaptureAsset;
    }));

    setAssets(hydrated.filter((asset): asset is CaptureAsset => Boolean(asset)));
    setLoading(false);
  }

  useEffect(() => { void loadAssets(); }, [roomId, ownerId]);

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatus('Choose an image file.');
      input.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setStatus('Room photos must be 15 MB or smaller.');
      input.value = '';
      return;
    }

    setStatus('Uploading privately…');
    const supabase = createClient();
    const path = `${ownerId}/${roomId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await supabase.storage.from('room-assets').upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      setStatus(error.message);
      input.value = '';
      return;
    }

    const { error: metaError } = await supabase.from('room_assets').insert({
      room_id: roomId,
      owner_id: ownerId,
      object_path: path,
      mime_type: file.type,
      byte_length: file.size,
      capture_context: {
        platform: navigator.platform || 'web',
        captureMethod: 'guided_web_photo',
        userAgent: navigator.userAgent,
        capturedAt: new Date().toISOString(),
      },
    });
    if (metaError) {
      await supabase.storage.from('room-assets').remove([path]);
      setStatus(metaError.message);
      input.value = '';
      return;
    }

    setStatus('Photo saved to the private Room Model.');
    input.value = '';
    await loadAssets();
    onSaved();
  }

  async function removeAsset(asset: CaptureAsset) {
    const supabase = createClient();
    const deletedAt = new Date().toISOString();
    const { error: markError } = await supabase.from('room_assets').update({ deleted_at: deletedAt }).eq('id', asset.id).eq('owner_id', ownerId);
    if (markError) {
      setStatus(markError.message);
      return;
    }

    const { error: storageError } = await supabase.storage.from('room-assets').remove([asset.objectPath]);
    if (storageError) {
      await supabase.from('room_assets').update({ deleted_at: null }).eq('id', asset.id).eq('owner_id', ownerId);
      setStatus(storageError.message);
      return;
    }

    await supabase.from('room_assets').delete().eq('id', asset.id).eq('owner_id', ownerId);
    setStatus('Room photo deleted from private storage.');
    await loadAssets();
    onSaved();
  }

  return <div className="evidence-section">
    <h2>Room captures</h2>
    <div className="camera-box">Take or choose a room photo. Images remain private and are served with short-lived signed URLs. LiDAR can later enrich the same Room Model.</div>
    <label className="capture-form">Add room photo<input type="file" accept="image/*" capture="environment" onChange={upload} /></label>
    {loading ? <p className="muted">Loading private captures…</p> : assets.length > 0 ? <div className="capture-grid">{assets.map((asset, index) => <figure className="capture-card" key={asset.id}>
      <img src={asset.signedUrl} alt={`Room capture ${index + 1}`} />
      <figcaption><span>{asset.captureMethod.replaceAll('_', ' ')}</span><span>{Math.max(1, Math.round(asset.byteLength / 1024))} KB</span></figcaption>
      <button className="small-button capture-delete" type="button" onClick={() => removeAsset(asset)}>Delete photo</button>
    </figure>)}</div> : <p className="muted">No room photos saved yet.</p>}
    {status && <div className="status-card">{status}</div>}
  </div>;
}
