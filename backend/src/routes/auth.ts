import { Router } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { loginSchema, registerSchema } from "../validation";
import { clearSession, setSession, authRequired } from "../utils/auth";

export const authRouter = Router();

authRouter.post("/register", async (req,res) => {
  try {
    const {email,password}=registerSchema.parse(req.body);
    const existing=await User.findOne({email});
    if(existing) return res.status(409).json({error:{code:"EMAIL_EXISTS",message:"An account with this email already exists."}});
    const passwordHash=await bcrypt.hash(password,12);
    const user=await User.create({email,passwordHash});
    setSession(res,String(user._id));
    res.json({user:{id:String(user._id),email:user.email}});
  } catch(e:any) {
    res.status(400).json({error:{code:"REGISTER_ERROR",message:e?.message||"Registration failed"}});
  }
});

authRouter.post("/login", async (req,res) => {
  try {
    const {email,password}=loginSchema.parse(req.body);
    const user=await User.findOne({email});
    if(!user || !(await bcrypt.compare(password,user.passwordHash))) {
      return res.status(401).json({error:{code:"INVALID_CREDENTIALS",message:"Invalid email or password"}});
    }
    setSession(res,String(user._id));
    res.json({user:{id:String(user._id),email:user.email}});
  } catch(e:any) {
    res.status(400).json({error:{code:"LOGIN_ERROR",message:e?.message||"Login failed"}});
  }
});

authRouter.post("/logout",(req,res)=>{ clearSession(res); res.json({ok:true}); });

authRouter.get("/me",authRequired,async(req,res)=>{
  const user=await User.findById((req as any).userId).select("email");
  if(!user) return res.status(401).json({error:{code:"USER_NOT_FOUND",message:"Session invalid"}});
  res.json({user:{id:String(user._id),email:user.email}});
});
