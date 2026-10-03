import type { Source } from '../../types';
import { INSTRUMENT_BY_ID } from '../instruments';

/**
 * Illustrative source records. Each identifies a plausible document type, publisher and period,
 * but no document is attached in the demo build; where the company files with the SEC, the
 * record offers its EDGAR filing index as a real alternate source.
 */

const UNATTACHED =
  'Illustrative source record in the demo dataset. No document is attached, and the figures it supports are sample values.';

function filingSource(
  id: string,
  instrumentId: string,
  title: string,
  kind: Source['kind'],
  period: string | null,
  publishedAt: string,
): Source {
  const instrument = INSTRUMENT_BY_ID.get(instrumentId);
  return {
    id,
    title,
    publisher: instrument?.name ?? 'Issuer',
    kind,
    period,
    publishedAt,
    retrievedAt: publishedAt,
    url: null,
    status: 'unattached',
    note: UNATTACHED,
    alternate: instrument?.filingsUrl
      ? { label: `${instrument.symbol} filing index on SEC EDGAR`, url: instrument.filingsUrl }
      : null,
  };
}

function editorialSource(
  id: string,
  title: string,
  publisher: string,
  kind: Source['kind'],
  period: string | null,
  publishedAt: string,
): Source {
  return {
    id,
    title,
    publisher,
    kind,
    period,
    publishedAt,
    retrievedAt: publishedAt,
    url: null,
    status: 'unattached',
    note: UNATTACHED,
    alternate: null,
  };
}

export const SOURCES: Source[] = [
  filingSource(
    'src_nvda_10q_q2',
    'ins_nvda',
    'Quarterly report (Form 10-Q), Q2 FY2027',
    'filing',
    'Q2 FY2027',
    '2026-08-27T20:00:00Z',
  ),
  filingSource(
    'src_nvda_call_q2',
    'ins_nvda',
    'Earnings call transcript, Q2 FY2027',
    'transcript',
    'Q2 FY2027',
    '2026-08-26T22:30:00Z',
  ),
  filingSource(
    'src_nvda_release_q2',
    'ins_nvda',
    'Quarterly results press release, Q2 FY2027',
    'release',
    'Q2 FY2027',
    '2026-08-26T20:20:00Z',
  ),
  filingSource(
    'src_msft_10k',
    'ins_msft',
    'Annual report (Form 10-K), FY2026',
    'filing',
    'FY2026',
    '2026-07-30T20:00:00Z',
  ),
  filingSource(
    'src_msft_call',
    'ins_msft',
    'Earnings call transcript, Q4 FY2026',
    'transcript',
    'Q4 FY2026',
    '2026-07-29T22:00:00Z',
  ),
  filingSource(
    'src_tsm_6k',
    'ins_tsm',
    'Quarterly management report (Form 6-K), Q3 2026',
    'filing',
    'Q3 2026',
    '2026-10-15T08:00:00Z',
  ),
  filingSource(
    'src_tsm_call',
    'ins_tsm',
    'Earnings conference transcript, Q3 2026',
    'transcript',
    'Q3 2026',
    '2026-10-15T08:00:00Z',
  ),
  filingSource(
    'src_amd_10q',
    'ins_amd',
    'Quarterly report (Form 10-Q), Q2 2026',
    'filing',
    'Q2 2026',
    '2026-08-05T20:00:00Z',
  ),
  filingSource(
    'src_asml_q3',
    'ins_asml',
    'Quarterly results and order intake, Q3 2026',
    'release',
    'Q3 2026',
    '2026-10-14T05:00:00Z',
  ),
  filingSource(
    'src_asml_20f',
    'ins_asml',
    'Annual report (Form 20-F), 2025',
    'filing',
    'FY2025',
    '2026-02-11T07:00:00Z',
  ),
  filingSource(
    'src_sap_q3',
    'ins_sap',
    'Quarterly statement, Q3 2026',
    'release',
    'Q3 2026',
    '2026-10-20T20:05:00Z',
  ),
  filingSource(
    'src_onto_q3',
    'ins_onto',
    'Quarterly results press release, Q3 2026',
    'release',
    'Q3 2026',
    '2026-10-20T20:10:00Z',
  ),
  filingSource(
    'src_crm_10q',
    'ins_crm',
    'Quarterly report (Form 10-Q), Q2 FY2027',
    'filing',
    'Q2 FY2027',
    '2026-09-04T20:00:00Z',
  ),
  filingSource(
    'src_cost_10k',
    'ins_cost',
    'Annual report (Form 10-K), FY2026',
    'filing',
    'FY2026',
    '2026-10-09T20:00:00Z',
  ),
  editorialSource(
    'src_kora_prospectus',
    'Final prospectus (Form 424B4)',
    'Kora Payments, Inc. (fictional issuer)',
    'filing',
    null,
    '2026-10-07T23:00:00Z',
  ),
  editorialSource(
    'src_kora_q_update',
    'First trading update as a listed company',
    'Kora Payments, Inc. (fictional issuer)',
    'release',
    'Q3 2026',
    '2026-10-19T12:00:00Z',
  ),
  editorialSource(
    'src_alto_s1',
    'Registration statement (Form S-1/A), amendment 3',
    'Alto Systems, Inc. (fictional issuer)',
    'filing',
    null,
    '2026-10-20T21:00:00Z',
  ),
  editorialSource(
    'src_nora_s1',
    'Registration statement (Form S-1)',
    'Nora Health, Inc. (fictional issuer)',
    'filing',
    null,
    '2026-10-02T21:00:00Z',
  ),
  editorialSource(
    'src_vela_s1',
    'Registration statement (Form S-1), draft',
    'Vela Energy, Inc. (fictional issuer)',
    'filing',
    null,
    '2026-09-25T21:00:00Z',
  ),
  editorialSource(
    'src_brva_prospectus',
    'Intention to float and registration document',
    'Brava Mobility SA (fictional issuer)',
    'filing',
    null,
    '2026-10-12T07:00:00Z',
  ),
  editorialSource(
    'src_ostr_itf',
    'Intention to float announcement',
    'Ostra Bio AG (fictional issuer)',
    'release',
    null,
    '2026-10-16T07:00:00Z',
  ),
  editorialSource(
    'src_semis_capex',
    'Semiconductor equipment billings dataset',
    'Industry association statistics (sample)',
    'dataset',
    'Q3 2026',
    '2026-10-16T14:00:00Z',
  ),
  editorialSource(
    'src_semis_inventory',
    'Distributor inventory survey',
    'Stock Picks research desk (sample)',
    'dataset',
    'Sep 2026',
    '2026-10-09T14:00:00Z',
  ),
  editorialSource(
    'src_guidance_study',
    'Guidance revisions and post-earnings drift, 2015–2025',
    'Stock Picks research desk (sample)',
    'dataset',
    null,
    '2026-09-30T14:00:00Z',
  ),
  editorialSource(
    'src_ipo_study',
    'Lock-up expiries and post-IPO returns',
    'Stock Picks research desk (sample)',
    'dataset',
    null,
    '2026-08-20T14:00:00Z',
  ),
];

export const SOURCE_BY_ID = new Map(SOURCES.map((source) => [source.id, source]));
