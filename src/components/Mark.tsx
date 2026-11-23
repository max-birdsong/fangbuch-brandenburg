/** Captura mark: a zander on a measuring scale (same drawing as public/icons/icon.svg). */
export function Mark({ size = 64 }: { size?: number }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 88 88" aria-hidden="true">
      <rect width="88" height="88" rx="22" fill="#14505C" />
      <g transform="translate(0 -5)" fill="#FFFFFF">
        <path d="M12 44 C 16 39, 24 35, 34 34 C 46 33, 58 37, 66 41 L78 33 L75 44 L78 55 L66 47 C 58 51, 46 54, 34 53 C 24 52, 16 49, 12 44 Z" />
        <path d="M29 35 L30.5 27 L33.5 30 L36 25.5 L39 29 L42 26 L44.5 30 L47 36 L29 37 Z M49 34.5 L53 28.5 L61 40 L49 37 Z M44 52.5 L49 58 L55 49 L44 50 Z" />
      </g>
      <circle cx="21" cy="36.5" r="2.6" fill="#E9A23B" />
      <path d="M10 66 H78 M16 66 V60 M27 66 V62 M38 66 V58 M49 66 V62 M60 66 V60 M71 66 V62" stroke="#7FC4CF" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}
