import { DecimalString, RoundingMode } from '@gauzy/contracts';
import {
	WORKING_SCALE,
	assertDecimalString,
	divideDecimalUnits,
	formatDecimalUnits,
	multiplyDecimalUnits,
	normalizeDecimalString,
	parseDecimalString
} from '../money/decimal';
import { roundingStrategies } from '../money/rounding';

/**
 * The measurement half of the platform's quantisation story.
 *
 * `RoundingStrategy` rounds a **money** amount at `currency.decimalPlaces`; this codec quantises a
 * **quantity** at `unit.decimalPlaces`. The two are deliberately separate authorities over separate
 * kinds of number, and the split is what lets a tenant say "you cannot pick half a piece" and "three
 * decimals is plenty for kilograms" without a second money-rounding mechanism appearing beside the
 * first. A change that makes one call the other is a defect.
 *
 * **Conversion happens once, here, at the boundary where a document line becomes a movement.** A
 * document line states the unit it was entered in and freezes the factor it was entered with; a
 * ledger or a level row holds one number in the reference unit of its own family. Everything between
 * those two points is this codec, which is why it takes unit rows rather than unit ids: the caller is
 * the one that read them, inside its own transaction.
 *
 * Nothing here is a `number`. Quantities are exact decimals and a factor is an exact decimal, so the
 * arithmetic runs on the platform's decimal units — `bigint` pairs — and a float never appears on the
 * path.
 */

/** The two facts about a unit this codec needs. Both come from the `unit` row. */
export interface IUnitFactor {
	/** How many reference units one of this unit contains. */
	factor: DecimalString | number;
	/** How many decimals a quantity expressed in this unit may carry. */
	decimalPlaces: number;
}

/**
 * Quantises a quantity at a unit's granularity.
 *
 * @param value The exact quantity.
 * @param decimalPlaces The granularity of the unit it is expressed in, `0`–`6`.
 * @returns The quantity, resolved at that granularity by the platform's active rounding strategy.
 * @throws Error when the value is not an exact decimal, or the granularity is outside `0`–`6`.
 */
export function quantise(value: DecimalString | number | bigint, decimalPlaces: number): DecimalString {
	if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 6) {
		throw new Error(
			`QUANTITY_INVALID_GRANULARITY: ${decimalPlaces} is not a number of decimal places between 0 and 6.`
		);
	}

	const exact = normalizeDecimalString(assertDecimalString(value, 'quantity'));

	return normalizeDecimalString(
		roundingStrategies.active.round(exact, decimalPlaces, RoundingMode.HALF_UP)
	);
}

/**
 * Converts a quantity from one unit to another unit of the same family.
 *
 * The arithmetic is `value × from.factor ÷ to.factor`, then a quantisation at the target unit's
 * granularity. Because a family's reference is its smallest unit, every factor is a multiplier
 * greater than or equal to one, so converting to a coarser unit is an exact division by an integer and
 * the packaging cases that dominate real data — `2 boxes of 12 = 24 pieces` — stay exact.
 *
 * Convertibility is deliberately **not** checked here: this function is given two unit rows and
 * cannot see their `categoryId`. `UnitService.convert` is the entry point that reads the rows and
 * refuses two families with `UNIT_CATEGORY_MISMATCH`.
 *
 * @param value The exact quantity, expressed in `from`.
 * @param from The unit the value is expressed in.
 * @param to The unit the value is wanted in.
 * @returns The quantity in `to`, quantised at `to.decimalPlaces`.
 * @throws Error when the value is not an exact decimal.
 */
export function convert(value: DecimalString | number | bigint, from: IUnitFactor, to: IUnitFactor): DecimalString {
	const exact = parseDecimalString(assertDecimalString(value, 'quantity'));
	const scaled = multiplyDecimalUnits(exact, parseDecimalString(from.factor));
	const quotient = formatDecimalUnits(
		divideDecimalUnits(scaled, parseDecimalString(to.factor), WORKING_SCALE),
		WORKING_SCALE
	);

	return quantise(quotient, to.decimalPlaces);
}

/**
 * Converts a quantity into its family's reference unit.
 *
 * A ledger or a level row holds its number in the reference unit of its own family, so this is the
 * direction every movement write uses, and the direction a document line's frozen factor is applied
 * in.
 *
 * @param value The exact quantity, expressed in `from`.
 * @param from The unit the value is expressed in.
 * @param reference The family's reference unit.
 * @returns The quantity in the reference unit.
 */
export function toReference(
	value: DecimalString | number | bigint,
	from: IUnitFactor,
	reference: IUnitFactor
): DecimalString {
	return convert(value, from, reference);
}

/**
 * Converts a quantity out of its family's reference unit.
 *
 * @param value The exact quantity, expressed in the reference unit.
 * @param reference The family's reference unit.
 * @param to The unit the value is wanted in.
 * @returns The quantity in `to`.
 */
export function fromReference(
	value: DecimalString | number | bigint,
	reference: IUnitFactor,
	to: IUnitFactor
): DecimalString {
	return convert(value, reference, to);
}

/**
 * The codec, as a value a caller can hold.
 *
 * The functions above are the implementation; this object is what a service injects a reference to so
 * that a test can substitute a quantisation policy without reaching into the module graph.
 */
export const QuantityCodec = {
	quantise,
	convert,
	toReference,
	fromReference,
	/** The widest scale an intermediate conversion result may carry. */
	WORKING_SCALE
} as const;
