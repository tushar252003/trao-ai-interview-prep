"use client";
import { useMemo, useState } from "react";
import { api } from "../lib/api";

export default function KitEditor({kit:initial,onUpdate}:{kit:any;onUpdate:(k:any)=>void}) {
  const [kit,setKit]=useState(initial); const [tab,setTab]=useState("overview"); const [practiceIndex,setPracticeIndex]=useState(0);
  const [editing,setEditing]=useState<string|null>(null); const [saving,setSaving]=useState(false);

  const cards=useMemo(()=>[...(kit.flashcards||[])].sort((a:any,b:any)=>(a.confidence??0)-(b.confidence??0)),[kit.flashcards]);

  async function saveQuestion(q:any){
    setSaving(true);
    try { const d=await api(`/api/kits/${kit._id}/question/${q.id}`,{method:"PATCH",body:JSON.stringify({prompt:q.prompt,answer_outline:q.answer_outline,category:q.category,difficulty:q.difficulty})}); setKit(d.kit); onUpdate(d.kit); setEditing(null); }
    catch(e:any){alert(e.message)} finally{setSaving(false)}
  }

  async function confidence(v:number){
    const card=cards[practiceIndex]; if(!card)return;
    try { const d=await api(`/api/kits/${kit._id}/confidence/${card.id}`,{method:"PATCH",body:JSON.stringify({confidence:v})}); setKit(d.kit); onUpdate(d.kit); if(practiceIndex<cards.length-1)setPracticeIndex(x=>x+1); }
    catch(e:any){alert(e.message)}
  }

  const tabs=["overview","questions","flashcards","schedule","practice"];
  return <div>
    <div className="mb-5 flex flex-wrap gap-2">{tabs.map(t=><button key={t} onClick={()=>setTab(t)} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab===t?"bg-slate-900 text-white":"bg-white text-slate-600 shadow-sm"}`}>{t}</button>)}</div>

    {tab==="overview"&&<div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl bg-white p-6 shadow-sm"><div className="text-xs font-black uppercase text-indigo-600">Company</div><h2 className="mt-2 text-2xl font-black">{kit.source.company}</h2><p className="mt-3 text-slate-600">{kit.company_brief.summary}</p><p className="mt-3 text-slate-600">{kit.company_brief.what_they_do}</p></section>
      <section className="rounded-2xl bg-white p-6 shadow-sm"><div className="text-xs font-black uppercase text-indigo-600">Role</div><h2 className="mt-2 text-2xl font-black">{kit.role.title}</h2><p className="text-slate-500">{kit.role.seniority}</p><div className="mt-4 flex flex-wrap gap-2">{kit.role.requirements.map((r:any)=><span key={r.id} className={`rounded-full px-3 py-1 text-xs font-bold ${r.priority==="must"?"bg-indigo-50 text-indigo-700":"bg-slate-100 text-slate-600"}`}>{r.id} • {r.priority}</span>)}</div></section>
      <section className="rounded-2xl bg-white p-6 shadow-sm lg:col-span-2"><h3 className="font-black">Coverage</h3><p className="mt-2 text-slate-600">{kit.coverage.uncovered_requirement_ids.length?"Gaps: "+kit.coverage.uncovered_requirement_ids.join(", "):"All must-have requirements are covered."} • {kit.coverage.passes} pass(es)</p></section>
    </div>}

    {tab==="questions"&&<div className="space-y-4">{kit.questions.map((q:any)=><div key={q.id} className="rounded-2xl bg-white p-5 shadow-sm">
      {editing===q.id?<div>
        <textarea className="min-h-24 w-full rounded-xl border p-3" value={q.prompt} onChange={e=>setKit({...kit,questions:kit.questions.map((x:any)=>x.id===q.id?{...x,prompt:e.target.value}:x)})}/>
        <textarea className="mt-3 min-h-24 w-full rounded-xl border p-3" value={q.answer_outline} onChange={e=>setKit({...kit,questions:kit.questions.map((x:any)=>x.id===q.id?{...x,answer_outline:e.target.value}:x)})}/>
        <div className="mt-3 flex gap-2"><button disabled={saving} onClick={()=>saveQuestion(q)} className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white">Save</button><button onClick={()=>setEditing(null)} className="rounded-xl bg-slate-100 px-4 py-2 font-bold">Cancel</button></div>
      </div>:<><div className="flex items-center justify-between gap-4"><div><span className="text-xs font-black text-indigo-600">{q.id} • {q.category}</span><h3 className="mt-1 font-bold">{q.prompt}</h3></div><button onClick={()=>setEditing(q.id)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold">Edit</button></div><p className="mt-3 text-sm text-slate-600">{q.answer_outline}</p><div className="mt-3 text-xs text-slate-400">Requirements: {q.requirement_ids.join(", ")} • Difficulty {q.difficulty}</div></>}
    </div>)}</div>}

    {tab==="flashcards"&&<div className="grid gap-4 md:grid-cols-2">{kit.flashcards.map((f:any)=><div key={f.id} className="rounded-2xl bg-white p-6 shadow-sm"><div className="text-xs font-black text-indigo-600">{f.id}</div><h3 className="mt-2 font-black">{f.front}</h3><p className="mt-3 text-sm text-slate-600">{f.back}</p><div className="mt-3 text-xs text-slate-400">Confidence: {f.confidence??"Not practiced"}</div></div>)}</div>}

    {tab==="schedule"&&<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{kit.schedule.days.map((d:any)=><div key={d.day} className="rounded-2xl bg-white p-5 shadow-sm"><div className="text-xs font-black text-indigo-600">DAY {d.day}</div><h3 className="mt-1 font-black">{d.focus}</h3><p className="mt-2 text-sm text-slate-500">{d.minutes} minutes</p><div className="mt-4 text-xs text-slate-500">{d.question_ids.join(" • ")||"Review"}</div></div>)}</div>}

    {tab==="practice"&&<div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 text-center shadow-sm">{cards.length?<><div className="text-xs font-black uppercase text-indigo-600">Card {practiceIndex+1} / {cards.length}</div><h2 className="mt-5 text-2xl font-black">{cards[practiceIndex]?.front}</h2><details className="mt-6 rounded-2xl bg-slate-50 p-5 text-left"><summary className="cursor-pointer font-bold">Reveal answer</summary><p className="mt-3 text-slate-600">{cards[practiceIndex]?.back}</p></details><p className="mt-7 text-sm font-bold text-slate-500">How confident are you?</p><div className="mt-3 flex justify-center gap-2">{[1,2,3,4,5].map(v=><button key={v} onClick={()=>confidence(v)} className="rounded-xl bg-slate-900 px-4 py-3 font-bold text-white">{v}</button>)}</div></>:<p>No flashcards.</p>}</div>}
  </div>;
}
