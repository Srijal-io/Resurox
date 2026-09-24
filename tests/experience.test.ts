import test from 'node:test';
import assert from 'node:assert';
import { calculateExperienceFromDates, parseDatePoint, extractInterval } from '../lib/scoring/experience';

test('SC-05: Pure TypeScript Experience Date Range Parser', async (t) => {
  const fixedNow = new Date('2026-09-24T12:00:00Z');

  await t.test('merges overlapping concurrent roles without double counting', () => {
    // Job 1: Jan 2020 to Dec 2022 (3 years)
    // Job 2: Jun 2021 to Dec 2023 (overlaps from Jun 2021 to Dec 2022)
    // Combined span: Jan 2020 to Dec 2023 = exactly 4.0 years (48 months)
    const result = calculateExperienceFromDates(
      [
        { startDate: '01/2020', endDate: '12/2022' },
        { startDate: '06/2021', endDate: '12/2023' },
      ],
      0,
      fixedNow
    );

    assert.strictEqual(result.totalYears, 4);
    assert.strictEqual(result.isEstimate, false);
    assert.strictEqual(result.mergedRanges.length, 1);
  });

  await t.test('handles non-overlapping gaps correctly', () => {
    // Role 1: Jan 2018 to Dec 2019 (2 years)
    // Gap: 2020
    // Role 2: Jan 2021 to Dec 2022 (2 years)
    // Total: 4 years
    const result = calculateExperienceFromDates(
      [
        { startDate: 'Jan 2018', endDate: 'Dec 2019' },
        { startDate: 'Jan 2021', endDate: 'Dec 2022' },
      ],
      0,
      fixedNow
    );

    assert.strictEqual(result.totalYears, 4);
    assert.strictEqual(result.mergedRanges.length, 2);
  });

  await t.test('resolves "Present" and "Current" to injected clock', () => {
    // Role: Jan 2024 to Present (Sep 2026) -> 2 years and 9 months (33 months) ≈ 3 years
    const result = calculateExperienceFromDates(
      [{ startDate: 'January 2024', endDate: 'Present' }],
      0,
      fixedNow
    );

    assert.strictEqual(result.totalYears, 3);
    assert.strictEqual(result.isEstimate, false);
  });

  await t.test('ignores invalid ranges where end < start (swapped dates)', () => {
    const result = calculateExperienceFromDates(
      [
        { startDate: '2023', endDate: '2020' }, // Invalid: ignored
        { startDate: '2020', endDate: '2022' }, // Valid: 2020-01 to 2022-12 = 36 months = 3 years
      ],
      0,
      fixedNow
    );

    assert.strictEqual(result.totalYears, 3);
  });

  await t.test('clamps future start dates (cannot have future experience)', () => {
    const result = calculateExperienceFromDates(
      [
        { startDate: '2028', endDate: '2030' }, // In future -> ignored
        { startDate: '2022', endDate: '2024' }, // Valid 3 years
      ],
      0,
      fixedNow
    );

    assert.strictEqual(result.totalYears, 3);
  });

  await t.test('caps experience at maximum 60 years', () => {
    const result = calculateExperienceFromDates(
      [{ startDate: '1960', endDate: '2026' }], // 67 years
      0,
      fixedNow
    );

    assert.strictEqual(result.totalYears, 60);
  });

  await t.test('falls back to extracted estimate if no usable dates exist with isEstimate: true', () => {
    const result = calculateExperienceFromDates([], 5, fixedNow);

    assert.strictEqual(result.totalYears, 5);
    assert.strictEqual(result.isEstimate, true);
    assert.strictEqual(result.mergedRanges.length, 0);
  });

  await t.test('supports common format variations', () => {
    const p1 = parseDatePoint('03/2018', fixedNow);
    assert.deepStrictEqual(p1, { year: 2018, month: 3 });

    const p2 = parseDatePoint('March 2019', fixedNow);
    assert.deepStrictEqual(p2, { year: 2019, month: 3 });

    const p3 = parseDatePoint('2021', fixedNow);
    assert.deepStrictEqual(p3, { year: 2021, month: 1 });

    const p4 = parseDatePoint('current', fixedNow);
    assert.deepStrictEqual(p4, { year: 2026, month: 9 });
  });
});
