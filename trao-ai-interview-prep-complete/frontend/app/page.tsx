"use client";
import { useEffect, useState } from "react";
import Auth from "../components/Auth";
import KitEditor from "../components/KitEditor";
import { api } from "../lib/api";

export default function Home(){
  const [user,setUser]=useState<any>(null);
  const [checking,setChecking]=useState(true);
  const [kits,setKits]=useState<any[]>([]);
  const [selected,setSelected]=useState<any>(null);
  const [jd,setJd]=useState(""); const [url,setUrl]=useState(""); const [days,setDays]=useState(5);
  const [busy,setBusy]=useState(false); const [progress,setProgress]=useState<any>(null); const [error,setError]=useState("");

  async function load(){
    try { const me=await api("/api/auth/me"); setUser(me.user); const list=await api("/api/kits"); setKits(list.kits); }
    catch{} finally{setChecking(false)}
  }
  useEffect(()=>{load()},[]);

  if(checking) return <div className="min-h-screen grid place-items-center">Loading...</div>;
  if(!user) return <Auth onLogin={u=>{setUser(u);load()}}/>;

  async function generate(){
    setError("");setBusy(true);setProgress({percent:1,message:"Starting..."});
    try{
      const {jobId}=await api("/api/kits/generate",{method:"POST",body:JSON.stringify({jd,company_url:url,days:Number(days)})});
      const timer=setInterval(async()=>{
        try{
          const d=await api(`/api/jobs/${jobId}`); setProgress(d.job.progress);
          if(d.job.status==="complete"){
            clearInterval(timer);
            const saved=await api("/api/kits/save-generated",{method:"POST",body:JSON.stringify({input:{jd,company_url:url,days:Number(days)},kit:d.job.kit})});
            setSelected(saved.kit); setKits((await api("/api/kits")).kits); setBusy(false);
          } else if(d.job.status==="failed"){
            clearInterval(timer); setError(d.job.error?.message||"Generation failed");setBusy(false);
          }
        }catch(e:any){clearInterval(timer);setError(e.message);setBusy(false)}
      },1000);
    }catch(e:any){setError(e.message);setBusy(false)}
  }

  async function logout(){await api("/api/auth/logout",{method:"POST"});setUser(null);setSelected(null);}

  return <main className="min-h-screen bg-slate-50">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4"><div><div className="font-black text-slate-900">TRAO • Interview Prep</div><div className="text-xs text-slate-500">{user.email}</div></div><button onClick={logout} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold">Logout</button></div></header>
    <div className="mx-auto max-w-7xl p-5">
      {!selected?<div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-3xl bg-slate-950 p-7 text-white shadow-xl"><div className="text-sm font-black text-indigo-300">BUILD A PREP KIT</div><h1 className="mt-3 text-4xl font-black tracking-tight">Turn a JD into an interview plan.</h1><p className="mt-4 max-w-xl text-slate-300">Research the company, map requirements to questions, close coverage gaps, create flashcards and distribute the work across your available days.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">{["Company research","Requirement coverage","Second-pass questions","Practice mode"].map(x=><div key={x} className="rounded-2xl bg-white/10 p-4 text-sm font-bold">{x}</div>)}</div>
        </section>
        <section className="rounded-3xl bg-white p-7 shadow-sm"><h2 className="text-2xl font-black">Create a kit</h2>
          <label className="mt-6 block text-sm font-bold">Job description</label><textarea value={jd} onChange={e=>setJd(e.target.value)} className="mt-2 min-h-56 w-full rounded-2xl border p-4" placeholder="Paste the complete job description..." />
          <label className="mt-5 block text-sm font-bold">Company website</label><input value={url} onChange={e=>setUrl(e.target.value)} className="mt-2 w-full rounded-xl border p-3" placeholder="https://company.com"/>
          <label className="mt-5 block text-sm font-bold">Days before interview</label><input type="number" min={1} max={60} value={days} onChange={e=>setDays(Number(e.target.value))} className="mt-2 w-full rounded-xl border p-3"/>
          <button disabled={busy||!jd||!url} onClick={generate} className="mt-6 w-full rounded-xl bg-indigo-600 p-3 font-black text-white disabled:opacity-50">{busy?"Generating...":"Generate interview kit"}</button>
          {busy&&progress&&<div className="mt-5"><div className="flex justify-between text-xs font-bold"><span>{progress.message}</span><span>{progress.percent}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-indigo-600 transition-all" style={{width:`${progress.percent}%`}}/></div></div>}
          {error&&<div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        </section>
      </div>:<div><div className="mb-6 flex items-center gap-3"><button onClick={()=>setSelected(null)} className="rounded-xl bg-white px-4 py-2 font-bold shadow-sm">← My kits</button><div><h1 className="text-2xl font-black">{selected.role.title}</h1><p className="text-sm text-slate-500">{selected.source.company}</p></div></div><KitEditor kit={selected} onUpdate={setSelected}/></div>}

      {!selected&&<section className="mt-8"><h2 className="mb-4 text-xl font-black">My kits</h2>{kits.length?<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{kits.map(k=><button key={k._id} onClick={async()=>setSelected((await api(`/api/kits/${k._id}`)).kit)} className="rounded-2xl bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5"><div className="text-xs font-black text-indigo-600">{k.source.company}</div><h3 className="mt-1 font-black">{k.role?.title||k.source.role}</h3><p className="mt-2 text-sm text-slate-500">{k.schedule?.days_available} days</p></button>)}</div>:<div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">No kits yet. Create your first one above.</div>}</section>}
    </div>
  </main>;
}
