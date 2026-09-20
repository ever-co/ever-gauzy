import { TransformFnParams } from 'class-transformer';
import { ColumnNumericTransformerPipe, roundToScale } from './column-numeric-transformer.pipe';

/**
 * Largest value `numeric(14,2)` / `decimal(14,2)` can hold. Validate against it (`@Max`) so an
 * out-of-range rate is a clean 400 from the DTO instead of a database overflow, and so a rollback
 * to the old `integer` column cannot be blocked by a value it could never hold.
 */
export const BILLING_RATE_MAX = 999999999999.99;

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
