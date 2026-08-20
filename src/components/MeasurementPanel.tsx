'use client';
import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { MeasurementEvidence } from '@/lib/room-model/types';

export default function MeasurementPanel({ownerId,roomId,measurements,onChanged}:{ownerId:string;roomId:string;measurements:MeasurementEvidence[];onChanged:()=>void}){
 const [status,setStatus]=useState('');
 async function add(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget),label=String(f.get('label')||'').trim(),millimetres=Number(f.get('mm'));if(!label||!Number.isFinite(millimetres)||millimetres<=0){setStatus('Enter a label and a positive measurement.');return;}const supabase=createClient();const {error}=await supabase.from('room_measurements').insert({room_id:roomId,owner_id:ownerId,label,value_um:Math.round(millimetres*1000),tolerance_um:5000,confidence:1,source:'manual',verification:'verified',device_context:{platform:navigator.platform||'web',captureMethod:'manual_reference'},correction_history:[]});if(error){setStatus(error.message);return;}setStatus(`${label} saved as verified manual evidence.`);e.currentTarget.reset();onChanged();}
 return <div><h2>Measurements</h2><p className="muted">Build uses verified or corrected dimensional evidence—not estimates alone.</p><div className="tool-list">{measurements.map(m=><div className="status-card" key={m.id}><b>{m.label}</b><br/>{Math.round(m.valueUm/1000)} mm · {m.verification} · {Math.round(m.confidence*100)}%</div>)}</div><form className="measure-form" onSubmit={add}><label>Reference label<input name="label" placeholder="wall width" required/></label><label>Millimetres<input name="mm" type="number" min="1" step="1" required/></label><button className="small-button" type="submit">Add verified measurement</button></form>{status&&<div className="status-card">{status}</div>}</div>;
}
