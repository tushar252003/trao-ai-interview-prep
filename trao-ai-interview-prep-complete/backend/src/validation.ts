import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

export const loginSchema = registerSchema;

export const createKitSchema = z.object({
  jd: z.string().min(2).max(100_000),
  company_url: z.string().url(),
  days: z.number().int().min(1).max(60)
});

export const editQuestionSchema = z.object({
  prompt: z.string().min(1),
  answer_outline: z.string().min(1),
  category: z.enum(["technical", "behavioural", "system-design", "company-fit"]),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)])
});

export function validateKitShape(kit: any) {
  const fields = ["source", "company_brief", "role", "questions", "flashcards", "schedule", "coverage"];
  for (const f of fields) if (!(f in kit)) throw new Error(`Missing kit field: ${f}`);
  if (!Array.isArray(kit.role.requirements)) throw new Error("requirements must be an array");
  if (!Array.isArray(kit.questions)) throw new Error("questions must be an array");
  if (!Array.isArray(kit.flashcards)) throw new Error("flashcards must be an array");
  if (kit.schedule.days_available !== kit.schedule.days.length) throw new Error("Schedule day count mismatch");

  const reqIds = new Set(kit.role.requirements.map((r: any) => r.id));
  for (const r of kit.role.requirements) {
    if (!r.id || !r.text || !["technical", "behavioural", "domain"].includes(r.kind) || !["must", "nice"].includes(r.priority)) {
      throw new Error(`Invalid requirement ${r.id}`);
    }
  }
  const qIds = new Set(kit.questions.map((q: any) => q.id));
  for (const q of kit.questions) {
    if (!q.id || !Array.isArray(q.requirement_ids) || !q.requirement_ids.every((id: string) => reqIds.has(id))) {
      throw new Error(`Invalid requirement reference in ${q.id}`);
    }
    if (![1, 2, 3].includes(q.difficulty)) throw new Error(`Invalid difficulty in ${q.id}`);
  }
  for (const d of kit.schedule.days) {
    if (!Number.isInteger(d.minutes) || d.minutes < 0) throw new Error(`Invalid minutes on day ${d.day}`);
    for (const qid of d.question_ids) if (!qIds.has(qid)) throw new Error(`Unknown scheduled question ${qid}`);
  }
  return true;
}
