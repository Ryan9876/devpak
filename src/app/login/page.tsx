'use client';
import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true';
  const [email,setEmail]=useState('');
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);

  async function emailLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized=email.trim().toLowerCase();
    if(!normalized){setStatus('Enter your email address.');return;}
    setBusy(true);setStatus('Sending a secure sign-in link…');
    try {
      const supabase=createClient();
      const {error}=await supabase.auth.signInWithOtp({
        email: normalized,
        options: { emailRedirectTo: `${location.origin}/auth/callback`, shouldCreateUser: true }
      });
      if(error){setStatus(error.message);setBusy(false);return;}
      setStatus('Check your email for a secure NestMetric sign-in link.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to start email sign-in.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page"><section className="auth-card"><p className="eyebrow">PRIVATE WORKSPACE</p><h1>Sign in to NestMetric</h1><p>Your projects, Room Models and private room assets stay associated with your account.</p>
    <form onSubmit={emailLink} className="auth-form"><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" required/><button className="button primary wide" type="submit" disabled={busy}>Email me a sign-in link</button></form>
    <div className="auth-divider"><span>or</span></div>
    {googleEnabled ? <a className="button secondary wide" href="/auth/google">Continue with Google</a> : <button className="button secondary wide" disabled>Continue with Google</button>}
    {!googleEnabled && <p className="muted">Google sign-in is prepared but remains disabled until Google OAuth credentials are configured. Email sign-in is available now.</p>}
    {status&&<p className="auth-status" role="status">{status}</p>}<a href="/">Back to home</a></section></main>;
}
