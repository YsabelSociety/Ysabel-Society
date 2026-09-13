'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Picker } from './controls';
import { type Range } from '@/lib/analytics';
import {
  REVIEW_PERIODS,
  reviewPeriodRange,
  reviewPeriodLabel,
  shiftReviewPeriod,
  validDay,
  type ReviewDateSelection,
} from '@/lib/review-dates';

export function ReviewDateControls({
  value,
  onChange,
  dashboard,
  label = 'Review',
}: {
  value: ReviewDateSelection;
  onChange: (v: ReviewDateSelection) => void;
  dashboard: Range;
  label?: string;
}) {
  const range = reviewPeriodRange(value, dashboard);
  const calendar = ['Daily', 'Weekly', 'Monthly', 'Yearly'].includes(
    value.mode,
  );
  const invalid =
    range &&
    (!validDay(range.start) || !validDay(range.end) || range.start > range.end);
  return (
    <div className="review-date-controls">
      <div className="community-toolbar">
        <Picker
          label={label + ' period'}
          value={value.mode}
          options={[...REVIEW_PERIODS]}
          onChange={(mode) =>
            onChange({ ...value, mode: mode as ReviewDateSelection['mode'] })
          }
        />
        {calendar && (
          <>
            <button
              className="secondary"
              aria-label={label + ' previous period'}
              onClick={() => onChange(shiftReviewPeriod(value, -1))}
            >
              <ChevronLeft size={16} />
            </button>
            <label>
              {value.mode === 'Weekly'
                ? 'Week containing'
                : value.mode === 'Monthly'
                  ? 'Month'
                  : value.mode === 'Yearly'
                    ? 'Year'
                    : 'Day'}
              <input
                aria-label={label + ' calendar period'}
                type={
                  value.mode === 'Monthly'
                    ? 'month'
                    : value.mode === 'Yearly'
                      ? 'number'
                      : 'date'
                }
                min={value.mode === 'Yearly' ? '1900' : undefined}
                max={value.mode === 'Yearly' ? '9999' : undefined}
                value={
                  value.mode === 'Monthly'
                    ? value.anchor.slice(0, 7)
                    : value.mode === 'Yearly'
                      ? value.anchor.slice(0, 4)
                      : value.anchor
                }
                onChange={(e) => {
                  const v = e.target.value;
                  onChange({
                    ...value,
                    anchor:
                      value.mode === 'Monthly'
                        ? v + '-01'
                        : value.mode === 'Yearly'
                          ? v + '-01-01'
                          : v,
                  });
                }}
              />
            </label>
            <button
              className="secondary"
              aria-label={label + ' next period'}
              onClick={() => onChange(shiftReviewPeriod(value, 1))}
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}
        {value.mode === 'Custom dates' && (
          <>
            <label>
              From
              <input
                aria-label={label + ' start date'}
                type="date"
                value={value.start}
                onChange={(e) => onChange({ ...value, start: e.target.value })}
              />
            </label>
            <label>
              Through
              <input
                aria-label={label + ' end date'}
                type="date"
                value={value.end}
                min={value.start}
                onChange={(e) => onChange({ ...value, end: e.target.value })}
              />
            </label>
          </>
        )}
        {range && (
          <label className="review-date-toggle">
            <input
              type="checkbox"
              checked={value.approximate}
              onChange={(e) =>
                onChange({ ...value, approximate: e.target.checked })
              }
            />
            Include approximate date matches
          </label>
        )}
      </div>
      {invalid ? (
        <p className="save-error" role="alert">
          Choose valid dates with the end on or after the start.
        </p>
      ) : (
        <p className="source-asof">
          {reviewPeriodLabel(value, dashboard)}.{' '}
          {range ? 'Weeks run Monday–Sunday. ' : ''}Dates apply to reviews and
          the critical report below.
        </p>
      )}
      {range && (
        <p className="source-asof">
          {value.approximate
            ? 'Relative labels such as “3 weeks ago” are included when their estimated interval overlaps this period. These are possible matches, not exact daily counts; the same review may overlap adjacent periods.'
            : 'Only reviews with exact publication dates are included.'}
        </p>
      )}
    </div>
  );
}
