/**
 * Help and legal copy. Plain language, specific to how this build actually behaves.
 * Legal pages describe the demo build; a live deployment replaces them with reviewed policies.
 */

export interface HelpArticle {
  id: string;
  group:
    | 'Getting started'
    | 'Data and prices'
    | 'Alerts'
    | 'Paper portfolio'
    | 'Research and record'
    | 'Account and privacy';
  title: string;
  summary: string;
  sections: { heading: string; paragraphs: string[] }[];
}

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: 'how-picks-work',
    group: 'Getting started',
    title: 'How daily picks are chosen',
    summary: 'Up to five ideas a day, each linked to a dated, reviewed thesis.',
    sections: [
      {
        heading: 'The selection',
        paragraphs: [
          'An analyst proposes each pick and a second reviewer checks identity, prices, dates, units, sources and wording before it is published. On days when the evidence is thin, fewer ideas are published, or none.',
          'Every pick links to its research note: the catalyst, the key risk, the horizon and the conditions that would invalidate the idea.',
        ],
      },
      {
        heading: 'Ratings',
        paragraphs: [
          'Momentum is computed by a published rule from the price series. Quality and risk are analyst assessments and say who made them. There are no confidence percentages and no predicted returns.',
        ],
      },
      {
        heading: 'Not advice',
        paragraphs: [
          'Picks are research for your own decisions. They do not consider your circumstances and are not a recommendation to buy or sell.',
        ],
      },
    ],
  },
  {
    id: 'reading-a-pick',
    group: 'Getting started',
    title: 'Reading the price chart',
    summary: 'Tap to pin a point, hold or drag sideways to scrub, use arrow keys on a keyboard.',
    sections: [
      {
        heading: 'Touch',
        paragraphs: [
          'A short tap pins the nearest real observation and shows its time and price. Holding briefly, or dragging sideways, scrubs along the line; dragging up or down scrolls the page instead. Tap elsewhere to clear a pin.',
          'The headline price changes to the inspected point while you scrub and says “Inspecting”, so you always know whether you are looking at the latest quote.',
        ],
      },
      {
        heading: 'Keyboard and screen readers',
        paragraphs: [
          'Focus the chart, then use Left and Right to step through observations, Home and End to jump, Enter to pin and Escape to clear. Each chart also has a data table with the same values.',
        ],
      },
      {
        heading: 'Gaps',
        paragraphs: [
          'Missing observations break the line. Nothing is interpolated, so a gap means there was no data, not a flat price.',
        ],
      },
    ],
  },
  {
    id: 'data-status',
    group: 'Data and prices',
    title: 'Live, delayed, cached and demo data',
    summary: 'Every quote says where it came from and how old it is.',
    sections: [
      {
        heading: 'Labels you will see',
        paragraphs: [
          'Real time and Demo data show the time of the latest observation. Delayed shows how many minutes behind the market the quote is. When live updates stop, the quote says when it was last received. Offline copies say when they were saved on your device.',
          'A missing value is shown as a dash with the reason, never as zero.',
        ],
      },
      {
        heading: 'Currencies',
        paragraphs: [
          'Quotes always use the company’s own trading currency. Your currency setting only affects converted totals such as the paper portfolio.',
        ],
      },
    ],
  },
  {
    id: 'demo-data',
    group: 'Data and prices',
    title: 'About the demo build',
    summary: 'Real company names, simulated prices and illustrative research.',
    sections: [
      {
        heading: 'What is simulated',
        paragraphs: [
          'The demo shows one trading session, Wednesday 21 October 2026, with prices generated deterministically so every visit sees the same day. Research, outcomes, earnings figures and IPO terms are illustrative.',
          'Accounts, lists, alerts and paper trades are stored only in this browser. Nothing is sent to a server, and no email is delivered; messages appear in the demo mailbox instead.',
        ],
      },
      {
        heading: 'Demo tools',
        paragraphs: [
          'Profile → Demo tools moves the market clock forward, delays or interrupts the data feed, and simulates offline, slow or failed requests, so you can see how the app behaves when things go wrong.',
        ],
      },
    ],
  },
  {
    id: 'price-alerts',
    group: 'Alerts',
    title: 'How price alerts fire',
    summary: 'Crossings of a threshold, at most once per crossing, never on stale prices.',
    sections: [
      {
        heading: 'Crossing, not touching',
        paragraphs: [
          'An alert fires when a new observation crosses your threshold from the other side. If the price is already beyond the threshold when you create the alert, it waits for a new crossing and says so before you save.',
          'A one-time alert completes after it fires. A repeating alert re-arms after the price returns to the starting side and a five-minute cooldown passes.',
        ],
      },
      {
        heading: 'When data is late',
        paragraphs: [
          'If the feed is interrupted, price alerts stop evaluating and re-baseline when fresh quotes return, so a stale price never triggers an alert.',
        ],
      },
      {
        heading: 'Delivery',
        paragraphs: [
          'Every alert is recorded in your inbox straight away. Push and email follow your delivery settings; during quiet hours they wait until quiet hours end, and the inbox shows both the generation and delivery times.',
        ],
      },
    ],
  },
  {
    id: 'earnings-reminders',
    group: 'Alerts',
    title: 'Earnings reminders',
    summary: '24 hours before a confirmed release, or 08:00 your time on the day.',
    sections: [
      {
        heading: 'Timing',
        paragraphs: [
          'When the company has confirmed the release time, the reminder arrives 24 hours before it. When only the date is known, it arrives at 08:00 in your time zone on that date and says the time is unconfirmed. If you set a reminder less than a day before the release, it is sent straight away.',
        ],
      },
    ],
  },
  {
    id: 'paper-portfolio',
    group: 'Paper portfolio',
    title: 'How the paper portfolio is valued',
    summary: 'A ledger of simulated trades, valued with sample quotes and compared fairly.',
    sections: [
      {
        heading: 'The ledger',
        paragraphs: [
          'Every paper trade is a dated ledger entry. Corrections add a reversing entry, so the history is never rewritten. Average entry uses the average-cost method and includes the costs you enter.',
        ],
      },
      {
        heading: 'Returns',
        paragraphs: [
          'Performance is time-weighted, so deposits do not look like gains. The benchmark covers the same sessions as a price index; dividends are excluded from both. If a quote is missing, the value is marked partial instead of counting the position as zero.',
        ],
      },
    ],
  },
  {
    id: 'pick-outcomes',
    group: 'Research and record',
    title: 'How pick outcomes are measured',
    summary: 'Next-session open, 20 sessions, before costs, against a matched benchmark.',
    sections: [
      {
        heading: 'The rule',
        paragraphs: [
          'Each outcome starts at the next regular-session open after publication and runs 20 trading sessions. Returns are price returns in the company’s currency, before costs, compared with the S&P 500 or STOXX Europe 600 over the same sessions.',
          'Every pick stays in the record, including losses, closed theses and delisted companies. Windows still running are shown as pending and are not counted.',
        ],
      },
    ],
  },
  {
    id: 'ipo-checklist',
    group: 'Research and record',
    title: 'Reading an IPO',
    summary: 'Indicative versus final terms, float, proceeds and lock-ups.',
    sections: [
      {
        heading: 'Terms',
        paragraphs: [
          'A price range is indicative until the offer is priced; expected dates can move until they are confirmed. The app labels both so they are never mistaken for final terms.',
          'Followed issuers keep the same identity after listing, so your list, alerts and research carry over to the quote page.',
        ],
      },
    ],
  },
  {
    id: 'offline',
    group: 'Account and privacy',
    title: 'Offline use and installing the app',
    summary: 'What works without a connection and how to add the app to your home screen.',
    sections: [
      {
        heading: 'Offline',
        paragraphs: [
          'Screens you opened recently stay readable offline and are labelled as saved copies with their time. Saving, alerts and paper trades need a connection; drafts stay on the device until you are back online.',
        ],
      },
      {
        heading: 'Install',
        paragraphs: [
          'On iPhone, use Share → Add to Home Screen in Safari. On Android and desktop Chrome, use Install app from the browser menu.',
        ],
      },
    ],
  },
  {
    id: 'accessibility',
    group: 'Account and privacy',
    title: 'Accessibility',
    summary: 'Text size, reduced motion, contrast and screen reader support.',
    sections: [
      {
        heading: 'Settings',
        paragraphs: [
          'App settings adds text sizes on top of your browser’s, reduces motion to fades and instant changes, and increases contrast. Colour is never the only signal: gains and losses always carry a sign and a spoken direction.',
          'Every control is reachable by keyboard with a visible focus outline. Charts have keyboard inspection and a data table. If something does not work with your assistive technology, please report it from Help.',
        ],
      },
    ],
  },
];

export interface LegalDocument {
  id: string;
  title: string;
  updated: string;
  sections: { heading: string; paragraphs: string[] }[];
}

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    id: 'terms',
    title: 'Terms of use',
    updated: '2026-10-01',
    sections: [
      {
        heading: 'The service',
        paragraphs: [
          'Stock Picks publishes research, a pick archive and tools such as watchlists, alerts and a paper portfolio. This demo build uses simulated prices and illustrative content.',
        ],
      },
      {
        heading: 'Not advice',
        paragraphs: [
          'Content is general research, not personal investment advice. You are responsible for your own decisions. Past outcomes, real or sample, do not predict future results.',
        ],
      },
      {
        heading: 'Your account',
        paragraphs: [
          'Keep your password private. You can export or delete your data at any time from Privacy & data.',
        ],
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy notice',
    updated: '2026-10-01',
    sections: [
      {
        heading: 'What is collected',
        paragraphs: [
          'Your email and display name, a password hash, your preferences, and the things you create: lists, alerts and their history, saved research, scenarios, paper trades and journal notes. Diagnostics record request identifiers and error classes, not content.',
        ],
      },
      {
        heading: 'Where it lives',
        paragraphs: [
          'In this demo build, everything stays in your browser’s storage on this device. There are no advertising or analytics trackers.',
        ],
      },
      {
        heading: 'Your choices',
        paragraphs: [
          'Export your data as JSON, sign out to remove private copies from a device, or delete your account to remove it entirely. Push permission can be withdrawn in your browser at any time.',
        ],
      },
    ],
  },
  {
    id: 'disclosures',
    title: 'Research disclosures',
    updated: '2026-10-01',
    sections: [
      {
        heading: 'Method',
        paragraphs: [
          'Picks follow editorial methodology editorial-v1 and outcomes follow outcomes-v1, both described in the app. Ratings say whether they are rule-based or analyst assessments.',
          'Research in this build is illustrative and not written about real financial results. Company names are real for recognisability only.',
        ],
      },
    ],
  },
  {
    id: 'licences',
    title: 'Licences',
    updated: '2026-10-01',
    sections: [
      {
        heading: 'Typefaces',
        paragraphs: [
          'Display type is FreeSerif Bold from GNU FreeFont (GPL 3 or later, with the GNU FreeFont font exception, so pages that use it are not covered by the GPL). Interface type is Roboto Flex (SIL Open Font License 1.1). The licence texts ship with the fonts in /fonts.',
        ],
      },
      {
        heading: 'Software',
        paragraphs: [
          'Built with React, React Router, TanStack Query, big.js, Lucide icons and Workbox, under their respective open-source licences (MIT, ISC).',
        ],
      },
    ],
  },
];
