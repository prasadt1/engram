import { BrandLogo, type LogoDirection } from './BrandLogo';

const OPTIONS: {
  direction: LogoDirection;
  label: string;
  subtitle: string;
  luxury: string;
}[] = [
  {
    direction: 'current',
    label: 'A — Current',
    subtitle: 'Detailed mark + horizontal Iris',
    luxury: 'Confident, but mark reads busy at sidebar size',
  },
  {
    direction: 'simplified',
    label: 'B — Simplified mark',
    subtitle: 'Calmer aperture, fewer fibers, more air',
    luxury: 'Restrained — mark as quiet jewel beside type',
  },
  {
    direction: 'typography-led',
    label: 'C — Typography-led',
    subtitle: 'Newsreader carries; mark is a small accent',
    luxury: 'Editorial / premium — type does the work',
  },
];

function SidebarMock({ direction }: { direction: LogoDirection }) {
  return (
    <div className="w-52 shrink-0 border border-warm bg-canvas rounded-lg overflow-hidden shadow-xl">
      <div className="sidebar-logo-zone flex items-center p-4 border-b border-warm min-h-[72px]">
        <BrandLogo variant="horizontal" direction={direction} />
      </div>
      <div className="px-2 py-3 space-y-1">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-500/15 text-stone-100 text-sm border-l-2 border-brand-400">
          Home
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-muted text-sm">
          My Work
        </div>
      </div>
    </div>
  );
}

export function LogoComparison() {
  return (
    <div className="min-h-screen bg-[#141210] text-stone-200 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-brand-400">Brand identity</p>
          <h1 className="font-serif text-3xl md:text-4xl text-stone-100">Pick a sidebar lockup</h1>
          <p className="text-stone-500 text-sm max-w-xl">
            Three directions at real sidebar size on dark canvas. The tittle/merged hero lockup stays
            separate for onboarding — this comparison is for the everyday nav mark.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {OPTIONS.map((opt) => (
            <article
              key={opt.direction}
              className="rounded-xl border border-warm/80 bg-canvas-elevated/40 p-4 space-y-4"
            >
              <div>
                <h2 className="font-serif text-lg text-stone-100">{opt.label}</h2>
                <p className="text-sm text-stone-400 mt-1">{opt.subtitle}</p>
                <p className="text-xs text-stone-500 mt-2 italic">{opt.luxury}</p>
              </div>
              <SidebarMock direction={opt.direction} />
            </article>
          ))}
        </div>

        <section className="rounded-xl border border-warm/60 bg-canvas/50 p-6 space-y-4">
          <h2 className="font-serif text-lg text-stone-100">Reference — tittle hero lockup</h2>
          <p className="text-sm text-stone-500">
            Mark over the first i — for onboarding/marketing only. Feels less premium at small sizes;
            keep for hero where it can breathe.
          </p>
          <div className="flex justify-center py-8 bg-canvas rounded-lg border border-warm">
            <BrandLogo variant="tittle" size={48} />
          </div>
        </section>

        <p className="text-center text-xs text-stone-600">
          Remove <code className="text-stone-500">#logo-compare</code> from the URL to return to the app.
        </p>
      </div>
    </div>
  );
}
