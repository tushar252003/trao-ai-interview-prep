import { DayPlan, Question, Requirement } from "../types";

export function allocateSchedule(requirements: Requirement[], questions: Question[], daysAvailable: number): DayPlan[] {
  if (!Number.isInteger(daysAvailable) || daysAvailable < 1 || daysAvailable > 60) {
    throw new Error("daysAvailable must be an integer between 1 and 60");
  }

  const priority = new Map(requirements.map(r => [r.id, r.priority]));
  const sorted = [...questions].sort((a, b) => {
    const aMust = a.requirement_ids.some(id => priority.get(id) === "must");
    const bMust = b.requirement_ids.some(id => priority.get(id) === "must");
    if (aMust !== bMust) return aMust ? -1 : 1;
    return b.difficulty - a.difficulty;
  });

  const buckets: Question[][] = Array.from({ length: daysAvailable }, () => []);
  sorted.forEach((q, i) => buckets[Math.min(i, daysAvailable - 1)].push(q));

  const base = buckets.map((bucket, i) => ({
    day: i + 1,
    focus: bucket.length ? [...new Set(bucket.map(q => q.category))].slice(0, 2).join(" + ") : "Review",
    question_ids: bucket.map(q => q.id),
    minutes: 0
  }));

  // Spread minutes while keeping integer values and exact day count.
  for (const d of base) d.minutes = Math.max(30, d.question_ids.length * 20);
  return base;
}
