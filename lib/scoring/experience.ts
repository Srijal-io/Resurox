/**
 * Pure Date-Range Experience Calculator (SC-05, PRD §8).
 * 
 * Computes candidate total years of experience from extracted date ranges in pure TypeScript:
 * - Parses month/year and year-only ranges ('Jan 2020 – Present', '2019–2021', '03/2018 – 06/2020').
 * - Merges overlapping ranges so concurrent roles are not double-counted.
 * - Resolves 'Present' / 'Current' using an explicitly injected `now: Date`.
 * - Ignores invalid ranges where end < start, clamps future starts.
 * - Caps maximum calculated experience at 60 years.
 * - Falls back to extracted estimate if no usable dates exist, with `isEstimate: true`.
 * 
 * Purity: No I/O, no system clock access unless injected.
 */

export interface DateRangeInput {
  startDate?: string;
  endDate?: string;
  rawText?: string;
}

export interface ExperienceCalculationResult {
  totalYears: number;
  isEstimate: boolean;
  mergedRanges: Array<{ startYear: number; startMonth: number; endYear: number; endMonth: number }>;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

interface ParsedPoint {
  year: number;
  month: number; // 1-12
}

interface NormalizedInterval {
  startMonths: number; // Total months from year 0 (year * 12 + (month - 1))
  endMonths: number;
}

export function parseDatePoint(dateStr: string, now: Date): ParsedPoint | null {
  if (!dateStr || !dateStr.trim()) return null;
  const clean = dateStr.trim().toLowerCase();

  // Present / Current / Ongoing
  if (/present|current|ongoing|now|today/i.test(clean)) {
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    };
  }

  // MM/YYYY or M/YYYY
  const slashMatch = clean.match(/^(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = parseInt(slashMatch[1], 10);
    const year = parseInt(slashMatch[2], 10);
    if (month >= 1 && month <= 12 && year >= 1950 && year <= 2100) {
      return { year, month };
    }
  }

  // Month Name + Year (e.g., 'Jan 2020', 'January 2020', 'Mar, 2019')
  const monthNameMatch = clean.match(/^([a-z]+)[,\s]+(\d{4})$/i);
  if (monthNameMatch) {
    const monthKey = monthNameMatch[1].toLowerCase();
    const year = parseInt(monthNameMatch[2], 10);
    const month = MONTH_NAMES[monthKey];
    if (month && year >= 1950 && year <= 2100) {
      return { year, month };
    }
  }

  // YYYY-MM
  const dashMatch = clean.match(/^(\d{4})-(\d{1,2})$/);
  if (dashMatch) {
    const year = parseInt(dashMatch[1], 10);
    const month = parseInt(dashMatch[2], 10);
    if (month >= 1 && month <= 12 && year >= 1950 && year <= 2100) {
      return { year, month };
    }
  }

  // Year only (e.g. '2020')
  const yearMatch = clean.match(/^(\d{4})$/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    if (year >= 1950 && year <= 2100) {
      return { year, month: 1 };
    }
  }

  return null;
}

/**
 * Extracts date range intervals from string pairs or single range strings.
 */
export function extractInterval(
  startStr?: string,
  endStr?: string,
  now: Date = new Date()
): NormalizedInterval | null {
  const currentTotalMonths = now.getFullYear() * 12 + now.getMonth();

  let startPoint: ParsedPoint | null = null;
  let endPoint: ParsedPoint | null = null;

  if (startStr && endStr) {
    startPoint = parseDatePoint(startStr, now);
    endPoint = parseDatePoint(endStr, now);
    // If end is year-only, set month to 12 so the entire year is counted
    if (endPoint && /^\d{4}$/.test(endStr.trim())) {
      endPoint.month = 12;
    }
  } else if (startStr && !endStr) {
    // Single string containing range (e.g. '2019 - 2021' or 'Jan 2020 to Present')
    const rangeParts = startStr.split(/\s*(?:–|-|—|to)\s*/i);
    if (rangeParts.length >= 2) {
      startPoint = parseDatePoint(rangeParts[0], now);
      endPoint = parseDatePoint(rangeParts[1], now);
      if (endPoint && /^\d{4}$/.test(rangeParts[1].trim())) {
        endPoint.month = 12;
      }
    } else {
      startPoint = parseDatePoint(startStr, now);
      endPoint = startPoint ? { ...startPoint, month: 12 } : null;
    }
  }

  if (!startPoint || !endPoint) return null;

  const startMonths = startPoint.year * 12 + (startPoint.month - 1);
  let endMonths = endPoint.year * 12 + (endPoint.month - 1);

  // Ignore invalid ranges where end < start
  if (endMonths < startMonths) return null;

  // Clamp future start dates (cannot have experience from the future)
  if (startMonths > currentTotalMonths) return null;

  // Clamp future end dates to current month
  if (endMonths > currentTotalMonths) {
    endMonths = currentTotalMonths;
  }

  return { startMonths, endMonths };
}

/**
 * Calculates total experience years from experience entries by merging overlapping intervals.
 */
export function calculateExperienceFromDates(
  experienceEntries: DateRangeInput[] = [],
  fallbackEstimatedYears: number = 0,
  now: Date = new Date()
): ExperienceCalculationResult {
  const intervals: NormalizedInterval[] = [];

  for (const entry of experienceEntries) {
    const interval = extractInterval(entry.startDate, entry.endDate, now);
    if (interval) {
      intervals.push(interval);
    }
  }

  if (intervals.length === 0) {
    const clampedFallback = Math.max(0, Math.min(60, Number.isFinite(fallbackEstimatedYears) ? fallbackEstimatedYears : 0));
    return {
      totalYears: clampedFallback,
      isEstimate: true,
      mergedRanges: [],
    };
  }

  // Sort intervals by startMonths ascending
  intervals.sort((a, b) => a.startMonths - b.startMonths);

  // Merge overlapping or contiguous intervals
  const merged: NormalizedInterval[] = [];
  let current = { ...intervals[0] };

  for (let i = 1; i < intervals.length; i++) {
    const next = intervals[i];
    if (next.startMonths <= current.endMonths + 1) {
      // Overlapping or adjacent
      current.endMonths = Math.max(current.endMonths, next.endMonths);
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);

  // Calculate total months across merged intervals
  let totalMonths = 0;
  const mergedRanges = merged.map((m) => {
    // Adding 1 because month range is inclusive [startMonth, endMonth]
    const monthsInInterval = Math.max(1, m.endMonths - m.startMonths + 1);
    totalMonths += monthsInInterval;

    return {
      startYear: Math.floor(m.startMonths / 12),
      startMonth: (m.startMonths % 12) + 1,
      endYear: Math.floor(m.endMonths / 12),
      endMonth: (m.endMonths % 12) + 1,
    };
  });

  const rawYears = Math.round((totalMonths / 12) * 10) / 10;
  const clampedYears = Math.max(0, Math.min(60, Math.round(rawYears)));

  return {
    totalYears: clampedYears,
    isEstimate: false,
    mergedRanges,
  };
}
