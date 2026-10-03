import type { Instrument } from '../types';
import type { CalendarId } from './calendar';

/**
 * Demo instrument universe. Names and tickers identify real listed companies for realism, but
 * every price, estimate, thesis and outcome attached to them is illustrative demo data.
 * Alto, Nora, Vela, Brava, Ostra, Kora and Hollis are fictional issuers.
 */

export interface PriceSpec {
  calendar: CalendarId;
  seed: number;
  annualVol: number;
  /** Close one year before the demo session (start anchor). */
  start: number;
  /** Regular-session close on 20 Oct 2026. */
  previousClose: number;
  /**
   * Latest price: for US names the 14:25 ET demo quote; for European names the 21 Oct close
   * (their session has ended at demo time).
   */
  latest: number;
  /** Additional daily close anchors (date -> close), e.g. paper-ledger prices. */
  anchors?: Record<string, number>;
  /** Intraday anchors for the demo session (minutes after the open -> price). */
  intraday?: Record<number, number>;
  /** Close at the end of the demo session (US names), reached by "advance market". */
  sessionClose?: number;
  /**
   * Pin a calm, gently trending stretch of sessions (used for benchmark indices so matched
   * 20-session windows read like a normal market rather than a random rally).
   */
  shape?: { from: string; to: string; drift: number; amplitude: number };
  /** First listed session for newly listed names. */
  listedOn?: string;
  /** Last session before delisting. */
  lastSession?: string;
}

export interface DemoInstrument extends Instrument {
  price: PriceSpec | null;
}

const edgar = (ticker: string) =>
  `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${ticker}&type=&dateb=&owner=include&count=40`;

function listed(
  base: Omit<
    Instrument,
    'status' | 'listedOn' | 'delistedOn' | 'tickSize' | 'pricePrecision' | 'type'
  > &
    Partial<Pick<Instrument, 'type' | 'listedOn' | 'delistedOn' | 'status'>>,
  price: PriceSpec | null,
): DemoInstrument {
  return {
    type: 'equity',
    status: 'listed',
    listedOn: null,
    delistedOn: null,
    tickSize: '0.01',
    pricePrecision: 2,
    ...base,
    price,
  };
}

export const INSTRUMENTS: DemoInstrument[] = [
  listed(
    {
      id: 'ins_nvda',
      symbol: 'NVDA',
      mic: 'XNAS',
      exchange: 'Nasdaq',
      name: 'NVIDIA Corporation',
      shortName: 'NVIDIA',
      currency: 'USD',
      timeZone: 'America/New_York',
      sector: 'Technology',
      industry: 'Semiconductors',
      marketCap: 'large',
      region: 'US',
      themes: ['Semiconductors', 'AI infrastructure', 'Data centre', 'Momentum'],
      description: 'Designs accelerated computing platforms, GPUs and networking for data centres.',
      filingsUrl: edgar('NVDA'),
    },
    {
      calendar: 'US',
      seed: 101,
      annualVol: 0.46,
      start: 104.2,
      previousClose: 139.53,
      latest: 142.8,
      anchors: { '2026-07-15': 128.0, '2026-09-01': 124.5 },
      intraday: { 0: 139.8, 5: 140.25, 295: 142.8 },
      sessionClose: 143.62,
    },
  ),
  listed(
    {
      id: 'ins_msft',
      symbol: 'MSFT',
      mic: 'XNAS',
      exchange: 'Nasdaq',
      name: 'Microsoft Corporation',
      shortName: 'Microsoft',
      currency: 'USD',
      timeZone: 'America/New_York',
      sector: 'Technology',
      industry: 'Software',
      marketCap: 'large',
      region: 'US',
      themes: ['Software', 'Cloud', 'AI infrastructure', 'Quality'],
      description: 'Operates cloud infrastructure, productivity software and developer platforms.',
      filingsUrl: edgar('MSFT'),
    },
    {
      calendar: 'US',
      seed: 202,
      annualVol: 0.24,
      start: 371.6,
      previousClose: 415.11,
      latest: 418.6,
      anchors: { '2026-08-03': 397.92 },
      sessionClose: 419.35,
    },
  ),
  listed(
    {
      id: 'ins_tsm',
      symbol: 'TSM',
      mic: 'XNYS',
      exchange: 'NYSE',
      name: 'Taiwan Semiconductor Manufacturing Co. (ADR)',
      shortName: 'TSMC',
      type: 'adr',
      currency: 'USD',
      timeZone: 'America/New_York',
      sector: 'Technology',
      industry: 'Semiconductors',
      marketCap: 'large',
      region: 'US',
      themes: ['Semiconductors', 'Foundry', 'AI infrastructure', 'Momentum'],
      description:
        'Manufactures leading-edge chips for fabless designers; ADRs listed in New York.',
      filingsUrl: edgar('TSM'),
    },
    {
      calendar: 'US',
      seed: 303,
      annualVol: 0.36,
      start: 133.4,
      previousClose: 175.56,
      latest: 178.4,
      anchors: { '2026-09-08': 161.95, '2026-10-05': 168.9 },
      sessionClose: 178.95,
    },
  ),
  listed(
    {
      id: 'ins_amd',
      symbol: 'AMD',
      mic: 'XNAS',
      exchange: 'Nasdaq',
      name: 'Advanced Micro Devices, Inc.',
      shortName: 'AMD',
      currency: 'USD',
      timeZone: 'America/New_York',
      sector: 'Technology',
      industry: 'Semiconductors',
      marketCap: 'large',
      region: 'US',
      themes: ['Semiconductors', 'Data centre', 'AI infrastructure'],
      description:
        'Designs CPUs, GPUs and adaptive chips for data centres, PCs and embedded systems.',
      filingsUrl: edgar('AMD'),
    },
    {
      calendar: 'US',
      seed: 404,
      annualVol: 0.5,
      start: 121.8,
      previousClose: 156.95,
      latest: 156.2,
      sessionClose: 155.84,
    },
  ),
  listed(
    {
      id: 'ins_crm',
      symbol: 'CRM',
      mic: 'XNYS',
      exchange: 'NYSE',
      name: 'Salesforce, Inc.',
      shortName: 'Salesforce',
      currency: 'USD',
      timeZone: 'America/New_York',
      sector: 'Technology',
      industry: 'Software',
      marketCap: 'large',
      region: 'US',
      themes: ['Software', 'Enterprise applications', 'Earnings'],
      description: 'Provides customer-relationship management and enterprise data software.',
      filingsUrl: edgar('CRM'),
    },
    {
      calendar: 'US',
      seed: 505,
      annualVol: 0.32,
      start: 243.1,
      previousClose: 266.1,
      latest: 268.4,
      sessionClose: 268.05,
    },
  ),
  listed(
    {
      id: 'ins_cost',
      symbol: 'COST',
      mic: 'XNAS',
      exchange: 'Nasdaq',
      name: 'Costco Wholesale Corporation',
      shortName: 'Costco',
      currency: 'USD',
      timeZone: 'America/New_York',
      sector: 'Consumer staples',
      industry: 'Retail',
      marketCap: 'large',
      region: 'US',
      themes: ['Consumer', 'Retail', 'Quality'],
      description: 'Operates membership warehouse clubs in North America, Europe and Asia.',
      filingsUrl: edgar('COST'),
    },
    {
      calendar: 'US',
      seed: 606,
      annualVol: 0.2,
      start: 851.4,
      previousClose: 906.82,
      latest: 912.3,
      sessionClose: 913.1,
    },
  ),
  listed(
    {
      id: 'ins_avgo',
      symbol: 'AVGO',
      mic: 'XNAS',
      exchange: 'Nasdaq',
      name: 'Broadcom Inc.',
      shortName: 'Broadcom',
      currency: 'USD',
      timeZone: 'America/New_York',
      sector: 'Technology',
      industry: 'Semiconductors',
      marketCap: 'large',
      region: 'US',
      themes: ['Semiconductors', 'Networking', 'AI infrastructure'],
      description: 'Supplies networking and custom silicon, plus infrastructure software.',
      filingsUrl: edgar('AVGO'),
    },
    {
      calendar: 'US',
      seed: 707,
      annualVol: 0.42,
      start: 219.5,
      previousClose: 343.35,
      latest: 348.7,
      sessionClose: 349.4,
    },
  ),
  listed(
    {
      id: 'ins_lscc',
      symbol: 'LSCC',
      mic: 'XNAS',
      exchange: 'Nasdaq',
      name: 'Lattice Semiconductor Corporation',
      shortName: 'Lattice',
      currency: 'USD',
      timeZone: 'America/New_York',
      sector: 'Technology',
      industry: 'Semiconductors',
      marketCap: 'mid',
      region: 'US',
      themes: ['Semiconductors', 'Edge computing', 'Momentum'],
      description: 'Designs low-power programmable logic devices for edge and industrial markets.',
      filingsUrl: edgar('LSCC'),
    },
    {
      calendar: 'US',
      seed: 808,
      annualVol: 0.45,
      start: 52.3,
      previousClose: 63.9,
      latest: 64.82,
      sessionClose: 65.05,
    },
  ),
  listed(
    {
      id: 'ins_onto',
      symbol: 'ONTO',
      mic: 'XNYS',
      exchange: 'NYSE',
      name: 'Onto Innovation Inc.',
      shortName: 'Onto Innovation',
      currency: 'USD',
      timeZone: 'America/New_York',
      sector: 'Technology',
      industry: 'Semiconductor equipment',
      marketCap: 'mid',
      region: 'US',
      themes: ['Semiconductors', 'Equipment', 'Earnings'],
      description: 'Builds process-control and inspection systems for semiconductor manufacturing.',
      filingsUrl: edgar('ONTO'),
    },
    {
      calendar: 'US',
      seed: 909,
      annualVol: 0.44,
      start: 166.8,
      previousClose: 184.1,
      latest: 182.45,
      sessionClose: 182.1,
    },
  ),
  listed(
    {
      id: 'ins_xom',
      symbol: 'XOM',
      mic: 'XNYS',
      exchange: 'NYSE',
      name: 'Exxon Mobil Corporation',
      shortName: 'ExxonMobil',
      currency: 'USD',
      timeZone: 'America/New_York',
      sector: 'Energy',
      industry: 'Integrated oil and gas',
      marketCap: 'large',
      region: 'US',
      themes: ['Energy', 'Dividends'],
      description: 'Explores for, produces and refines oil and natural gas.',
      filingsUrl: edgar('XOM'),
    },
    {
      calendar: 'US',
      seed: 1010,
      annualVol: 0.22,
      start: 118.4,
      previousClose: 113.04,
      latest: 112.35,
      sessionClose: 112.2,
    },
  ),
  listed(
    {
      id: 'ins_jpm',
      symbol: 'JPM',
      mic: 'XNYS',
      exchange: 'NYSE',
      name: 'JPMorgan Chase & Co.',
      shortName: 'JPMorgan',
      currency: 'USD',
      timeZone: 'America/New_York',
      sector: 'Financials',
      industry: 'Banks',
      marketCap: 'large',
      region: 'US',
      themes: ['Financials', 'Banks', 'Quality'],
      description: 'Provides consumer, commercial and investment banking services.',
      filingsUrl: edgar('JPM'),
    },
    {
      calendar: 'US',
      seed: 1111,
      annualVol: 0.22,
      start: 238.2,
      previousClose: 284.55,
      latest: 286.9,
      sessionClose: 287.3,
    },
  ),
  listed(
    {
      id: 'ins_lly',
      symbol: 'LLY',
      mic: 'XNYS',
      exchange: 'NYSE',
      name: 'Eli Lilly and Company',
      shortName: 'Eli Lilly',
      currency: 'USD',
      timeZone: 'America/New_York',
      sector: 'Health care',
      industry: 'Pharmaceuticals',
      marketCap: 'large',
      region: 'US',
      themes: ['Health care', 'Pharmaceuticals', 'Quality'],
      description:
        'Discovers and manufactures medicines across metabolic, oncology and immunology.',
      filingsUrl: edgar('LLY'),
    },
    {
      calendar: 'US',
      seed: 1212,
      annualVol: 0.3,
      start: 788.6,
      previousClose: 805.1,
      latest: 812.4,
      sessionClose: 811.9,
    },
  ),
  listed(
    {
      id: 'ins_cat',
      symbol: 'CAT',
      mic: 'XNYS',
      exchange: 'NYSE',
      name: 'Caterpillar Inc.',
      shortName: 'Caterpillar',
      currency: 'USD',
      timeZone: 'America/New_York',
      sector: 'Industrials',
      industry: 'Machinery',
      marketCap: 'large',
      region: 'US',
      themes: ['Industrials', 'Infrastructure', 'Power generation'],
      description: 'Manufactures construction and mining equipment, engines and turbines.',
      filingsUrl: edgar('CAT'),
    },
    {
      calendar: 'US',
      seed: 1313,
      annualVol: 0.28,
      start: 351.7,
      previousClose: 399.4,
      latest: 402.75,
      sessionClose: 403.4,
    },
  ),
  listed(
    {
      id: 'ins_kora',
      symbol: 'KORA',
      mic: 'XNYS',
      exchange: 'NYSE',
      name: 'Kora Payments, Inc.',
      shortName: 'Kora Payments',
      currency: 'USD',
      timeZone: 'America/New_York',
      sector: 'Financials',
      industry: 'Payments',
      marketCap: 'mid',
      region: 'US',
      themes: ['Fintech', 'Payments', 'New listings'],
      description:
        'Fictional issuer. Provides payment acceptance software for mid-sized merchants.',
      listedOn: '2026-10-08',
      filingsUrl: null,
    },
    {
      calendar: 'US',
      seed: 1414,
      annualVol: 0.68,
      start: 24.1,
      previousClose: 25.8,
      latest: 26.35,
      listedOn: '2026-10-08',
      sessionClose: 26.6,
    },
  ),
  listed(
    {
      id: 'ins_hlrb',
      symbol: 'HLRB',
      mic: 'XNAS',
      exchange: 'Nasdaq',
      name: 'Hollis Robotics, Inc.',
      shortName: 'Hollis Robotics',
      currency: 'USD',
      timeZone: 'America/New_York',
      sector: 'Industrials',
      industry: 'Automation',
      marketCap: 'small',
      region: 'US',
      themes: ['Robotics', 'Automation'],
      description:
        'Fictional issuer. Warehouse robotics maker acquired for cash; delisted after the 8 Oct 2026 session.',
      status: 'delisted',
      delistedOn: '2026-10-09',
      filingsUrl: null,
    },
    {
      calendar: 'US',
      seed: 1515,
      annualVol: 0.55,
      start: 31.4,
      previousClose: 46.18,
      latest: 46.18,
      anchors: { '2026-09-15': 42.8 },
      lastSession: '2026-10-08',
    },
  ),
  listed(
    {
      id: 'ins_asml',
      symbol: 'ASML',
      mic: 'XAMS',
      exchange: 'Euronext Amsterdam',
      name: 'ASML Holding N.V.',
      shortName: 'ASML',
      currency: 'EUR',
      timeZone: 'Europe/Amsterdam',
      sector: 'Technology',
      industry: 'Semiconductor equipment',
      marketCap: 'large',
      region: 'EU',
      themes: ['Semiconductors', 'Equipment', 'Lithography', 'Quality'],
      description: 'Builds lithography systems used to pattern advanced semiconductors.',
      filingsUrl: edgar('ASML'),
    },
    {
      calendar: 'EU',
      seed: 1616,
      annualVol: 0.36,
      start: 688.4,
      previousClose: 641.3,
      latest: 648.2,
      anchors: { '2026-08-20': 612.4 },
    },
  ),
  listed(
    {
      id: 'ins_sap',
      symbol: 'SAP',
      mic: 'XETR',
      exchange: 'Xetra',
      name: 'SAP SE',
      shortName: 'SAP',
      currency: 'EUR',
      timeZone: 'Europe/Berlin',
      sector: 'Technology',
      industry: 'Software',
      marketCap: 'large',
      region: 'EU',
      themes: ['Software', 'Enterprise applications', 'Cloud', 'Earnings'],
      description: 'Develops enterprise resource planning and business application software.',
      filingsUrl: edgar('SAP'),
    },
    {
      calendar: 'EU',
      seed: 1717,
      annualVol: 0.27,
      start: 244.6,
      previousClose: 233.1,
      latest: 231.4,
    },
  ),
  listed(
    {
      id: 'ins_sie',
      symbol: 'SIE',
      mic: 'XETR',
      exchange: 'Xetra',
      name: 'Siemens AG',
      shortName: 'Siemens',
      currency: 'EUR',
      timeZone: 'Europe/Berlin',
      sector: 'Industrials',
      industry: 'Industrial automation',
      marketCap: 'large',
      region: 'EU',
      themes: ['Industrials', 'Automation', 'Infrastructure'],
      description: 'Supplies industrial automation, smart infrastructure and mobility systems.',
      filingsUrl: null,
    },
    {
      calendar: 'EU',
      seed: 1818,
      annualVol: 0.25,
      start: 179.2,
      previousClose: 212.9,
      latest: 214.6,
    },
  ),
  // Pending listings (IPO pipeline). Identity is created before listing and carried through.
  listed(
    {
      id: 'ins_alto',
      symbol: 'ALTO',
      mic: 'XNAS',
      exchange: 'Nasdaq',
      name: 'Alto Systems, Inc.',
      shortName: 'Alto Systems',
      currency: 'USD',
      timeZone: 'America/New_York',
      sector: 'Technology',
      industry: 'Enterprise software',
      marketCap: 'small',
      region: 'US',
      themes: ['Software', 'New listings'],
      description: 'Fictional issuer. Workflow software for regulated industries.',
      status: 'pending',
      filingsUrl: null,
    },
    null,
  ),
  listed(
    {
      id: 'ins_nora',
      symbol: 'NORA',
      mic: 'XNYS',
      exchange: 'NYSE',
      name: 'Nora Health, Inc.',
      shortName: 'Nora Health',
      currency: 'USD',
      timeZone: 'America/New_York',
      sector: 'Health care',
      industry: 'Health services',
      marketCap: 'small',
      region: 'US',
      themes: ['Health care', 'New listings'],
      description: 'Fictional issuer. Remote monitoring services for chronic-care clinics.',
      status: 'pending',
      filingsUrl: null,
    },
    null,
  ),
  listed(
    {
      id: 'ins_vela',
      symbol: 'VELA',
      mic: 'XNYS',
      exchange: 'NYSE',
      name: 'Vela Energy, Inc.',
      shortName: 'Vela Energy',
      currency: 'USD',
      timeZone: 'America/New_York',
      sector: 'Energy',
      industry: 'Renewable power',
      marketCap: 'small',
      region: 'US',
      themes: ['Energy', 'New listings', 'Infrastructure'],
      description: 'Fictional issuer. Develops grid-scale battery storage projects.',
      status: 'pending',
      filingsUrl: null,
    },
    null,
  ),
  listed(
    {
      id: 'ins_brva',
      symbol: 'BRVA',
      mic: 'XPAR',
      exchange: 'Euronext Paris',
      name: 'Brava Mobility SA',
      shortName: 'Brava Mobility',
      currency: 'EUR',
      timeZone: 'Europe/Paris',
      sector: 'Industrials',
      industry: 'Transport technology',
      marketCap: 'small',
      region: 'EU',
      themes: ['Industrials', 'New listings', 'Mobility'],
      description: 'Fictional issuer. Fleet electrification software and charging services.',
      status: 'pending',
      filingsUrl: null,
    },
    null,
  ),
  listed(
    {
      id: 'ins_ostr',
      symbol: 'OSTR',
      mic: 'XETR',
      exchange: 'Xetra',
      name: 'Ostra Bio AG',
      shortName: 'Ostra Bio',
      currency: 'EUR',
      timeZone: 'Europe/Berlin',
      sector: 'Health care',
      industry: 'Biotechnology',
      marketCap: 'small',
      region: 'EU',
      themes: ['Health care', 'New listings', 'Biotechnology'],
      description: 'Fictional issuer. Develops enzyme therapies for rare metabolic disorders.',
      status: 'pending',
      filingsUrl: null,
    },
    null,
  ),
];

export const INSTRUMENT_BY_ID = new Map(
  INSTRUMENTS.map((instrument) => [instrument.id, instrument]),
);
export const INSTRUMENT_BY_SYMBOL = new Map(
  INSTRUMENTS.map((instrument) => [instrument.symbol.toLowerCase(), instrument]),
);

export function stripPrice({ price: _price, ...instrument }: DemoInstrument): Instrument {
  return instrument;
}

export const SECTORS = [...new Set(INSTRUMENTS.map((instrument) => instrument.sector))].sort();

/** Market indices used for the overview and as benchmarks. */
export interface DemoIndex {
  id: string;
  name: string;
  shortName: string;
  kind: 'index' | 'volatility';
  region: 'US' | 'EU';
  price: PriceSpec;
}

export const INDICES: DemoIndex[] = [
  {
    id: 'idx_spx',
    name: 'S&P 500',
    shortName: 'S&P 500',
    kind: 'index',
    region: 'US',
    price: {
      calendar: 'US',
      seed: 9001,
      annualVol: 0.15,
      start: 5872.0,
      previousClose: 6863.0,
      latest: 6912.4,
      sessionClose: 6921.8,
      shape: { from: '2026-08-24', to: '2026-10-16', drift: 0.0008, amplitude: 0.004 },
    },
  },
  {
    id: 'idx_ccmp',
    name: 'Nasdaq Composite',
    shortName: 'Nasdaq',
    kind: 'index',
    region: 'US',
    price: {
      calendar: 'US',
      seed: 9002,
      annualVol: 0.19,
      start: 18950.0,
      previousClose: 22923.4,
      latest: 23184.7,
      sessionClose: 23215.2,
    },
  },
  {
    id: 'idx_vix',
    name: 'Cboe Volatility Index',
    shortName: 'VIX',
    kind: 'volatility',
    region: 'US',
    price: {
      calendar: 'US',
      seed: 9003,
      annualVol: 0.9,
      start: 16.2,
      previousClose: 19.03,
      latest: 18.42,
      sessionClose: 18.1,
    },
  },
  {
    id: 'idx_sxxp',
    name: 'STOXX Europe 600',
    shortName: 'STOXX 600',
    kind: 'index',
    region: 'EU',
    price: {
      calendar: 'EU',
      seed: 9004,
      annualVol: 0.14,
      start: 512.4,
      previousClose: 566.12,
      latest: 568.3,
      shape: { from: '2026-08-24', to: '2026-10-16', drift: 0.0008, amplitude: 0.0035 },
    },
  },
];

export const INDEX_BY_ID = new Map(INDICES.map((index) => [index.id, index]));
