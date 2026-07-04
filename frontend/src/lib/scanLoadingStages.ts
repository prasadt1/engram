export function triageScanStage(waitSec: number): string {
  if (waitSec < 5) return 'Looking through your portfolio…';
  if (waitSec < 15) return 'Grouping similar photos…';
  if (waitSec < 30) return 'Drafting label suggestions…';
  return 'Almost ready — still checking your library…';
}

export function printScanStage(waitSec: number): string {
  if (waitSec < 5) return 'Reviewing your strongest shots…';
  if (waitSec < 15) return 'Drafting titles and descriptions…';
  if (waitSec < 30) return 'Suggesting prices for each listing…';
  return 'Finishing listing proposals…';
}
