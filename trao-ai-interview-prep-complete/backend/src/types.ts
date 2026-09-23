export type RequirementKind = "technical" | "behavioural" | "domain";
export type Priority = "must" | "nice";
export type QuestionCategory = "technical" | "behavioural" | "system-design" | "company-fit";
export type ItemState = "generated" | "edited" | "pinned";

export interface Requirement {
  id: string;
  text: string;
  kind: RequirementKind;
  priority: Priority;
}

export interface Question {
  id: string;
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
  _state?: ItemState;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
  _state?: ItemState;
  confidence?: number | null;
  practice_count?: number;
  last_practiced_at?: string | null;
}

export interface DayPlan {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

export interface Kit {
  source: {
    company: string;
    company_url: string;
    role: string;
    location: string;
    jd_chars: number;
    researched_at: string;
    pages_used: string[];
  };
  company_brief: { summary: string; what_they_do: string; sources: string[] };
  role: {
    title: string;
    seniority: string;
    responsibilities: string[];
    requirements: Requirement[];
  };
  questions: Question[];
  flashcards: Flashcard[];
  schedule: { days_available: number; days: DayPlan[] };
  coverage: { uncovered_requirement_ids: string[]; passes: number };
}
