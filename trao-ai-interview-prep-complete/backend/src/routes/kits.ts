import { Router } from "express";
import { KitModel } from "../models/Kit";
import { authRequired } from "../utils/auth";
import { createKitSchema, editQuestionSchema, validateKitShape } from "../validation";
import { inputFingerprint } from "../services/pipeline";
import { startJob } from "../services/jobs";

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
