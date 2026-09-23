"use client";
import { useState } from "react";
import { api } from "../lib/api";

export default function Auth({onLogin}:{onLogin:(user:any)=>void}) {
  const [mode,setMode]=useState<"login"|"register">("login");
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);

  async function submit(e:React.FormEvent){
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const data=await api(`/api/auth/${mode}`,{method:"POST",body:JSON.stringify({email,password})});
      onLogin(data.user);
    } catch(e:any){setError(e.message);} finally{setBusy(false);}
  }

  return <div className="min-h-screen flex items-center justify-center p-5 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
    <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
      <div className="mb-8">
        <div className="text-sm font-bold text-indigo-600">TRAO • AI INTERVIEW PREP</div>
        <h1 className="mt-2 text-3xl font-black text-slate-900">{mode==="login"?"Welcome back":"Create your account"}</h1>
        <p className="mt-2 text-slate-500">Turn a job description into a structured interview preparation kit.</p>
      </div>
      <label className="block text-sm font-bold text-slate-700">Email</label>
      <input className="mt-2 w-full rounded-xl border p-3" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
      <label className="mt-5 block text-sm font-bold text-slate-700">Password</label>
      <input className="mt-2 w-full rounded-xl border p-3" type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required />
      {error&&<div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <button disabled={busy} className="mt-6 w-full rounded-xl bg-slate-900 p-3 font-bold text-white">{busy?"Please wait...":mode==="login"?"Login":"Register"}</button>
      <button type="button" onClick={()=>setMode(mode==="login"?"register":"login")} className="mt-4 w-full text-sm font-semibold text-indigo-600">
        {mode==="login"?"Create an account":"Already have an account? Login"}
      </button>
    </form>
  </div>;
}
