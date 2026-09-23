import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config";
import { connectDb } from "./db";
import { authRouter } from "./routes/auth";
import { kitsRouter } from "./routes/kits";
import { getJob } from "./services/jobs";

const app=express();
app.use(cors({origin:config.frontendOrigin,credentials:true}));
app.use(cookieParser());
app.use(express.json({limit:"1mb"}));

app.get("/api/health",(_req,res)=>res.json({ok:true,service:"trao-interview-prep"}));
app.use("/api/auth",authRouter);
app.use("/api/kits",kitsRouter);

app.get("/api/jobs/:id",(req,res)=>{
  const job=getJob(req.params.id);
  if(!job) return res.status(404).json({error:{code:"JOB_NOT_FOUND",message:"Generation job not found"}});
  res.json({job});
});

connectDb().then(()=>{
  app.listen(config.port,()=>console.log(`Backend: http://localhost:${config.port}`));
}).catch(err=>{
  console.error("Database connection failed",err);
  process.exit(1);
});
