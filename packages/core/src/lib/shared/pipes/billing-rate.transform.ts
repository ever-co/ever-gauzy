import { TransformFnParams } from 'class-transformer';
import { ColumnNumericTransformerPipe, roundToScale } from './column-numeric-transformer.pipe';

/**
 * Largest accepted rate: the old `integer` column's maximum, which is what these columns could hold
 * before `numeric(14,2)`. Validating against it (`@Max`) keeps an out-of-range rate a clean 400 from
 * the DTO instead of a database overflow, and keeps every stored value revertible — rolling the
 * columns back to `integer` cannot overflow on a value saved after the upgrade. `numeric(14,2)` is
 * deliberately wider (999,999,999,999.99); the cap can be raised without another migration.
 */
export const BILLING_RATE_MAX = 2147483647;

/**
 * Column options for a money rate (`billRateValue`, `minimumBillingRate` on Employee and Candidate).
 * `numeric(14,2)` holds every value the old `integer` column could (up to 2,147,483,647) and keeps
 * cents (issue #10199).
 */
export const billingRateColumn = () => ({
	nullable: true,
	type: 'numeric' as const,
	precision: 14,
	scale: 2,
	transformer: new ColumnNumericTransformerPipe(2)
});

/**
 * `@Transform` for a money rate. Keeps cents, but leaves non-numeric input as NaN so `@IsNumber()`
 * still rejects it (as the previous `parseInt` transform did) instead of silently storing 0.
 * Parses like `parseInt` did otherwise: `''`/`null` → 0 and `'10,50'` → 10.
 */
export const toBillingRate = ({ value }: TransformFnParams) => {
	const n = typeof value === 'number' ? value : Number.parseFloat(value || 0);
	return Number.isFinite(n) ? roundToScale(n) : Number.NaN;
};
