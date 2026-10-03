/**
 * Editorial history for the demo archive (spec pages 15, 51). Outcome windows are computed from
 * the generated price paths with the disclosed rule — entry at the next regular-session open after
 * publication, 20-session window — so the price targets below are fed into the path generator as
 * anchors and then re-measured, never typed in as results.
 */
export interface ArchiveSpec {
  id: string;
  instrumentId: string;
  /** Publication instant (UTC). */
  publishedAt: string;
  category: 'earnings' | 'ipo' | 'quality';
  /** Target 20-session price return used to anchor the demo path (percent). */
  targetReturnPct: number | null;
  headline: string;
  thesis: string;
  revision?: { at: string; summary: string; closesThesis?: boolean };
  benchmarkId: 'idx_spx' | 'idx_sxxp';
}

export const WINDOW_SESSIONS = 20;

export const ARCHIVE_SPECS: ArchiveSpec[] = [
  {
    id: 'arc_2026_09_02_nvda',
    instrumentId: 'ins_nvda',
    publishedAt: '2026-09-02T11:30:00Z',
    category: 'earnings',
    targetReturnPct: 8.6,
    headline: 'Data-centre orders still outrunning supply.',
    thesis: 'Order visibility into the next two quarters supports another upward estimate cycle.',
    benchmarkId: 'idx_spx',
  },
  {
    id: 'arc_2026_09_04_tsm',
    instrumentId: 'ins_tsm',
    publishedAt: '2026-09-04T11:30:00Z',
    category: 'earnings',
    targetReturnPct: 4.2,
    headline: 'Advanced-node utilisation supports margins.',
    thesis: 'Leading-edge capacity is fully booked, which protects pricing into next year.',
    benchmarkId: 'idx_spx',
  },
  {
    id: 'arc_2026_09_07_amd',
    instrumentId: 'ins_amd',
    publishedAt: '2026-09-07T11:30:00Z',
    category: 'earnings',
    targetReturnPct: -5.1,
    headline: 'Accelerator share gains look underestimated.',
    thesis: 'New data-centre accelerators could take share faster than consensus models assume.',
    revision: {
      at: '2026-10-01T12:00:00Z',
      summary:
        'Thesis closed. Customer ramp commentary pointed to slower share gains than the original case assumed. The original publication and outcome remain on record.',
      closesThesis: true,
    },
    benchmarkId: 'idx_spx',
  },
  {
    id: 'arc_2026_09_09_msft',
    instrumentId: 'ins_msft',
    publishedAt: '2026-09-09T11:30:00Z',
    category: 'quality',
    targetReturnPct: 2.3,
    headline: 'Cloud margins absorb the capex cycle.',
    thesis: 'Operating leverage in cloud services offsets elevated infrastructure spending.',
    benchmarkId: 'idx_spx',
  },
  {
    id: 'arc_2026_09_10_crm',
    instrumentId: 'ins_crm',
    publishedAt: '2026-09-10T11:30:00Z',
    category: 'earnings',
    targetReturnPct: -1.8,
    headline: 'Renewal pricing is the next lever.',
    thesis: 'Price increases at renewal could lift growth without a new product cycle.',
    benchmarkId: 'idx_spx',
  },
  {
    id: 'arc_2026_09_11_lly',
    instrumentId: 'ins_lly',
    publishedAt: '2026-09-11T11:30:00Z',
    category: 'quality',
    targetReturnPct: 11.4,
    headline: 'Manufacturing scale is the moat.',
    thesis:
      'Expanded production capacity converts demand into reported revenue sooner than expected.',
    benchmarkId: 'idx_spx',
  },
  {
    id: 'arc_2026_09_14_asml',
    instrumentId: 'ins_asml',
    publishedAt: '2026-09-14T06:30:00Z',
    category: 'quality',
    targetReturnPct: 9.7,
    headline: 'Order intake troughs before shipments.',
    thesis:
      'Bookings typically turn before revenue; the current order book implies a recovery in 2027.',
    benchmarkId: 'idx_sxxp',
  },
  {
    id: 'arc_2026_09_15_avgo',
    instrumentId: 'ins_avgo',
    publishedAt: '2026-09-15T11:30:00Z',
    category: 'earnings',
    targetReturnPct: 6.8,
    headline: 'Custom silicon broadens the customer base.',
    thesis: 'More hyperscale customers for custom accelerators reduce concentration risk.',
    benchmarkId: 'idx_spx',
  },
  {
    id: 'arc_2026_09_16_hlrb',
    instrumentId: 'ins_hlrb',
    publishedAt: '2026-09-16T11:30:00Z',
    category: 'quality',
    targetReturnPct: 7.9,
    headline: 'Automation demand outlasts the warehouse slowdown.',
    thesis: 'Recurring service revenue cushions slower new-system orders.',
    revision: {
      at: '2026-09-28T12:00:00Z',
      summary:
        'Cash acquisition announced at $46.20 per share. The outcome window ends at the final regular session before delisting (8 Oct 2026).',
    },
    benchmarkId: 'idx_spx',
  },
  {
    id: 'arc_2026_09_17_cost',
    instrumentId: 'ins_cost',
    publishedAt: '2026-09-17T11:30:00Z',
    category: 'quality',
    targetReturnPct: -1.2,
    headline: 'Membership renewals stay resilient.',
    thesis: 'High renewal rates support steady fee income through a softer consumer backdrop.',
    benchmarkId: 'idx_spx',
  },
  {
    id: 'arc_2026_09_18_sap',
    instrumentId: 'ins_sap',
    publishedAt: '2026-09-18T06:30:00Z',
    category: 'earnings',
    targetReturnPct: -0.6,
    headline: 'Cloud backlog converts at a faster pace.',
    thesis: 'Current cloud backlog growth implies upside to next-year cloud revenue.',
    benchmarkId: 'idx_sxxp',
  },
  {
    id: 'arc_2026_09_21_xom',
    instrumentId: 'ins_xom',
    publishedAt: '2026-09-21T11:30:00Z',
    category: 'quality',
    targetReturnPct: -1.4,
    headline: 'Cash returns hold up at lower oil prices.',
    thesis: 'Cost reductions protect buybacks and dividends if crude prices soften.',
    benchmarkId: 'idx_spx',
  },
  {
    id: 'arc_2026_09_23_cat',
    instrumentId: 'ins_cat',
    publishedAt: '2026-09-23T21:00:00Z',
    category: 'quality',
    targetReturnPct: null,
    headline: 'Power generation becomes a growth engine.',
    thesis: 'Turbine and engine demand from data centres diversifies a cyclical order book.',
    benchmarkId: 'idx_spx',
  },
  {
    id: 'arc_2026_10_05_jpm',
    instrumentId: 'ins_jpm',
    publishedAt: '2026-10-05T11:30:00Z',
    category: 'earnings',
    targetReturnPct: null,
    headline: 'Net interest income stabilises earlier.',
    thesis:
      'Deposit costs are falling faster than asset yields, supporting estimates into earnings.',
    benchmarkId: 'idx_spx',
  },
  {
    id: 'arc_2026_10_14_onto',
    instrumentId: 'ins_onto',
    publishedAt: '2026-10-14T11:30:00Z',
    category: 'earnings',
    targetReturnPct: null,
    headline: 'Advanced packaging lifts inspection demand.',
    thesis: 'Packaging complexity adds inspection steps, expanding the addressable market.',
    benchmarkId: 'idx_spx',
  },
];
