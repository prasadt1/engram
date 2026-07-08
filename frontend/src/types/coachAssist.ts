export interface CoachAssistWatchingSkill {
  name: string;
  consecutive: number;
}

export interface CoachAssistAssignmentSummary {
  id: string;
  targetSkill: string;
  brief: string;
  status?: string;
}

export interface CoachAssistLearner {
  userId: string;
  displayName: string;
  arcLabel: string;
  photoCount: number;
  identity: string | null;
  currentFocus: string | null;
  clearedSkills: string[];
  watchingSkills: CoachAssistWatchingSkill[];
  memoryLine: string;
  activeAssignment: CoachAssistAssignmentSummary | null;
  proposedAssignment: CoachAssistAssignmentSummary | null;
}

export interface CoachAssistRoster {
  learners: CoachAssistLearner[];
}
