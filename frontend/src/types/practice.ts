export type AssignmentStatus = 'proposed' | 'active' | 'completed' | 'abandoned';

export type UserMode = 'hobbyist' | 'working_pro';

export interface SkillDelta {
  metric: string;
  baseline_value: number;
  current_value: number;
  delta: number;
}

export interface Assignment {
  id: string;
  userId: string;
  status: AssignmentStatus;
  brief: string;
  targetSkill: string;
  rationale: string;
  baselineShootIds: string[];
  completionShootIds: string[];
  skillDelta: SkillDelta | null;
  /** Set when assignment is completed; null for older rows. */
  appliedBrief: boolean | null;
  createdAt: string;
  completedAt: string | null;
}

export interface AssignmentsResponse {
  proposed: Assignment[];
  active: Assignment[];
  completed: Assignment[];
}

export interface ReflectionResult {
  summary: string;
  appliedBrief: boolean;
  skillDelta: SkillDelta;
  baselinePhotoCount?: number;
  practicePhotoCount?: number;
}

export interface CompleteAssignmentResponse {
  assignment: Assignment;
  reflection: ReflectionResult;
}
