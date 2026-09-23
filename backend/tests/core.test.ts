import { describe, expect, it } from "vitest";
import { findUncoveredRequirements } from "../src/services/coverage";
import { allocateSchedule } from "../src/services/schedule";
import { validateKitShape } from "../src/validation";

const reqs:any[]=[
  {id:"r1",text:"React",kind:"technical",priority:"must"},
  {id:"r2",text:"Communication",kind:"behavioural",priority:"must"},
  {id:"r3",text:"Docker",kind:"technical",priority:"nice"}
];

describe("coverage",()=>{
  it("finds uncovered must-have requirements",()=>{
    expect(findUncoveredRequirements(reqs,[{
      id:"q1",requirement_ids:["r1"],category:"technical",
      prompt:"React?",answer_outline:"...",difficulty:2
    }])).toEqual(["r2"]);
  });
});

describe("schedule",()=>{
  it("returns exactly requested number of days",()=>{
    const qs=reqs.map((r,i)=>({
      id:`q${i+1}`,requirement_ids:[r.id],category:"technical",
      prompt:"x",answer_outline:"x",difficulty:2
    }));
    const days=allocateSchedule(reqs,qs,5);
    expect(days).toHaveLength(5);
    expect(days.every(d=>Number.isInteger(d.minutes))).toBe(true);
  });
});

describe("structure validation",()=>{
  it("accepts Appendix A-shaped kit",()=>{
    const kit:any={
      source:{company:"Acme",company_url:"https://acme.com",role:"Engineer",location:"",jd_chars:10,researched_at:"",pages_used:[]},
      company_brief:{summary:"",what_they_do:"",sources:[]},
      role:{title:"Engineer",seniority:"",responsibilities:[],requirements:reqs},
      questions:[{id:"q1",requirement_ids:["r1"],category:"technical",prompt:"x",answer_outline:"x",difficulty:2}],
      flashcards:[{id:"f1",front:"x",back:"x",requirement_ids:["r1"]}],
      schedule:{days_available:1,days:[{day:1,focus:"x",question_ids:["q1"],minutes:30}]},
      coverage:{uncovered_requirement_ids:[],passes:2}
    };
    expect(validateKitShape(kit)).toBe(true);
  });
});
