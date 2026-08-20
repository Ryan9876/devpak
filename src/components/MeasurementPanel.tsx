'use client';
import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { MeasurementEvidence, MeasurementSource } from '@/lib/room-model/types';

const sourceLabel: Record<MeasurementSource, string> = {
  manual: 'manual',
  photo_estimate: 'photo estimate',
  ar: 'AR',
  lidar: 'LiDAR',
  imported: 'imported',
};

export default function MeasurementPanel({ ownerId, roomId, measurements, onChanged }: { ownerId: string; roomId: string; measurements: MeasurementEvidence[]; onChanged: () => void }) {
  const [status, setStatus] = useState('');

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const label = String(f.get('label') || '').trim();
    const millimetres = Number(f.get('mm'));
    const source = String(f.get('source') || 'manual') as 'manual' | 'photo_estimate';
    if (!label || !Number.isFinite(millimetres) || millimetres <= 0) {
      setStatus('Enter a label and a positive measurement.');
      return;
    }

    const estimated = source === 'photo_estimate';
    const supabase = createClient();
    const { error } = await supabase.from('room_measurements').insert({
      room_id: roomId,
      owner_id: ownerId,
      label,
      value_um: Math.round(millimetres * 1000),
      tolerance_um: estimated ? 25_000 : 5_000,
      confidence: estimated ? 0.55 : 1,
      source,
      verification: estimated ? 'estimated' : 'verified',
      device_context: { platform: navigator.platform || 'web', captureMethod: estimated ? 'photo_estimate' : 'manual_reference' },
      correction_history: [],
    });
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus(estimated ? `${label} saved as an estimate. Correct it before Build can rely on it.` : `${label} saved as verified manual evidence.`);
    form.reset();
    onChanged();
  }

  async function correct(e: FormEvent<HTMLFormElement>, measurement: MeasurementEvidence) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const millimetres = Number(f.get('correctedMm'));
    if (!Number.isFinite(millimetres) || millimetres <= 0) {
      setStatus('Enter a positive corrected measurement.');
      return;
    }

    const correctedUm = Math.round(millimetres * 1000);
    const correctionHistory = [
      ...measurement.correctionHistory,
      { at: new Date().toISOString(), fromUm: measurement.valueUm, toUm: correctedUm, reason: 'User-verified correction' },
    ];
    const supabase = createClient();
    const { error } = await supabase.from('room_measurements').update({
      value_um: correctedUm,
      tolerance_um: 5_000,
      confidence: 1,
      verification: 'corrected',
      calibration: { referenceLabel: measurement.label, referenceValueUm: correctedUm },
      correction_history: correctionHistory,
      updated_at: new Date().toISOString(),
    }).eq('id', measurement.id).eq('owner_id', ownerId).eq('room_id', roomId);

    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus(`${measurement.label} corrected and verified.`);
    onChanged();
  }

  return <div className="evidence-section">
    <h2>Measurements</h2>
    <p className="muted">Build uses verified or corrected dimensional evidence—not estimates alone.</p>
    <div className="measurement-list">{measurements.map((m) => <article className={`measurement-card ${m.verification === 'estimated' ? 'estimated' : 'verified'}`} key={m.id}>
      <div className="measurement-card-top"><b>{m.label}</b><span>{m.verification}</span></div>
      <div className="measurement-value">{Math.round(m.valueUm / 1000)} mm</div>
      <div className="measurement-meta">{sourceLabel[m.source]} · {Math.round(m.confidence * 100)}% confidence · ±{Math.round(m.toleranceUm / 1000)} mm</div>
      {m.verification === 'estimated' && <form className="correction-form" onSubmit={(event) => correct(event, m)}>
        <label>Corrected millimetres<input name="correctedMm" type="number" min="1" step="1" defaultValue={Math.round(m.valueUm / 1000)} required /></label>
        <button className="small-button" type="submit">Correct & verify</button>
      </form>}
      {m.correctionHistory.length > 0 && <div className="measurement-history">{m.correctionHistory.length} correction{m.correctionHistory.length === 1 ? '' : 's'} recorded</div>}
    </article>)}</div>

    <form className="measure-form" onSubmit={add}>
      <label>Evidence type<select name="source" defaultValue="manual"><option value="manual">Manual measurement</option><option value="photo_estimate">Photo estimate</option></select></label>
      <label>Reference label<input name="label" placeholder="wall width" required /></label>
      <label>Millimetres<input name="mm" type="number" min="1" step="1" required /></label>
      <button className="small-button" type="submit">Add measurement</button>
    </form>
    {status && <div className="status-card">{status}</div>}
  </div>;
}
