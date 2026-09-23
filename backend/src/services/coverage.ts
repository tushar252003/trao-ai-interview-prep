import { Question, Requirement } from "../types";

export function findUncoveredRequirements(requirements: Requirement[], questions: Question[]) {
  const covered = new Set<string>();
  questions.forEach(q => q.requirement_ids.forEach(id => covered.add(id)));
  return requirements.filter(r => r.priority === "must" && !covered.has(r.id)).map(r => r.id);
}
