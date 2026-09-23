import crypto from "node:crypto";
import { generateKitPipeline, PipelineInput, ProgressEvent } from "./pipeline";

type Job = {
  id: string;
  status: "running"|"complete"|"failed";
  progress: ProgressEvent;
  kit?: any;
  error?: any;
  createdAt: number;
};

const jobs = new Map<string, Job>();

export function getJob(id:string) { return jobs.get(id); }

export function startJob(input:PipelineInput) {
  const id = crypto.randomUUID();
  const job:Job = {
    id, status:"running",
    progress:{stage:"queued",percent:1,message:"Queued"},
    createdAt:Date.now()
  };
  jobs.set(id,job);

  generateKitPipeline(input,p=>{
    const current=jobs.get(id);
    if(current) current.progress=p;
  }).then(kit=>{
    const current=jobs.get(id);
    if(current) { current.status="complete"; current.kit=kit; current.progress={stage:"complete",percent:100,message:"Complete"}; }
  }).catch(error=>{
    const current=jobs.get(id);
    if(current) { current.status="failed"; current.error={code:"GENERATION_FAILED",message:error?.message||"Generation failed"}; current.progress={stage:"failed",percent:100,message:"Generation failed"}; }
  });

  return id;
}
