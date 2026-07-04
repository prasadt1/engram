/** Human-readable skill / dimension label from snake_case API values. */
export function formatSkillLabel(skill: string): string {
  return skill
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
