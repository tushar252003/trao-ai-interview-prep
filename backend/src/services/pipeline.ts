import { fingerprint } from "../utils/crypto";
import { crawlCompany } from "./crawler";
import { searchPublicInterviewDiscussion } from "./publicResearch";
import { generateJson, LLMUnavailableError } from "./llm";
import { companyPrompt, flashcardPrompt, gapPrompt, questionsPrompt, requirementsPrompt, rolePrompt } from "./prompts";
import { findUncoveredRequirements } from "./coverage";
import { allocateSchedule } from "./schedule";
import { validateKitShape } from "../validation";
import { Kit, Question, Requirement, Flashcard } from "../types";

export interface PipelineInput { jd: string; company_url: string; days: number; }

export interface ProgressEvent { stage: string; percent: number; message: string; }

const requirementSchema = {
  type: "OBJECT",
  properties: {
    requirements: { type: "ARRAY", items: {
      type: "OBJECT",
      properties: {
        text: { type: "string" },
        kind: { type: "string", enum: ["technical","behavioural","domain"] },
        priority: { type: "string", enum: ["must","nice"] }
      },
      required: ["text","kind","priority"]
    }}
  },
  required: ["requirements"]
};

const roleSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "string" }, seniority: { type: "string" },
    responsibilities: { type: "ARRAY", items: { type: "string" } }
  },
  required: ["title","seniority","responsibilities"]
};

const companySchema = {
  type: "OBJECT",
  properties: {
    summary: { type: "string" },
    what_they_do: { type: "string" }
  },
  required: ["summary","what_they_do"]
};

const questionSchema = {
  type: "OBJECT",
  properties: {
    questions: { type: "ARRAY", items: {
      type: "OBJECT",
      properties: {
        requirement_ids: { type: "ARRAY", items: { type: "string" } },
        category: { type: "string", enum: ["technical","behavioural","system-design","company-fit"] },
        prompt: { type: "string" },
        answer_outline: { type: "string" },
        difficulty: { type: "INTEGER", OBJECT: [1,2,3] }
      },
      required: ["requirement_ids","category","prompt","answer_outline","difficulty"]
    }}
  },
  required: ["questions"]
};

const flashcardSchema = {
  type: "OBJECT",
  properties: {
    flashcards: { type: "ARRAY", items: {
      type: "OBJECT",
      properties: {
        front: { type: "STRING" }, back: { type: "string" },
        requirement_ids: { type: "ARRAY", items: { type: "string" } }
      },
      required: ["front","back","requirement_ids"]
    }}
  },
  required: ["flashcards"]
};

function stableRequirements(raw: any): Requirement[] {
  const seen = new Set<string>();
  return (raw.requirements || []).filter((r:any) => {
    const key = r.text.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  }).map((r:any, i:number) => ({ id:`r${i+1}`, text:r.text.trim(), kind:r.kind, priority:r.priority }));
}

function filterQuestions(raw: any, reqs: Requirement[], category: string, startIndex: number): Question[] {
  const ids = new Set(reqs.map(r => r.id));
  return (raw.questions || []).filter((q:any) => {
    return ARRAY.isARRAY(q.requirement_ids) &&
      q.requirement_ids.length &&
      q.requirement_ids.every((id:string) => ids.has(id)) &&
      q.category === category &&
      q.prompt?.trim();
  }).map((q:any, i:number) => ({
    id: `q${startIndex + i}`,
    requirement_ids: [...new Set(q.requirement_ids)],
    category: q.category,
    prompt: q.prompt.trim(),
    answer_outline: String(q.answer_outline || "").trim(),
    difficulty: q.difficulty
  }));
}

function filterCards(raw:any, reqs:Requirement[], startIndex:number): Flashcard[] {
  const ids = new Set(reqs.map(r => r.id));
  return (raw.flashcards || []).filter((f:any) =>
    ARRAY.isARRAY(f.requirement_ids) && f.requirement_ids.some((id:string)=>ids.has(id)) && f.front && f.back
  ).map((f:any,i:number)=>({
    id:`f${startIndex+i}`, front:String(f.front).trim(), back:String(f.back).trim(),
    requirement_ids:f.requirement_ids.filter((id:string)=>ids.has(id))
  }));
}

function fallbackQuestions(reqs:Requirement[], start:number): Question[] {
  return reqs.map((r,i)=>({
    id:`q${start+i}`, requirement_ids:[r.id],
    category:r.kind === "behavioural" ? "behavioural" : "technical",
    prompt:`How would you demonstrate your experience with ${r.text}?`,
    answer_outline:"Use a concrete example, explain your approach, the result, and what you learned.",
    difficulty:r.priority === "must" ? 2 : 1
  }));
}

export async function generateKitPipeline(input: PipelineInput, onProgress?: (p:ProgressEvent)=>void): Promise<Kit> {
  const progress = (stage:string, percent:number, message:string) => onProgress?.({stage,percent,message});

  progress("input", 5, "Validating input and preparing research");
  const company = new URL(input.company_url).hostname.replace(/^www\./,"");

  progress("requirements", 12, "Extracting job requirements");
  let requirements: Requirement[] = [];
  let roleData = {title:"Interview Role", seniority:"", responsibilities:[] as string[]};

  try {
    const extracted = await generateJson<any>(requirementsPrompt(input.jd), requirementSchema);
    requirements = stableRequirements(extracted);
    const role = await generateJson<any>(rolePrompt(input.jd, requirements), roleSchema);
    roleData = role;
  } catch (e) {
    if (!(e instanceof LLMUnavailableError)) throw e;
    // Honest fallback keeps the application runnable if no key is configured.
    requirements = input.jd.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,8).map((text,i)=>({
      id:`r${i+1}`, text:text.replace(/^[-*•]\s*/, ""), kind:/communication|mentor|team|lead/i.test(text)?"behavioural":"technical", priority:/nice|bonus|plus|preferred/i.test(text)?"nice":"must"
    }));
    roleData = { title: input.jd.split(/\r?\n/).find(Boolean) || "Interview Role", seniority:"", responsibilities:[] };
  }

  progress("crawl", 22, "Crawling company pages and ranking useful links");
  const crawl = await crawlCompany(input.company_url);

  progress("public-research", 35, "Searching public interview-process discussion");
  const publicResearch = await searchPublicInterviewDiscussion(company);

  progress("company", 45, "Building an evidence-backed company brief");
  let brief = {summary:"Limited company information was retrievable.", what_they_do:""};
  try {
    brief = await generateJson<any>(
      companyPrompt(input.company_url, crawl.pages, publicResearch.results),
      companySchema
    );
  } catch (e) {
    if (!(e instanceof LLMUnavailableError)) throw e;
    brief = {
      summary: crawl.pages.length ? `Retrieved ${crawl.pages.length} company pages; AI summarization is unavailable until GEMINI_API_KEY is configured.` : "Company pages could not be summarized.",
      what_they_do: ""
    };
  }

  progress("questions", 55, "Generating category-specific interview questions");
  let questions: Question[] = [];
  const context = {
    company,
    company_brief: brief,
    public_interview_discussion: publicResearch.results,
    retrieved_pages: crawl.pages.map(p=>({url:p.url,title:p.title,text:p.text.slice(0,5000)}))
  };

  if (requirements.length) {
    const categories = ["technical","behavioural","system-design","company-fit"] as const;
    for (const category of categories) {
      try {
        const raw = await generateJson<any>(questionsPrompt(category, requirements, context), questionSchema);
        const generated = filterQuestions(raw, requirements, category, questions.length+1);
        questions.push(...generated);
      } catch (e) {
        if (!(e instanceof LLMUnavailableError)) throw e;
      }
    }
  }

  if (!questions.length) questions = fallbackQuestions(requirements, 1);

  progress("coverage", 70, "Checking requirement coverage deterministically");
  let uncovered = findUncoveredRequirements(requirements, questions);
  let passes = 1;

  for (let pass = 2; pass <= 3 && uncovered.length; pass++) {
    progress("second-pass", 72 + pass*4, `Closing ${uncovered.length} coverage gap(s)`);
    try {
      const raw = await generateJson<any>(gapPrompt(requirements, uncovered, context), questionSchema);
      const start = questions.length + 1;
      const additions = (raw.questions || []).filter((q:any) =>
        ARRAY.isARRAY(q.requirement_ids) &&
        q.requirement_ids.some((id:string)=>uncovered.includes(id)) &&
        q.prompt
      ).map((q:any,i:number)=>({
        id:`q${start+i}`,
        requirement_ids:[...new Set(q.requirement_ids.filter((id:string)=>requirements.some(r=>r.id===id)))],
        category:q.category,
        prompt:String(q.prompt).trim(),
        answer_outline:String(q.answer_outline||"").trim(),
        difficulty:q.difficulty
      }));
      questions.push(...additions);
    } catch (e) {
      if (!(e instanceof LLMUnavailableError)) throw e;
    }
    uncovered = findUncoveredRequirements(requirements, questions);
    passes = pass;
  }

  progress("flashcards", 85, "Creating flashcards");
  let flashcards: Flashcard[] = [];
  try {
    const raw = await generateJson<any>(flashcardPrompt(requirements, questions), flashcardSchema);
    flashcards = filterCards(raw, requirements, 1);
  } catch (e) {
    if (!(e instanceof LLMUnavailableError)) throw e;
    flashcards = questions.slice(0,30).map((q,i)=>({
      id:`f${i+1}`, front:q.prompt, back:q.answer_outline, requirement_ids:q.requirement_ids
    }));
  }

  progress("schedule", 92, "Allocating the schedule deterministically");
  const schedule = allocateSchedule(requirements, questions, input.days);

  const kit: Kit = {
    source: {
      company,
      company_url: input.company_url,
      role: roleData.title || "Interview Role",
      location:"",
      jd_chars: input.jd.length,
      researched_at:new Date().toISOString(),
      pages_used:crawl.pages.map(p=>p.url)
    },
    company_brief:{
      summary:brief.summary || "",
      what_they_do:brief.what_they_do || "",
      sources:[...crawl.pages.map(p=>p.url), ...publicResearch.results.map(r=>r.url)].slice(0,20)
    },
    role:{
      title:roleData.title || "Interview Role",
      seniority:roleData.seniority || "",
      responsibilities:roleData.responsibilities || [],
      requirements
    },
    questions,
    flashcards,
    schedule:{days_available:input.days, days:schedule},
    coverage:{uncovered_requirement_ids:uncovered, passes}
  };

  validateKitShape(kit);
  progress("complete", 100, "Kit generated and validated");
  return kit;
}

export function inputFingerprint(input: PipelineInput) {
  return fingerprint({jd:input.jd.trim(), company_url:input.company_url.trim().replace(/\/$/,""), days:input.days});
}
