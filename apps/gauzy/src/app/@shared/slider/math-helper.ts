/** Helper with mathematical functions */
export class MathHelper {
	/* Round numbers to a given number of significant digits */
	static roundToPrecisionLimit(
		value: number,
		precisionLimit: number
	): number {
		return +value.toPrecision(precisionLimit);
	}

	static clampToRange(value: number, floor: number, ceil: number): number {
		return Math.min(Math.max(value, floor), ceil);
	}
}
