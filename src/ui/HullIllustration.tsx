import styles from './HullIllustration.module.css';

/**
 * A ship's side with its load-line marks, drawn to the real layout: the
 * Plimsoll disc and bar, the deck line above it, the assigning authority's
 * letters either side, and the ladder of seasonal marks (TF, F, T, S, W,
 * WNA). Fresh-water marks point aft, sea-water marks forward.
 */
export function HullIllustration() {
  const disc = { x: 250, y: 250 };
  const ladderX = 400;
  const marks: Array<{ label: string; y: number; side: 'fwd' | 'aft' }> = [
    { label: 'TF', y: 205, side: 'aft' },
    { label: 'F', y: 228, side: 'aft' },
    { label: 'T', y: 226, side: 'fwd' },
    { label: 'S', y: 250, side: 'fwd' },
    { label: 'W', y: 274, side: 'fwd' },
    { label: 'WNA', y: 296, side: 'fwd' },
  ];
  return (
    <svg
      viewBox="0 0 600 500"
      className={styles.svg}
      role="img"
      aria-label="A ship's hull with the Plimsoll mark and its load lines, the sea standing just below the summer line."
    >
      {/* Hull side, with a little sheer */}
      <path className={styles.hull} d="M 0 64 Q 300 48 600 70 L 600 500 L 0 500 Z" />
      <path className={styles.rubbing} d="M 0 96 Q 300 80 600 102" />

      {/* Draft marks at the bow */}
      <g className={styles.draft}>
        {[
          { y: 170, t: '9M' },
          { y: 230, t: '8' },
          { y: 290, t: '7' },
          { y: 350, t: '6' },
          { y: 410, t: '5' },
        ].map((d) => (
          <g key={d.t}>
            <text x={540} y={d.y} textAnchor="middle" dominantBaseline="middle">
              {d.t}
            </text>
          </g>
        ))}
      </g>

      {/* Deck line */}
      <rect className={styles.paint} x={disc.x - 75} y={120} width={150} height={7} />

      {/* Plimsoll disc and bar */}
      <circle className={styles.paintRing} cx={disc.x} cy={disc.y} r={58} />
      <rect className={styles.paint} x={disc.x - 110} y={disc.y - 4} width={220} height={8} />
      <text className={styles.letters} x={disc.x - 88} y={disc.y - 22} textAnchor="middle">
        L
      </text>
      <text className={styles.letters} x={disc.x + 88} y={disc.y - 22} textAnchor="middle">
        R
      </text>

      {/* Load-line ladder */}
      <rect className={styles.paint} x={ladderX - 3} y={196} width={6} height={104} />
      {marks.map((m) => {
        const x = m.side === 'fwd' ? ladderX : ladderX - 56;
        return (
          <g key={m.label}>
            <rect className={styles.paint} x={x} y={m.y - 3} width={56} height={6} />
            <text
              className={styles.ladderText}
              x={m.side === 'fwd' ? ladderX + 62 : ladderX - 62}
              y={m.y + 1}
              textAnchor={m.side === 'fwd' ? 'start' : 'end'}
              dominantBaseline="middle"
            >
              {m.label}
            </text>
          </g>
        );
      })}

      {/* The sea, standing a little below the summer mark */}
      <g className={styles.sea}>
        <path
          className={styles.water}
          d="M -40 268 q 20 -7 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 V 520 H -40 Z"
        />
        <path
          className={styles.surface}
          d="M -40 268 q 20 -7 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0"
        />
        {[310, 352, 398, 446].map((y, i) => (
          <line key={y} className={styles.glint} x1={60 + i * 37} x2={150 + i * 37} y1={y} y2={y} />
        ))}
      </g>
    </svg>
  );
}
