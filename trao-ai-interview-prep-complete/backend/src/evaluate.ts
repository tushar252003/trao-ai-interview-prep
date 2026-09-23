import fs from "node:fs";
import path from "node:path";
import { generateKitPipeline } from "./services/pipeline";
import { validateKitShape } from "./validation";

type Case={id:string;jd:string;company_url:string;days:number};

function arg(name:string) {
  const i=process.argv.indexOf(name);
  return i>=0?process.argv[i+1]:undefined;
}

async function main(){
  const input=arg("--input"), output=arg("--output");
  if(!input||!output) throw new Error("Usage: npm run evaluate -- --input <cases.json> --output <kits.json>");
  const cases=JSON.parse(fs.readFileSync(path.resolve(input),"utf8")) as Case[];
  const kits:any[]=[];

  for(const item of cases){
    try{
      const kit=await generateKitPipeline({jd:item.jd,company_url:item.company_url,days:item.days});
      validateKitShape(kit);
      kits.push({id:item.id,status:"ok",kit,error:null});
    }catch(e:any){
      kits.push({id:item.id,status:"failed",kit:null,error:{code:"CASE_FAILED",message:e?.message||"Unknown failure"}});
    }
  }

  fs.writeFileSync(path.resolve(output),JSON.stringify({
    version:"1.0",generated_at:new Date().toISOString(),kits
  },null,2));
  console.log(`Wrote ${kits.length} case(s) to ${output}`);
}
main().catch(e=>{console.error(e);process.exit(1);});
