import { describe, expect, it } from 'vitest';
import {
  isWithinQuietHours,
  nextLocalOccurrence,
  nextPermittedDelivery,
  zonedParts,
  zonedTimeToInstant,
  zoneOffsetMinutes,
} from '../time';

const LJ = 'Europe/Ljubljana';
const NY = 'America/New_York';

describe('zone offsets', () => {
  it('reads summer and winter offsets', () => {
    expect(zoneOffsetMinutes(Date.UTC(2026, 9, 21, 12), LJ)).toBe(120);
    expect(zoneOffsetMinutes(Date.UTC(2026, 9, 26, 12), LJ)).toBe(60);
    expect(zoneOffsetMinutes(Date.UTC(2026, 9, 21, 12), NY)).toBe(-240);
    expect(zoneOffsetMinutes(Date.UTC(2026, 10, 2, 12), NY)).toBe(-300);
  });

  it('extracts local wall-clock parts', () => {
    expect(zonedParts(Date.UTC(2026, 9, 21, 18, 25), NY)).toMatchObject({
      hour: 14,
      minute: 25,
      weekday: 3,
    });
  });
});

describe('page 38 DST rules', () => {
  it('a skipped local time resolves to the first valid time afterwards', () => {
    // 29 Mar 2026: Ljubljana clocks jump from 02:00 to 03:00.
    const result = zonedTimeToInstant({ year: 2026, month: 3, day: 29, hour: 2, minute: 30 }, LJ);
    expect(result.resolution).toBe('skipped');
    expect(result.instant).toBe(Date.UTC(2026, 2, 29, 1, 0));
    expect(zonedParts(result.instant, LJ)).toMatchObject({ hour: 3, minute: 0 });
  });

  it('a repeated local time resolves to its first occurrence', () => {
    // 25 Oct 2026: 02:30 occurs twice (CEST then CET).
    const result = zonedTimeToInstant({ year: 2026, month: 10, day: 25, hour: 2, minute: 30 }, LJ);
    expect(result.resolution).toBe('repeated');
    expect(result.instant).toBe(Date.UTC(2026, 9, 25, 0, 30));
  });

  it('handles the US transitions', () => {
    const spring = zonedTimeToInstant({ year: 2026, month: 3, day: 8, hour: 2, minute: 15 }, NY);
    expect(spring.resolution).toBe('skipped');
    expect(zonedParts(spring.instant, NY)).toMatchObject({ hour: 3, minute: 0 });
    const fall = zonedTimeToInstant({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }, NY);
    expect(fall.resolution).toBe('repeated');
    expect(fall.instant).toBe(Date.UTC(2026, 10, 1, 5, 30));
  });

  it('an ordinary time is exact', () => {
    const result = zonedTimeToInstant({ year: 2026, month: 10, day: 21, hour: 8, minute: 0 }, LJ);
    expect(result).toEqual({ instant: Date.UTC(2026, 9, 21, 6, 0), resolution: 'exact' });
  });
});

describe('quiet hours', () => {
  const quiet = { enabled: true, start: '22:00', end: '07:00', timeZone: LJ };

  it('span midnight', () => {
    expect(isWithinQuietHours(Date.UTC(2026, 9, 21, 20, 30), quiet)).toBe(true); // 22:30
    expect(isWithinQuietHours(Date.UTC(2026, 9, 22, 4, 59), quiet)).toBe(true); // 06:59
    expect(isWithinQuietHours(Date.UTC(2026, 9, 22, 5, 0), quiet)).toBe(false); // 07:00
    expect(isWithinQuietHours(Date.UTC(2026, 9, 21, 12, 0), quiet)).toBe(false);
  });

  it('defer to the next permitted local time, across a DST change', () => {
    // 24 Oct 23:00 CEST -> 25 Oct 07:00 CET (= 06:00Z) after clocks go back.
    expect(nextPermittedDelivery(Date.UTC(2026, 9, 24, 21, 0), quiet)).toBe(
      Date.UTC(2026, 9, 25, 6, 0),
    );
    const outside = Date.UTC(2026, 9, 21, 12, 0);
    expect(nextPermittedDelivery(outside, quiet)).toBe(outside);
  });

  it('can be disabled or empty', () => {
    expect(isWithinQuietHours(Date.UTC(2026, 9, 21, 21), { ...quiet, enabled: false })).toBe(false);
    expect(
      isWithinQuietHours(Date.UTC(2026, 9, 21, 21), { ...quiet, start: '07:00', end: '07:00' }),
    ).toBe(false);
  });
});

describe('daily briefing', () => {
  it('08:00 Europe/Ljubljana resolves to the next local occurrence', () => {
    expect(nextLocalOccurrence(Date.UTC(2026, 9, 21, 18, 25), '08:00', LJ)).toBe(
      Date.UTC(2026, 9, 22, 6, 0),
    );
    expect(nextLocalOccurrence(Date.UTC(2026, 9, 21, 5, 0), '08:00', LJ)).toBe(
      Date.UTC(2026, 9, 21, 6, 0),
    );
  });
});
