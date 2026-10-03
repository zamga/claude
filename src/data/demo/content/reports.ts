import type { ReportBody, ReportKind, ReportVersion } from '../../types';
import { ARCHIVE_SPECS } from '../archiveSpec';
import { INSTRUMENT_BY_ID } from '../instruments';

/**
 * Published research (illustrative demo content, not investment advice). Every published body is
 * immutable; revisions add a version with a change summary (spec pages 36, 48, 54).
 */

export interface DemoReport {
  id: string;
  kind: ReportKind;
  label: string;
  title: string;
  dek: string;
  readingMinutes: number;
  instrumentIds: string[];
  sectorTags: string[];
  status: 'published' | 'withdrawn';
  withdrawnReason: string | null;
  versions: ReportVersion[];
}

const METHOD = 'editorial-v1';
const ANALYST = 'M. Novak (sample analyst)';
const REVIEWER = 'R. Ellis (sample reviewer)';

const emptyBody = (): ReportBody => ({
  takeaway: '',
  sections: [],
  monitor: [],
  arguments: [],
  risks: [],
  financials: null,
});

const NVDA_V1: ReportBody = {
  takeaway:
    'Demand growth supports the next earnings cycle. Order visibility, supply additions and pricing all point the same way, but the valuation already assumes margins hold near their highs.',
  sections: [
    {
      heading: 'Why now',
      paragraphs: [
        'The company reports after the close on 21 October. Management guided revenue above consensus last quarter and said supply would rise through the year; we think the next print can confirm that demand absorbed the additional supply.',
        'Our horizon is weeks: the case is built around the report, the guide and the revision of estimates that usually follows.',
      ],
    },
    {
      heading: 'What would make us wrong',
      paragraphs: [
        'Slower customer spending would show first in order commentary and in the guide. Lower gross margins would show whether pricing power is fading as competing accelerators ramp.',
      ],
    },
  ],
  monitor: [
    {
      title: 'Data-centre revenue growth',
      detail: 'Sequential growth above 8% keeps the demand case intact.',
    },
    { title: 'Gross margin guide', detail: 'A guide below 72% would weaken the pricing argument.' },
    {
      title: 'Supply commentary',
      detail: 'Lead times shortening faster than shipments grow would be an early warning.',
    },
  ],
  arguments: [
    {
      id: 'nvda-a1',
      title: 'Demand',
      summary: 'Infrastructure spending supports growth.',
      evidence: [
        {
          kind: 'reported',
          statement: 'Data-centre revenue grew 9% quarter on quarter in Q2 FY2027 (sample figure).',
          sourceId: 'src_nvda_10q_q2',
        },
        {
          kind: 'management',
          statement:
            'Management said demand exceeded supply for the current platform through the next quarter.',
          sourceId: 'src_nvda_call_q2',
        },
        {
          kind: 'interpretation',
          statement:
            'We read the order commentary as visibility into at least two quarters of shipments.',
          sourceId: null,
        },
      ],
    },
    {
      id: 'nvda-a2',
      title: 'Earnings',
      summary: 'Revenue momentum strengthens the outlook.',
      evidence: [
        {
          kind: 'reported',
          statement: 'Revenue of $66.2B beat the $63.9B consensus by 3.6% (sample figures).',
          sourceId: 'src_nvda_release_q2',
        },
        {
          kind: 'estimate',
          statement:
            'Consensus expects $71.5B of revenue and EPS of $1.38 for Q3 FY2027 (sample consensus).',
          sourceId: null,
        },
      ],
    },
    {
      id: 'nvda-a3',
      title: 'Execution',
      summary: 'Capacity and margins remain decisive.',
      evidence: [
        {
          kind: 'management',
          statement: 'Supply additions are planned in each remaining quarter of the fiscal year.',
          sourceId: 'src_nvda_call_q2',
        },
        {
          kind: 'assumption',
          statement: 'Our base case assumes a 52% operating margin next year (model assumption).',
          sourceId: null,
        },
      ],
    },
  ],
  risks: [
    {
      id: 'nvda-r1',
      title: 'Slower customer spending',
      summary: 'A pause by the largest cloud customers would cut orders quickly.',
      evidence: [
        {
          kind: 'interpretation',
          statement:
            'Four customers account for a large share of data-centre revenue, which concentrates the risk.',
          sourceId: 'src_nvda_10q_q2',
        },
      ],
    },
    {
      id: 'nvda-r2',
      title: 'Lower gross margins',
      summary: 'Competing accelerators could force pricing concessions.',
      evidence: [
        {
          kind: 'reported',
          statement: 'Gross margin was 73.1% in Q2 FY2027 (sample figure).',
          sourceId: 'src_nvda_release_q2',
        },
      ],
    },
    {
      id: 'nvda-r3',
      title: 'Valuation premium',
      summary:
        'The shares trade above our base-case value only modestly; the bear case is 28% below the reference price.',
      evidence: [
        {
          kind: 'assumption',
          statement: 'See the valuation scenarios for the assumptions behind each value.',
          sourceId: null,
        },
      ],
    },
  ],
  financials: {
    periods: ['Q3 FY26', 'Q4 FY26', 'Q1 FY27', 'Q2 FY27', 'Q3 FY27E'],
    rows: [
      {
        label: 'Revenue',
        unit: '$B',
        values: ['57.0', '60.9', '62.3', '66.2', '71.5'],
        kind: 'reported',
      },
      {
        label: 'Gross margin',
        unit: '%',
        values: ['73.4', '73.0', '72.6', '73.1', null],
        kind: 'reported',
      },
      {
        label: 'Operating margin',
        unit: '%',
        values: ['61.2', '60.4', '59.8', '60.9', null],
        kind: 'reported',
      },
      {
        label: 'Diluted EPS',
        unit: '$',
        values: ['1.14', '1.21', '1.19', '1.31', '1.38'],
        kind: 'reported',
      },
    ],
    note: 'Sample figures. FY2027 periods end in January 2027. The final column is the sample consensus estimate, not a reported result.',
  },
};

const NVDA_V2: ReportBody = {
  ...NVDA_V1,
  risks: [
    ...NVDA_V1.risks,
    {
      id: 'nvda-r4',
      title: 'Export licensing',
      summary:
        'New licence requirements for some regions could delay shipments already in the order book.',
      evidence: [
        {
          kind: 'interpretation',
          statement:
            'We have not changed revenue assumptions; the risk affects timing more than demand in our view.',
          sourceId: null,
        },
      ],
    },
  ],
  monitor: [
    ...NVDA_V1.monitor,
    { title: 'Licence commentary', detail: 'Any shipment delays tied to licensing in the guide.' },
  ],
};

const MSFT_V1: ReportBody = {
  takeaway:
    'Cloud margins are absorbing a record capital-spending cycle. We think durable operating leverage makes this a quality compounder at a reasonable premium.',
  sections: [
    {
      heading: 'The case',
      paragraphs: [
        'Infrastructure spending has risen sharply, yet operating margins have held. That suggests pricing and utilisation are keeping pace with capacity.',
      ],
    },
  ],
  monitor: [
    {
      title: 'Cloud growth in constant currency',
      detail: 'Stable growth while capacity rises supports the margin case.',
    },
    {
      title: 'Capital intensity',
      detail: 'Capex as a share of revenue above 35% would test free cash flow.',
    },
  ],
  arguments: [
    {
      id: 'msft-a1',
      title: 'Durable demand',
      summary: 'Enterprise cloud commitments extend multiple years.',
      evidence: [
        {
          kind: 'reported',
          statement:
            'Commercial remaining performance obligations grew 22% year on year (sample figure).',
          sourceId: 'src_msft_10k',
        },
      ],
    },
    {
      id: 'msft-a2',
      title: 'Operating leverage',
      summary: 'Margins held through the capex cycle.',
      evidence: [
        {
          kind: 'reported',
          statement: 'Operating margin was 45% in FY2026 (sample figure).',
          sourceId: 'src_msft_10k',
        },
      ],
    },
  ],
  risks: [
    {
      id: 'msft-r1',
      title: 'Capex outruns revenue',
      summary: 'If utilisation lags, depreciation will pressure margins.',
      evidence: [
        {
          kind: 'management',
          statement: 'Management expects capital expenditure to rise again next year.',
          sourceId: 'src_msft_call',
        },
      ],
    },
  ],
  financials: null,
};

const TSM_V1: ReportBody = {
  takeaway:
    'Last week’s results confirmed fully booked leading-edge capacity. Estimates usually rise after such quarters; we expect follow-through over the next few weeks.',
  sections: [
    {
      heading: 'After the print',
      paragraphs: [
        'Management raised its full-year growth outlook and kept its long-term margin target. Price increases for advanced nodes take effect next year.',
      ],
    },
  ],
  monitor: [
    { title: 'Advanced-node mix', detail: 'Share of revenue from the two most advanced nodes.' },
    {
      title: 'Monthly revenue',
      detail: 'Monthly sales releases are the first read on the current quarter.',
    },
  ],
  arguments: [
    {
      id: 'tsm-a1',
      title: 'Utilisation',
      summary: 'Leading-edge capacity is fully booked.',
      evidence: [
        {
          kind: 'management',
          statement:
            'Management described advanced-node demand as exceeding supply into next year.',
          sourceId: 'src_tsm_call',
        },
      ],
    },
    {
      id: 'tsm-a2',
      title: 'Estimate revisions',
      summary: 'A raised outlook typically lifts estimates in the following weeks.',
      evidence: [
        {
          kind: 'interpretation',
          statement:
            'Our sample study finds positive drift after raised guidance more often than not.',
          sourceId: 'src_guidance_study',
        },
      ],
    },
  ],
  risks: [
    {
      id: 'tsm-r1',
      title: 'Geopolitical concentration',
      summary: 'Most advanced capacity sits in one region.',
      evidence: [
        {
          kind: 'reported',
          statement:
            'The company discloses geographic concentration of manufacturing in its annual filing.',
          sourceId: 'src_tsm_6k',
        },
      ],
    },
  ],
  financials: null,
};

const ASML_V1: ReportBody = {
  takeaway:
    'Order intake troughed earlier this year and is recovering. Lithography remains the bottleneck tool for advanced chips, which supports pricing through the cycle.',
  sections: [
    {
      heading: 'Quality through the cycle',
      paragraphs: [
        'Shipments lag orders by several quarters. With bookings recovering, we think the market is underestimating revenue in 2027.',
      ],
    },
  ],
  monitor: [
    {
      title: 'Quarterly bookings',
      detail: 'Orders above €5B per quarter keep the recovery on track.',
    },
    { title: 'Export rules', detail: 'Changes to licensing for deep-ultraviolet tools.' },
  ],
  arguments: [
    {
      id: 'asml-a1',
      title: 'Order recovery',
      summary: 'Bookings lead revenue by several quarters.',
      evidence: [
        {
          kind: 'reported',
          statement: 'Q3 2026 net bookings were €5.4B (sample figure).',
          sourceId: 'src_asml_q3',
        },
      ],
    },
  ],
  risks: [
    {
      id: 'asml-r1',
      title: 'Customer concentration',
      summary: 'A handful of chipmakers drive most orders.',
      evidence: [
        {
          kind: 'reported',
          statement: 'The annual report discloses concentration among its largest customers.',
          sourceId: 'src_asml_20f',
        },
      ],
    },
  ],
  financials: null,
};

const KORA_V1: ReportBody = {
  takeaway:
    'Kora listed on 8 October at $21. Its first trading update showed merchant growth ahead of the prospectus; we are watching whether retention holds as pricing normalises.',
  sections: [
    {
      heading: 'New listing, limited history',
      paragraphs: [
        'Ten sessions of trading do not establish a track record. This pick is sized as a research watch, and the outcome window applies the same rule as every other pick.',
      ],
    },
  ],
  monitor: [
    { title: 'Net revenue retention', detail: 'Above 115% supports the growth case.' },
    { title: 'Lock-up expiry', detail: '180 days after listing; supply of shares may rise then.' },
  ],
  arguments: [
    {
      id: 'kora-a1',
      title: 'Merchant growth',
      summary: 'Active merchants grew faster than the prospectus implied.',
      evidence: [
        {
          kind: 'management',
          statement:
            'The trading update reported 18% sequential growth in active merchants (fictional figure).',
          sourceId: 'src_kora_q_update',
        },
      ],
    },
  ],
  risks: [
    {
      id: 'kora-r1',
      title: 'Limited public track record',
      summary: 'Losses continue and guidance history is short.',
      evidence: [
        {
          kind: 'reported',
          statement:
            'The prospectus reports operating losses in each of the last three years (fictional issuer).',
          sourceId: 'src_kora_prospectus',
        },
      ],
    },
  ],
  financials: null,
};

const SEMIS: ReportBody = {
  takeaway:
    'Revenue growth matters most when it converts into durable cash generation. Orders, margins and customer concentration help test the thesis.',
  sections: [
    {
      heading: 'Where the cycle stands',
      paragraphs: [
        'Semiconductor cycles are driven by the gap between demand and capacity. Today the gap is widest in accelerators and advanced packaging, and narrowest in mature-node chips for industrial and auto customers.',
        'That split matters: companies selling into the tight end of the market can raise prices, while those in the loose end are still working through inventory.',
      ],
    },
    {
      heading: 'How to use this note',
      paragraphs: [
        'Treat the three monitoring points as a checklist for each earnings report in the sector. A thesis that relies on one of them should say which one.',
      ],
    },
  ],
  monitor: [
    {
      title: 'Order visibility',
      detail: 'Backlog and lead times tell you how far ahead demand is committed.',
    },
    { title: 'Gross margins', detail: 'Margins reveal pricing power before revenue does.' },
    {
      title: 'Capital intensity',
      detail: 'Capex relative to revenue shows how much growth costs to deliver.',
    },
  ],
  arguments: [],
  risks: [],
  financials: null,
};

const GUIDANCE: ReportBody = {
  takeaway:
    'Management guidance often moves expectations more than the reported quarter. Read the guide against consensus, not against last quarter.',
  sections: [
    {
      heading: 'Why the guide dominates',
      paragraphs: [
        'Reported results are compared with estimates that analysts have already refined. Guidance resets the next set of estimates, so it carries new information.',
        'In our sample study, companies that raised guidance saw estimates rise in the following four weeks far more often than those that only beat the quarter.',
      ],
    },
  ],
  monitor: [
    {
      title: 'Guide versus consensus',
      detail: 'The gap between the midpoint and consensus matters more than the beat.',
    },
    {
      title: 'Language changes',
      detail: 'Compare this quarter’s wording on demand and margins with the last call.',
    },
  ],
  arguments: [],
  risks: [],
  financials: null,
};

const IPO_NOTE: ReportBody = {
  takeaway:
    'The offer price is a negotiation, not a valuation. Float, lock-ups and use of proceeds tell you how supply and incentives will evolve after listing.',
  sections: [
    {
      heading: 'Questions before the first trade',
      paragraphs: [
        'How much of the company is actually for sale? A small free float can exaggerate early price moves.',
        'Who is selling? Primary proceeds fund the business; secondary proceeds go to existing holders.',
        'When can insiders sell? Lock-up expiries add supply, often around six months after listing.',
      ],
    },
  ],
  monitor: [
    { title: 'Offer terms', detail: 'Changes to the range before pricing signal demand.' },
    { title: 'Free float', detail: 'The share of equity available to trade.' },
    {
      title: 'Use of proceeds',
      detail: 'Growth investment versus paying down debt or selling holders.',
    },
  ],
  arguments: [],
  risks: [],
  financials: null,
};

function version(
  reportId: string,
  v: number,
  publishedAt: string,
  body: ReportBody,
  sourceIds: string[],
  changeSummary: string | null,
): ReportVersion {
  return {
    reportId,
    version: v,
    author: ANALYST,
    reviewer: REVIEWER,
    publishedAt,
    changeSummary,
    body,
    sourceIds,
    methodologyVersion: METHOD,
  };
}

export const REPORTS: DemoReport[] = [
  {
    id: 'rep_nvda_thesis',
    kind: 'thesis',
    label: 'Research note',
    title: 'The investment case.',
    dek: 'NVIDIA: demand growth supports the next earnings cycle.',
    readingMinutes: 5,
    instrumentIds: ['ins_nvda'],
    sectorTags: ['Semiconductors'],
    status: 'published',
    withdrawnReason: null,
    versions: [
      version(
        'rep_nvda_thesis',
        1,
        '2026-10-14T11:30:00Z',
        NVDA_V1,
        ['src_nvda_10q_q2', 'src_nvda_call_q2', 'src_nvda_release_q2'],
        null,
      ),
      version(
        'rep_nvda_thesis',
        2,
        '2026-10-21T11:30:00Z',
        NVDA_V2,
        ['src_nvda_10q_q2', 'src_nvda_call_q2', 'src_nvda_release_q2'],
        'Added export licensing as a risk and a monitoring point. Revenue and valuation assumptions are unchanged.',
      ),
    ],
  },
  {
    id: 'rep_msft_thesis',
    kind: 'thesis',
    label: 'Research note',
    title: 'Durable compounding.',
    dek: 'Microsoft: cloud margins absorb the capex cycle.',
    readingMinutes: 4,
    instrumentIds: ['ins_msft'],
    sectorTags: ['Software'],
    status: 'published',
    withdrawnReason: null,
    versions: [
      version(
        'rep_msft_thesis',
        1,
        '2026-10-21T11:30:00Z',
        MSFT_V1,
        ['src_msft_10k', 'src_msft_call'],
        null,
      ),
    ],
  },
  {
    id: 'rep_tsm_thesis',
    kind: 'thesis',
    label: 'Research note',
    title: 'Capacity meets demand.',
    dek: 'TSMC: estimate revisions follow a raised outlook.',
    readingMinutes: 4,
    instrumentIds: ['ins_tsm'],
    sectorTags: ['Semiconductors'],
    status: 'published',
    withdrawnReason: null,
    versions: [
      version(
        'rep_tsm_thesis',
        1,
        '2026-10-21T11:30:00Z',
        TSM_V1,
        ['src_tsm_6k', 'src_tsm_call', 'src_guidance_study'],
        null,
      ),
    ],
  },
  {
    id: 'rep_asml_thesis',
    kind: 'thesis',
    label: 'Research note',
    title: 'The bottleneck tool.',
    dek: 'ASML: order intake recovers before shipments.',
    readingMinutes: 4,
    instrumentIds: ['ins_asml'],
    sectorTags: ['Semiconductors', 'Europe'],
    status: 'published',
    withdrawnReason: null,
    versions: [
      version(
        'rep_asml_thesis',
        1,
        '2026-10-21T05:30:00Z',
        ASML_V1,
        ['src_asml_q3', 'src_asml_20f'],
        null,
      ),
    ],
  },
  {
    id: 'rep_kora_thesis',
    kind: 'ipo',
    label: 'IPO research',
    title: 'Ten sessions in.',
    dek: 'Kora Payments: first weeks as a public company.',
    readingMinutes: 3,
    instrumentIds: ['ins_kora'],
    sectorTags: ['Financials', 'New listings'],
    status: 'published',
    withdrawnReason: null,
    versions: [
      version(
        'rep_kora_thesis',
        1,
        '2026-10-21T11:30:00Z',
        KORA_V1,
        ['src_kora_prospectus', 'src_kora_q_update'],
        null,
      ),
    ],
  },
  {
    id: 'rep_semis_cycle',
    kind: 'sector',
    label: 'Sector note',
    title: 'Inside the semiconductor cycle.',
    dek: 'Demand, capacity and what matters next.',
    readingMinutes: 6,
    instrumentIds: [
      'ins_nvda',
      'ins_tsm',
      'ins_amd',
      'ins_asml',
      'ins_avgo',
      'ins_onto',
      'ins_lscc',
    ],
    sectorTags: ['Semiconductors'],
    status: 'published',
    withdrawnReason: null,
    versions: [
      version(
        'rep_semis_cycle',
        1,
        '2026-10-19T09:00:00Z',
        SEMIS,
        ['src_semis_capex', 'src_semis_inventory'],
        null,
      ),
    ],
  },
  {
    id: 'rep_guidance',
    kind: 'earnings',
    label: 'Earnings',
    title: 'When guidance changes the story.',
    dek: 'How management updates can reshape expectations and valuation.',
    readingMinutes: 4,
    instrumentIds: [],
    sectorTags: ['Earnings'],
    status: 'published',
    withdrawnReason: null,
    versions: [
      version('rep_guidance', 1, '2026-10-16T09:00:00Z', GUIDANCE, ['src_guidance_study'], null),
    ],
  },
  {
    id: 'rep_ipo_offer',
    kind: 'ipo',
    label: 'IPO research',
    title: 'Reading beyond the offer price.',
    dek: 'Key questions to assess quality, valuation and long-term potential.',
    readingMinutes: 5,
    instrumentIds: ['ins_alto', 'ins_nora', 'ins_vela', 'ins_kora'],
    sectorTags: ['New listings'],
    status: 'published',
    withdrawnReason: null,
    versions: [
      version('rep_ipo_offer', 1, '2026-10-12T09:00:00Z', IPO_NOTE, ['src_ipo_study'], null),
    ],
  },
  {
    id: 'rep_q3_preview_withdrawn',
    kind: 'earnings',
    label: 'Earnings',
    title: 'Retail earnings preview.',
    dek: 'Withdrawn: the note relied on a dataset that was later corrected.',
    readingMinutes: 3,
    instrumentIds: ['ins_cost'],
    sectorTags: ['Consumer staples'],
    status: 'withdrawn',
    withdrawnReason:
      'The sample point-of-sale dataset behind this note was revised by its provider after publication. The original version and its date remain available below.',
    versions: [
      version(
        'rep_q3_preview_withdrawn',
        1,
        '2026-10-06T09:00:00Z',
        {
          ...emptyBody(),
          takeaway:
            'Same-store sales trends pointed to an upside surprise for warehouse retailers.',
          sections: [
            {
              heading: 'Original note',
              paragraphs: ['Preserved for transparency. Do not rely on its conclusions.'],
            },
          ],
        },
        ['src_cost_10k'],
        null,
      ),
    ],
  },
  // Theses behind archived picks.
  ...ARCHIVE_SPECS.map((spec): DemoReport => {
    const instrument = INSTRUMENT_BY_ID.get(spec.instrumentId)!;
    const reportId = `rep_${spec.id}`;
    const body: ReportBody = {
      ...emptyBody(),
      takeaway: spec.thesis,
      sections: [
        {
          heading: 'Original thesis',
          paragraphs: [
            spec.thesis,
            'Sample archived research. The outcome is measured with the disclosed method regardless of later revisions.',
          ],
        },
      ],
      arguments: [
        {
          id: `${spec.id}-a1`,
          title: spec.headline.replace(/\.$/, ''),
          summary: spec.thesis,
          evidence: [
            {
              kind: 'interpretation',
              statement: 'Archived sample thesis without attached evidence records.',
              sourceId: null,
            },
          ],
        },
      ],
    };
    const versions = [version(reportId, 1, spec.publishedAt, body, [], null)];
    if (spec.revision) {
      versions.push(
        version(
          reportId,
          2,
          spec.revision.at,
          {
            ...body,
            takeaway: spec.revision.closesThesis
              ? `Thesis closed. ${spec.revision.summary}`
              : body.takeaway,
            sections: [
              ...body.sections,
              {
                heading: spec.revision.closesThesis ? 'Why the thesis was closed' : 'Update',
                paragraphs: [spec.revision.summary],
              },
            ],
          },
          [],
          spec.revision.summary,
        ),
      );
    }
    return {
      id: reportId,
      kind: 'thesis',
      label: 'Research note',
      title: spec.headline,
      dek: `${instrument.shortName}: ${spec.thesis}`,
      readingMinutes: 2,
      instrumentIds: [spec.instrumentId],
      sectorTags: [instrument.sector],
      status: 'published',
      withdrawnReason: null,
      versions,
    };
  }),
];

export const REPORT_BY_ID = new Map(REPORTS.map((report) => [report.id, report]));
