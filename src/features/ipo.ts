import { formatMoney, formatNumber } from '@/domain/format';
import type { IpoIssuer } from '@/data/types';
import { dayLabel } from './earnings';

/**
 * IPO labelling (spec pages 31, 50). Indicative terms and pending dates are never formatted as
 * final or confirmed; missing terms read as "not disclosed", never as zero.
 */

export function priceTerms(ipo: IpoIssuer): { value: string; label: string; final: boolean } {
  if (ipo.finalPrice)
    return {
      value: formatMoney(ipo.finalPrice, ipo.currency),
      label: 'Final offer price',
      final: true,
    };
  if (ipo.rangeLow && ipo.rangeHigh) {
    const low = formatMoney(ipo.rangeLow, ipo.currency, ipo.rangeLow.endsWith('.00') ? 0 : 2);
    const high = formatNumber(ipo.rangeHigh, ipo.rangeHigh.endsWith('.00') ? 0 : 2);
    return { value: `${low}–${high}`, label: 'Indicative range', final: false };
  }
  return { value: '—', label: 'Not disclosed', final: false };
}

/** Short date fact for rows; the note always says whether the date is confirmed. */
export function expectedDateText(ipo: IpoIssuer): { value: string; note: string; spoken: string } {
  if (ipo.status === 'listed' && ipo.listedAt) {
    const day = dayLabel(ipo.listedAt.slice(0, 10)).replace(/^\w+ /, '');
    return { value: day, note: 'Listed', spoken: `listed ${day}` };
  }
  if (ipo.status === 'postponed')
    return { value: 'Postponed', note: 'No new date', spoken: 'postponed, no new date' };
  if (ipo.status === 'withdrawn')
    return { value: 'Withdrawn', note: 'Cancelled', spoken: 'withdrawn' };
  if (!ipo.expectedDate) return { value: 'Pending', note: 'Date', spoken: 'date pending' };
  const day = dayLabel(ipo.expectedDate).replace(/^\w+ /, '');
  return ipo.dateConfirmed
    ? { value: day, note: 'Expected', spoken: `expected ${day}` }
    : { value: day, note: 'Unconfirmed', spoken: `expected ${day}, not yet confirmed` };
}

export const IPO_STATUS_LABEL: Record<IpoIssuer['status'], string> = {
  upcoming: 'Upcoming',
  priced: 'Priced',
  listed: 'Listed',
  postponed: 'Postponed',
  withdrawn: 'Withdrawn',
};

export const SECTOR_DETAIL: Record<string, string> = {
  Software: 'Enterprise software',
  Healthcare: 'Healthcare',
  Energy: 'Energy storage',
  Industrials: 'Electric mobility',
  Financials: 'Payments',
};

export const IPO_CHECKLIST: { id: string; title: string; detail: string }[] = [
  {
    id: 'terms',
    title: 'Offer terms',
    detail:
      'Check whether the price range is indicative or final, how many shares are offered and whether the range has been revised. A raised range signals demand but also a higher starting valuation.',
  },
  {
    id: 'float',
    title: 'Free float',
    detail:
      'The share of the company available to trade after listing. A small float can make the price volatile in the first weeks, especially before lock-ups expire.',
  },
  {
    id: 'proceeds',
    title: 'Use of proceeds',
    detail:
      'Primary proceeds fund the company; secondary proceeds go to selling shareholders. Read how much funds growth versus debt repayment or existing owners.',
  },
  {
    id: 'lockup',
    title: 'Lock-up period',
    detail:
      'Insiders usually agree not to sell for a period, often 180 days. The expiry date can add supply; note it before following a new listing.',
  },
];
