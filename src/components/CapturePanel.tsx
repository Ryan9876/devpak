'use client';
import { ChangeEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function CapturePanel({ownerId,roomId,onSaved}:{ownerId:string;roomId:string;onSaved:()=>void}){
  const [status,setStatus]=useState('');
  async function upload(e:ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];if(!file)return;setStatus('Uploading securely…');const supabase=createClient();const path=`${ownerId}/${roomId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const {error}=await supabase.storage.from('room-assets').upload(path,file,{contentType:file.type,upsert:false});if(error){setStatus(error.message);return;}const {error:metaError}=await supabase.from('room_assets').insert({room_id:roomId,owner_id:ownerId,object_path:path,mime_type:file.type||'application/octet-stream',byte_length:file.size,capture_context:{platform:navigator.platform||'web',captureMethod:'guided_web_photo',userAgent:navigator.userAgent}});if(metaError){await supabase.storage.from('room-assets').remove([path]);setStatus(metaError.message);return;}setStatus('Photo saved to the private room model.');onSaved();}
  return <div><h2>Capture</h2><div className="camera-box">Take or choose a room photo. On iPhone, the browser can open the camera directly; LiDAR remains an optional native capture enhancement.</div><label className="capture-form">Room photo<input type="file" accept="image/*" capture="environment" onChange={upload}/></label>{status&&<div className="status-card">{status}</div>}</div>;
}
