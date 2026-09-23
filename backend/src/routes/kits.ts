import { Router } from "express";
import { KitModel } from "../models/Kit";
import { authRequired } from "../utils/auth";
import { createKitSchema, editQuestionSchema, validateKitShape } from "../validation";
import { inputFingerprint } from "../services/pipeline";
import { startJob } from "../services/jobs";
import { crawlCompany } from "../services/crawler";
import { searchPublicInterviewDiscussion } from "../services/publicResearch";
import { generateJson } from "../services/llm";
import { companyPrompt, questionsPrompt } from "../services/prompts";
import { allocateSchedule } from "../services/schedule";

export const kitsRouter = Router();
kitsRouter.use(authRequired);

kitsRouter.get("/",async(req,res)=>{
  const kits=await KitModel.find({userId:(req as any).userId}).sort({createdAt:-1}).select("source role.title schedule.days_available coverage createdAt updatedAt");
  res.json({kits});
});

kitsRouter.get("/:id",async(req,res)=>{
  const kit=await KitModel.findOne({_id:req.params.id,userId:(req as any).userId});
  if(!kit) return res.status(404).json({error:{code:"NOT_FOUND",message:"Kit not found"}});
  res.json({kit});
});

kitsRouter.post("/generate",async(req,res)=>{
  try {
    const input=createKitSchema.parse(req.body);
    const id=startJob(input);
    res.status(202).json({jobId:id});
  } catch(e:any) {
    res.status(400).json({error:{code:"INPUT_ERROR",message:e?.message||"Invalid input"}});
  }
});

kitsRouter.post("/save-generated",async(req,res)=>{
  try {
    const input=createKitSchema.parse(req.body.input);
    const kit=req.body.kit;
    validateKitShape(kit);
    const userId=(req as any).userId;
    const fp=inputFingerprint(input);
    const saved=await KitModel.findOneAndUpdate(
      {userId,fingerprint:fp},
      {...kit,userId,fingerprint:fp},
      {new:true,upsert:true,setDefaultsOnInsert:true}
    );
    res.json({kit:saved});
  } catch(e:any) {
    res.status(400).json({error:{code:"SAVE_ERROR",message:e?.message||"Save failed"}});
  }
});

kitsRouter.patch("/:id/question/:qid",async(req,res)=>{
  try {
    const patch=editQuestionSchema.parse(req.body);
    const kit=await KitModel.findOne({_id:req.params.id,userId:(req as any).userId});
    if(!kit) return res.status(404).json({error:{code:"NOT_FOUND",message:"Kit not found"}});
    const q=(kit.questions as any[]).find(x=>x.id===req.params.qid);
    if(!q) return res.status(404).json({error:{code:"QUESTION_NOT_FOUND",message:"Question not found"}});
    Object.assign(q,patch,{_state:"edited"});
    await kit.save();
    res.json({kit});
  } catch(e:any) {
    res.status(400).json({error:{code:"EDIT_ERROR",message:e?.message||"Edit failed"}});
  }
});

kitsRouter.patch("/:id/flashcard/:fid",async(req,res)=>{
  const kit=await KitModel.findOne({_id:req.params.id,userId:(req as any).userId});
  if(!kit) return res.status(404).json({error:{code:"NOT_FOUND",message:"Kit not found"}});
  const f=(kit.flashcards as any[]).find(x=>x.id===req.params.fid);
  if(!f) return res.status(404).json({error:{code:"FLASHCARD_NOT_FOUND",message:"Flashcard not found"}});
  if(typeof req.body.front==="string") f.front=req.body.front;
  if(typeof req.body.back==="string") f.back=req.body.back;
  f._state="edited";
  await kit.save();
  res.json({kit});
});

kitsRouter.patch("/:id/reorder",async(req,res)=>{
  const kit=await KitModel.findOne({_id:req.params.id,userId:(req as any).userId});
  if(!kit) return res.status(404).json({error:{code:"NOT_FOUND",message:"Kit not found"}});
  const ids=req.body.question_ids;
  if(!Array.isArray(ids)) return res.status(400).json({error:{code:"INVALID_ORDER",message:"question_ids required"}});
  const map=new Map((kit.questions as any[]).map(q=>[q.id,q]));
  const reordered=ids.map((id:string)=>map.get(id)).filter(Boolean);
  const remaining=(kit.questions as any[]).filter(q=>!ids.includes(q.id));
  kit.questions=[...reordered,...remaining] as any;
  await kit.save();
  res.json({kit});
});

kitsRouter.patch("/:id/confidence/:fid",async(req,res)=>{
  const kit=await KitModel.findOne({_id:req.params.id,userId:(req as any).userId});
  if(!kit) return res.status(404).json({error:{code:"NOT_FOUND",message:"Kit not found"}});
  const f=(kit.flashcards as any[]).find(x=>x.id===req.params.fid);
  if(!f) return res.status(404).json({error:{code:"FLASHCARD_NOT_FOUND",message:"Flashcard not found"}});
  const confidence=Number(req.body.confidence);
  if(![1,2,3,4,5].includes(confidence)) return res.status(400).json({error:{code:"INVALID_CONFIDENCE",message:"Confidence must be 1-5"}});
  f.confidence=confidence;
  f.practice_count=(f.practice_count||0)+1;
  f.last_practiced_at=new Date().toISOString();
  await kit.save();
  res.json({kit});
});


kitsRouter.patch("/:id/company-brief",async(req,res)=>{
  const kit=await KitModel.findOne({_id:req.params.id,userId:(req as any).userId});
  if(!kit) return res.status(404).json({error:{code:"NOT_FOUND",message:"Kit not found"}});
  if(typeof req.body.summary!=="string" || typeof req.body.what_they_do!=="string") return res.status(400).json({error:{code:"INVALID_BRIEF",message:"summary and what_they_do are required"}});
  (kit as any).company_brief.summary=req.body.summary;
  (kit as any).company_brief.what_they_do=req.body.what_they_do;
  await kit.save();
  res.json({kit});
});

kitsRouter.post("/:id/regenerate",async(req,res)=>{
  try{
    const kit:any=await KitModel.findOne({_id:req.params.id,userId:(req as any).userId});
    if(!kit) return res.status(404).json({error:{code:"NOT_FOUND",message:"Kit not found"}});
    const section=req.body.section;
    if(!["company_brief","questions","schedule"].includes(section)) return res.status(400).json({error:{code:"INVALID_SECTION",message:"Unsupported section"}});

    if(section==="schedule"){
      const schedule=allocateSchedule(kit.role.requirements,kit.questions,kit.schedule.days_available);
      kit.schedule={days_available:kit.schedule.days_available,days:schedule};
    } else {
      const crawl=await crawlCompany(kit.source.company_url);
      const publicResearch=await searchPublicInterviewDiscussion(kit.source.company);
      const context={company:kit.source.company,company_brief:kit.company_brief,public_interview_discussion:publicResearch.results,retrieved_pages:crawl.pages.map(p=>({url:p.url,title:p.title,text:p.text.slice(0,5000)}))};
      if(section==="company_brief"){
        const schema={type:"object",properties:{summary:{type:"string"},what_they_do:{type:"string"}},required:["summary","what_they_do"]};
        const brief=await generateJson<any>(companyPrompt(kit.source.company_url,crawl.pages,publicResearch.results),schema);
        kit.company_brief={summary:brief.summary||"",what_they_do:brief.what_they_do||"",sources:[...crawl.pages.map(p=>p.url),...publicResearch.results.map(r=>r.url)].slice(0,20)};
      } else {
        const category=req.body.category;
        if(!["technical","behavioural","system-design","company-fit"].includes(category)) return res.status(400).json({error:{code:"INVALID_CATEGORY",message:"category required"}});
        const schema={type:"object",properties:{questions:{type:"array",items:{type:"object",properties:{requirement_ids:{type:"array",items:{type:"string"}},category:{type:"string",enum:["technical","behavioural","system-design","company-fit"]},prompt:{type:"string"},answer_outline:{type:"string"},difficulty:{type:"integer",enum:[1,2,3]}},required:["requirement_ids","category","prompt","answer_outline","difficulty"]}}},required:["questions"]};
        const raw=await generateJson<any>(questionsPrompt(category,kit.role.requirements,context),schema);
        const existing=(kit.questions as any[]).filter(q=>q.category===category);
        const edited=existing.filter(q=>q._state==="edited"||q._state==="pinned");
        const ids=new Set(kit.role.requirements.map((r:any)=>r.id));
        const generated=(raw.questions||[]).filter((q:any)=>Array.isArray(q.requirement_ids)&&q.requirement_ids.length&&q.requirement_ids.every((id:string)=>ids.has(id))&&q.prompt).map((q:any,i:number)=>({id:`qregen-${Date.now()}-${i+1}`,requirement_ids:[...new Set(q.requirement_ids)],category:q.category,prompt:String(q.prompt).trim(),answer_outline:String(q.answer_outline||"").trim(),difficulty:q.difficulty,_state:"generated"}));
        kit.questions=[...(kit.questions as any[]).filter(q=>q.category!==category),...edited,...generated];
      }
    }
    validateKitShape(kit.toObject());
    await kit.save();
    res.json({kit});
  }catch(e:any){res.status(400).json({error:{code:"REGENERATION_ERROR",message:e?.message||"Regeneration failed"}})}
});

kitsRouter.post("/:id/question",async(req,res)=>{
  const kit:any=await KitModel.findOne({_id:req.params.id,userId:(req as any).userId});
  if(!kit) return res.status(404).json({error:{code:"NOT_FOUND",message:"Kit not found"}});
  const q=req.body;
  if(!q?.prompt) return res.status(400).json({error:{code:"INVALID_QUESTION",message:"prompt required"}});
  const id=`qmanual-${Date.now()}`;
  kit.questions.push({id,requirement_ids:Array.isArray(q.requirement_ids)?q.requirement_ids:[],category:q.category||"technical",prompt:q.prompt,answer_outline:q.answer_outline||"",difficulty:q.difficulty||2,_state:"pinned"});
  await kit.save(); res.json({kit});
});

kitsRouter.delete("/:id/question/:qid",async(req,res)=>{
  const kit:any=await KitModel.findOne({_id:req.params.id,userId:(req as any).userId});
  if(!kit) return res.status(404).json({error:{code:"NOT_FOUND",message:"Kit not found"}});
  kit.questions=kit.questions.filter((q:any)=>q.id!==req.params.qid);
  kit.schedule.days=kit.schedule.days.map((d:any)=>({...d,question_ids:d.question_ids.filter((id:string)=>id!==req.params.qid)}));
  await kit.save(); res.json({kit});
});

kitsRouter.post("/:id/flashcard",async(req,res)=>{
  const kit:any=await KitModel.findOne({_id:req.params.id,userId:(req as any).userId});
  if(!kit) return res.status(404).json({error:{code:"NOT_FOUND",message:"Kit not found"}});
  const f=req.body;
  if(!f?.front||!f?.back) return res.status(400).json({error:{code:"INVALID_FLASHCARD",message:"front and back required"}});
  kit.flashcards.push({id:`fmanual-${Date.now()}`,front:f.front,back:f.back,requirement_ids:Array.isArray(f.requirement_ids)?f.requirement_ids:[],_state:"pinned",confidence:null,practice_count:0});
  await kit.save(); res.json({kit});
});

kitsRouter.delete("/:id/flashcard/:fid",async(req,res)=>{
  const kit:any=await KitModel.findOne({_id:req.params.id,userId:(req as any).userId});
  if(!kit) return res.status(404).json({error:{code:"NOT_FOUND",message:"Kit not found"}});
  kit.flashcards=kit.flashcards.filter((f:any)=>f.id!==req.params.fid);
  await kit.save(); res.json({kit});
});
