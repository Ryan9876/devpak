'use client';
import { FormEvent, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RoomModel } from '@/lib/room-model/types';

type StoredBuild = {
  id: string;
  title: string;
  createdAt: string;
  status: 'ready' | 'conflicted';
  kind: string;
  overall: { widthUm: number; heightUm: number; depthUm: number };
  placement: { wall: string; xUm: number; yUm: number } | null;
  clearances: { frontUm: number; sideUm: number };
  components: Array<{ label: string; quantity: number; widthUm: number; heightUm: number; depthUm: number }>;
  materials: Array<{ item: string; specification: string; quantity: number; unit: string; wastePercent: number; costLowUsd: number | null; costHighUsd: number | null }>;
  conflicts: string[];
  assumptions: string[];
  verification: Array<{ label: string; valueUm: number; toleranceUm: number; source: string; verification: string }>;
  costEstimate: { currency: 'USD'; low: number; high: number; nonbinding: true };
  effortEstimate: { lowHours: number; highHours: number; skill: string; nonbinding: true };
};

const mm = (um: number) => Math.round(um / 1000);

export default function BuildPlanner({ room, ownerId }: { room: RoomModel; ownerId: string }) {
  const [plan, setPlan] = useState<StoredBuild | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; title: string; createdAt: string; status: string }>>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadHistory() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('build_plans')
      .select('id,title,geometry,created_at')
      .eq('room_id', room.id)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(8);
    if (error) {
      setStatus(error.message);
      return;
    }
    setHistory((data ?? []).map((row: any) => ({ id: row.id, title: row.title, createdAt: row.created_at, status: row.geometry?.status ?? 'saved' })));
  }

  useEffect(() => { void loadHistory(); }, [room.id, ownerId]);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setStatus('Checking verified dimensions and generating the build artifact…');
    try {
      const response = await fetch('/api/builds', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId: room.projectId,
          kind: String(data.get('kind') || ''),
          material: String(data.get('material') || ''),
          title: String(data.get('title') || ''),
          widthMm: Number(data.get('widthMm')),
          heightMm: Number(data.get('heightMm')),
          depthMm: Number(data.get('depthMm')),
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        const evidence = [...(json.missing ?? []), ...(json.unverified ?? [])];
        throw new Error(evidence.length ? `${json.error} Check: ${evidence.join(', ')}.` : json.error || 'Build plan failed.');
      }
      setPlan(json.plan);
      setStatus(json.plan.status === 'ready' ? 'Build plan saved with verified evidence.' : 'Build plan saved, but conflicts must be resolved before use.');
      await loadHistory();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Build plan failed.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="build-workspace" aria-labelledby="build-workspace-title">
    <div className="build-workspace-heading">
      <div><p className="eyebrow">BUILD ARTIFACT</p><h2 id="build-workspace-title">Turn verified room evidence into a build plan.</h2><p>Enter the dimensions you want to build. NestMetric checks them against verified room evidence and fixed/opening geometry before saving a plan.</p></div>
      <div className="build-evidence-summary"><b>{room.measurements.filter((m) => m.verification !== 'estimated').length}</b><span>verified / corrected measurements</span></div>
    </div>

    <div className="build-workspace-grid">
      <form className="panel build-request" onSubmit={generate}>
        <h3>Build request</h3>
        <label>Build type<select name="kind" defaultValue="shelving"><option value="shelving">Shelving</option><option value="storage">Storage</option><option value="desk">Desk</option><option value="cabinet">Cabinet</option></select></label>
        <label>Plan title<input name="title" defaultValue="North wall build" maxLength={120} required /></label>
        <div className="build-dimensions"><label>Width mm<input name="widthMm" type="number" min="100" max="10000" defaultValue="1800" required /></label><label>Height mm<input name="heightMm" type="number" min="100" max="10000" defaultValue="1800" required /></label><label>Depth mm<input name="depthMm" type="number" min="100" max="10000" defaultValue="350" required /></label></div>
        <label>Primary material<select name="material" defaultValue="plywood"><option value="plywood">Plywood</option><option value="solid-wood">Solid wood panels</option><option value="melamine">Melamine</option></select></label>
        <button className="button primary" type="submit" disabled={busy}>{busy ? 'Generating…' : 'Generate verified build plan'}</button>
        <p className="build-disclaimer">Planning output only. Verify dimensions, loading, fastening, electrical/plumbing conditions and applicable codes before construction.</p>
        {status && <div className="status-card">{status}</div>}
      </form>

      <div className="panel build-output">
        {!plan ? <div className="build-empty"><h3>No active build artifact</h3><p>Verified wall width and wall depth are required. Generated dimensions come from the build request—not from an image estimate.</p></div> : <>
          <div className="build-plan-top"><div><span className={`build-status ${plan.status}`}>{plan.status}</span><h3>{plan.title}</h3><p>{plan.kind} · {mm(plan.overall.widthUm)} × {mm(plan.overall.heightUm)} × {mm(plan.overall.depthUm)} mm</p></div><div className="build-cost"><b>${plan.costEstimate.low}–${plan.costEstimate.high}</b><span>nonbinding materials</span></div></div>
          {plan.conflicts.length > 0 && <div className="status-card warning"><b>Resolve before use</b><ul>{plan.conflicts.map((conflict) => <li key={conflict}>{conflict}</li>)}</ul></div>}
          <div className="build-facts"><div><span>Placement</span><b>{plan.placement ? `${plan.placement.wall} wall · ${mm(plan.placement.xUm)} mm offset` : 'No clear placement'}</b></div><div><span>Front clearance</span><b>{mm(plan.clearances.frontUm)} mm</b></div><div><span>Effort</span><b>{plan.effortEstimate.lowHours}–{plan.effortEstimate.highHours} hr</b></div></div>

          <h4>Components</h4>
          <div className="build-table">{plan.components.map((component) => <div className="build-row" key={`${component.label}-${component.quantity}`}><b>{component.quantity}× {component.label}</b><span>{mm(component.widthUm)} × {mm(component.heightUm)} × {mm(component.depthUm)} mm</span></div>)}</div>

          <h4>Materials</h4>
          <div className="build-table">{plan.materials.map((material) => <div className="build-row" key={material.item}><div><b>{material.item}</b><small>{material.specification}</small></div><span>{material.quantity} {material.unit} · {material.wastePercent}% waste</span></div>)}</div>

          <h4>Measurement evidence</h4>
          <div className="build-table">{plan.verification.map((item) => <div className="build-row" key={item.label}><b>{item.label}</b><span>{mm(item.valueUm)} mm · ±{mm(item.toleranceUm)} · {item.verification}</span></div>)}</div>

          <details className="build-assumptions"><summary>Assumptions & limitations</summary><ul>{plan.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></details>
        </>}
      </div>
    </div>

    {history.length > 0 && <div className="build-history"><h3>Saved build plans</h3><div>{history.map((item) => <article key={item.id}><span className={`build-status ${item.status}`}>{item.status}</span><b>{item.title}</b><small>{new Date(item.createdAt).toLocaleString()}</small></article>)}</div></div>}
  </section>;
}
