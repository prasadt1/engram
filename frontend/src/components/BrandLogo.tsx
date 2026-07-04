import { IrisMark } from './IrisMark';
import { useThemeMode } from '../lib/ThemeContext';

/** Mark diameter ≈ 1.75× wordmark em-size (reads larger than cap height). */
const MARK_SCALE = 1.75;

export type LogoDirection = 'current' | 'simplified' | 'typography-led';

const HORIZONTAL_PRESETS: Record<
  LogoDirection,
  { size: number; markSize?: number; fontWeight: number; gap: string; letterSpacing: string; extraBold: boolean }
> = {
  current: { size: 20, markSize: 34, fontWeight: 600, gap: '0.4em', letterSpacing: '-0.01em', extraBold: true },
  simplified: { size: 18, markSize: 32, fontWeight: 600, gap: '0.42em', letterSpacing: '0.02em', extraBold: true },
  'typography-led': { size: 24, markSize: 20, fontWeight: 500, gap: '0.52em', letterSpacing: '0.05em', extraBold: false },
};

export function BrandLogo({
  size,
  variant = 'horizontal',
  direction = 'simplified',
  markSize,
  markScale = MARK_SCALE,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for API compatibility with mark/tittle variants
  extraBold = false,
  animate = false,
  className = '',
}: {
  size?: number;
  variant?: 'horizontal' | 'tittle' | 'mark' | 'stacked';
  direction?: LogoDirection;
  markSize?: number;
  markScale?: number;
  extraBold?: boolean;
  animate?: boolean;
  className?: string;
}) {
  const theme = useThemeMode();
  const isLight = theme === 'light';
  const markColor = isLight ? '#b45309' : '#f5a623';
  const markRim = isLight ? '#b45309' : '#fbbf24';
  const textColor = isLight ? '#292524' : '#e8e0d6';
  const preset = HORIZONTAL_PRESETS[direction];

  const markProps = {
    color: markColor,
    pupilRim: markRim,
    animate,
  };

  if (variant === 'mark') {
    const soloMark = markSize ?? Math.round((size ?? 28) * markScale);
    return (
      <span className={`inline-flex items-center leading-none ${className}`}>
        <IrisMark size={soloMark} {...markProps} />
        <span className="sr-only">Engram</span>
      </span>
    );
  }

  if (variant === 'tittle') {
    const tittleSize = size ?? 48;
    const mergedMarkSize = markSize ?? Math.round(tittleSize * 0.72);
    const markBottom = tittleSize * 0.6;
    const markOverhang = Math.max(0, markBottom + mergedMarkSize - tittleSize);
    const wordmarkStyle = {
      fontFamily: "'Newsreader', Georgia, serif",
      fontWeight: 600,
      fontSize: tittleSize,
      color: textColor,
      letterSpacing: '-0.01em' as const,
    };

    return (
      <span
        className={`inline-flex items-end leading-none ${className}`}
        style={{ ...wordmarkStyle, paddingTop: markOverhang }}
      >
        <span className="relative inline-block leading-none" style={{ width: `${tittleSize * 0.34}px` }}>
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              bottom: `${markBottom}px`,
            }}
          >
            <IrisMark size={mergedMarkSize} {...markProps} />
          </span>
          <span aria-hidden>&#x131;</span>
        </span>
        <span>ris</span>
        <span className="sr-only">Iris</span>
      </span>
    );
  }

  if (variant === 'stacked') {
    const iconSize = markSize ?? 88;
    const textSize = size ?? 20;
    return (
      <span className={`inline-flex flex-col items-center leading-none ${className}`} style={{ gap: '10px' }}>
        <img
          src="/engram-icon-detailed-176.png"
          alt=""
          width={iconSize}
          height={iconSize}
          style={{ borderRadius: '20%' }}
        />
        <span
          style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontWeight: 600,
            fontSize: textSize,
            color: textColor,
            letterSpacing: '-0.01em',
          }}
        >
          Engram
        </span>
      </span>
    );
  }

  const resolvedSize = size ?? preset.size;
  const resolvedMarkSize =
    markSize ?? preset.markSize ?? Math.round(resolvedSize * markScale);

  return (
    <span
      className={`inline-flex items-center leading-none ${className}`}
      style={{ gap: preset.gap }}
    >
      <img
        src="/engram-icon-192.png"
        alt=""
        width={resolvedMarkSize}
        height={resolvedMarkSize}
        style={{ borderRadius: '20%' }}
      />
      <span
        style={{
          fontFamily: "'Newsreader', Georgia, serif",
          fontWeight: preset.fontWeight,
          fontSize: resolvedSize,
          color: textColor,
          letterSpacing: preset.letterSpacing,
        }}
      >
        Engram
      </span>
    </span>
  );
}
