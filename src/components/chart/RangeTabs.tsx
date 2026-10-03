import type { ChartRange } from '@/data/types';
import { Segmented } from '../Tabs';

export const RANGES: ChartRange[] = ['1D', '1W', '1M', '3M', '1Y'];

/**
 * Range control: tap feedback is immediate and the requested range shows as pending until its
 * data is ready; the committed range, chart, axes and headline then change together.
 */
export function RangeTabs({
  value,
  requested,
  onChange,
  label = 'Chart range',
}: {
  value: ChartRange;
  requested: ChartRange;
  onChange: (range: ChartRange) => void;
  label?: string;
}) {
  return (
    <Segmented
      label={label}
      variant="ghost"
      size="sm"
      value={requested}
      pending={requested !== value ? requested : null}
      onChange={onChange}
      items={RANGES.map((range) => ({ value: range, label: range }))}
    />
  );
}
