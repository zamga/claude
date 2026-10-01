/*
 * The initiation request a visitor is drafting, and the research plan it
 * implies. The draft is kept in memory between the hero form and the initiate
 * page (embedded previews only pass plain #anchors, so it cannot ride in the
 * address). Nothing here leaves the browser.
 */
export interface InitiationDraft {
  company: string;
  country: string;
}

let draft: InitiationDraft = { company: '', country: 'Slovenia' };

export function setDraft(next: InitiationDraft) {
  draft = next;
}

export function getDraft(): InitiationDraft {
  return draft;
}

/** Countries offered, with the code used on serials and the languages the press is read in. */
export const COUNTRY_INFO: Record<string, { code: string; languages: string[]; eu: boolean }> = {
  Slovenia: { code: 'SI', languages: ['Slovenian', 'English'], eu: true },
  Croatia: { code: 'HR', languages: ['Croatian', 'English'], eu: true },
  Serbia: { code: 'RS', languages: ['Serbian', 'English'], eu: false },
  Austria: { code: 'AT', languages: ['German', 'English'], eu: true },
  Germany: { code: 'DE', languages: ['German', 'English'], eu: true },
  Italy: { code: 'IT', languages: ['Italian', 'English'], eu: true },
  Hungary: { code: 'HU', languages: ['Hungarian', 'English'], eu: true },
  Poland: { code: 'PL', languages: ['Polish', 'English'], eu: true },
  Czechia: { code: 'CZ', languages: ['Czech', 'English'], eu: true },
  Slovakia: { code: 'SK', languages: ['Slovak', 'English'], eu: true },
  'Bosnia and Herzegovina': { code: 'BA', languages: ['Bosnian', 'English'], eu: false },
  'North Macedonia': { code: 'MK', languages: ['Macedonian', 'English'], eu: false },
  Montenegro: { code: 'ME', languages: ['Montenegrin', 'English'], eu: false },
  Romania: { code: 'RO', languages: ['Romanian', 'English'], eu: true },
  Bulgaria: { code: 'BG', languages: ['Bulgarian', 'English'], eu: true },
  'United Kingdom': { code: 'GB', languages: ['English'], eu: false },
  'United States': { code: 'US', languages: ['English'], eu: false },
  Other: { code: 'XX', languages: ['English', 'the local language'], eu: false },
};

export const COUNTRIES = Object.keys(COUNTRY_INFO);

export type Listing = 'listed' | 'private' | 'unsure';

export const PURPOSES = ['Investment', 'Credit', 'Acquisition', 'Supplier or customer', 'Other'] as const;
export type Purpose = (typeof PURPOSES)[number];

export interface RequestFile {
  name: string;
  size: number;
}

export interface InitiationRequest {
  company: string;
  country: string;
  listing: Listing;
  ticker: string;
  registration: string;
  website: string;
  files: RequestFile[];
  purpose: Purpose;
  focus: string;
}

export const MAX_FILES = 10;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** Files the engine can read: PDFs with a text layer, filings and pages in HTML or XHTML (ESEF), and text. */
export const ACCEPTED = ['.pdf', '.xhtml', '.html', '.htm', '.xml', '.txt', '.csv'];

export type FieldErrors = Partial<Record<'company' | 'website' | 'files' | 'ticker' | 'code', string>>;

/** The website as an absolute address, or undefined when it is not one. */
export function normaliseWebsite(raw: string): URL | undefined {
  const text = raw.trim();
  if (!text) return undefined;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(text) ? text : `https://${text}`);
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes('.')) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

export function validate(r: InitiationRequest): FieldErrors {
  const errors: FieldErrors = {};
  if (r.company.trim().length < 2) errors.company = 'Enter the company’s name, as registered or as it trades.';
  if (r.website.trim() && !normaliseWebsite(r.website)) errors.website = 'Enter a web address, such as krka.biz.';
  if (r.files.length > MAX_FILES) errors.files = `Attach up to ${MAX_FILES} files.`;
  else {
    const big = r.files.find((f) => f.size > MAX_FILE_BYTES);
    const odd = r.files.find((f) => !ACCEPTED.some((ext) => f.name.toLowerCase().endsWith(ext)));
    if (big) errors.files = `${big.name} is larger than 25 MB.`;
    else if (odd) errors.files = `${odd.name} is not a PDF, a web page or a text file.`;
  }
  return errors;
}

export interface PlanStep {
  title: string;
  detail: string;
  /** Ready: Uncovered can do it from public sources or your files. Needs you: a document only you can supply. */
  status: 'ready' | 'needs-you';
}

const files = (n: number) => `${n} ${n === 1 ? 'document' : 'documents'}`;

/** The research an initiation would run for a request, step by step. */
export function researchPlan(r: InitiationRequest): PlanStep[] {
  const info = COUNTRY_INFO[r.country] ?? COUNTRY_INFO.Other!;
  const listed = r.listing === 'listed';
  const uploaded = r.files.length;
  const name = r.company.trim() || 'the company';
  const steps: PlanStep[] = [];

  const identify =
    r.country === 'Slovenia'
      ? `Match ${name} in the Slovenian business register${r.registration.trim() ? ` by registration number ${r.registration.trim()}` : ' by name and seat'}, with its owners and directors.`
      : r.country === 'United States'
        ? `Match ${name} on SEC EDGAR${r.ticker.trim() ? ` as ${r.ticker.trim()}` : ''}, or in the state register if it is private.`
        : info.eu
          ? `Match ${name} in the ${r.country} business register and the global legal entity index.`
          : `Match ${name} in public registers and on its own site.`;
  steps.push({ title: 'Identify the company', detail: identify, status: 'ready' });

  if (uploaded > 0) {
    steps.push({
      title: 'Read your documents',
      detail: `Extract the statements from the ${files(uploaded)} you attached, keeping page references for every figure.`,
      status: 'ready',
    });
  }
  if (r.country === 'Slovenia') {
    steps.push(
      listed
        ? {
            title: 'Read the filings',
            detail:
              'Annual and interim reports and announcements published through the Ljubljana Stock Exchange, for the last three years.',
            status: 'ready',
          }
        : {
            title: 'Read the filings',
            detail:
              uploaded > 0
                ? 'Check your documents against the annual reports filed with AJPES, the agency that publishes them.'
                : 'Annual reports filed with AJPES for the last three years. AJPES asks for a verified download, so attaching them here saves a step.',
            status: uploaded > 0 ? 'ready' : 'needs-you',
          },
    );
  } else if (r.country === 'United States') {
    steps.push(
      listed
        ? {
            title: 'Read the filings',
            detail: 'Annual and quarterly reports (10-K, 10-Q) and recent 8-K filings on SEC EDGAR.',
            status: 'ready',
          }
        : {
            title: 'Read the filings',
            detail:
              'Private US companies publish no accounts. Attach financial statements so the model has numbers to start from.',
            status: uploaded > 0 ? 'ready' : 'needs-you',
          },
    );
  } else if (info.eu) {
    steps.push(
      listed
        ? {
            title: 'Read the filings',
            detail:
              'Annual reports in the European single electronic format, read as structured data, and exchange announcements.',
            status: 'ready',
          }
        : {
            title: 'Read the filings',
            detail: `Financial statements from the ${r.country} register. Where the register charges for access, attaching them saves a step.`,
            status: uploaded > 0 ? 'ready' : 'needs-you',
          },
    );
  } else {
    steps.push({
      title: 'Read the filings',
      detail: 'Exchange filings or company reports, found by research. If none are public, attach the statements.',
      status: uploaded > 0 || listed ? 'ready' : 'needs-you',
    });
  }

  const site = normaliseWebsite(r.website)?.hostname.replace(/^www\./, '');
  steps.push({
    title: 'Research the business',
    detail: `The company’s own site${site ? ` (${site})` : ''}, the trade press and industry sources, in ${info.languages.join(' and ')}.`,
    status: 'ready',
  });
  steps.push({
    title: 'Build the model',
    detail:
      'Three years of statements, normalised and footnoted, then a five-year forecast with every assumption stated.',
    status: 'ready',
  });
  steps.push({
    title: 'Value it',
    detail: listed
      ? 'Discounted cash flow, dividends and earnings multiples, set against the market price, with what that price implies.'
      : 'Discounted cash flow and peer multiples. With no market price, the range stands on its own, with its sensitivity.',
    status: 'ready',
  });
  const angle: Partial<Record<Purpose, string>> = {
    Credit: ' A credit view: leverage, interest cover and how long the cash lasts.',
    Acquisition: ' An acquisition view: normalised earnings and what a buyer could pay.',
    'Supplier or customer': ' A counterparty view: payment record, concentration and resilience.',
  };
  steps.push({
    title: 'Write the initiation',
    detail: `Thesis, risks and catalysts, every figure footnoted${r.focus.trim() ? ', and an answer to your question' : ''}.${angle[r.purpose] ?? ''}`,
    status: 'ready',
  });
  return steps;
}

/** A readable file size. */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
