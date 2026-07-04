/** Strip internal Mongo ids from HITL copy shown to photographers. */
export function humanizeOrganizeReasoning(reasoning: string): string {
  return reasoning
    .replace(/Shoot [a-f0-9]{24}\s+has/gi, 'This batch has')
    .replace(/from shoot [a-f0-9]{24}/gi, 'from the same shoot')
    .replace(/\bshoot [a-f0-9]{24}\b/gi, 'the same shoot');
}
