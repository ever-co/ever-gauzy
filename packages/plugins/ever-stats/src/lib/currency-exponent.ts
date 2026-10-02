/**
 * Minor units per ISO 4217 currency: the number of decimals of the currency's minor unit. Currencies
 * that are not listed have 2 (cents).
 */
const EXPONENTS: Readonly<Record<string, number>> = Object.freeze({
	// No minor unit.
	BIF: 0,
	CLP: 0,
	DJF: 0,
	GNF: 0,
	ISK: 0,
	JPY: 0,
	KMF: 0,
	KRW: 0,
	PYG: 0,
	RWF: 0,
	UGX: 0,
	UYI: 0,
	VND: 0,
	VUV: 0,
	XAF: 0,
	XOF: 0,
	XPF: 0,
	// Three decimals.
	BHD: 3,
	IQD: 3,
	JOD: 3,
	KWD: 3,
	LYD: 3,
	OMR: 3,
	TND: 3,
	// Four decimals.
	CLF: 4,
	UYW: 4
});

/** A currency key the report accepts: three upper-case letters. */
export const CURRENCY_CODE = /^[A-Z]{3}$/;

/** The number of decimals of `currency`'s minor unit (2 when not listed). */
export function currencyExponent(currency: string): number {
	return EXPONENTS[currency] ?? 2;
}

/** The largest integer a report may carry for an amount (2^53 - 1). */
export const MAX_SAFE_AMOUNT = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * An amount (a decimal string as the database returns it, or a number) in integer minor units of
 * `currency`, rounded half away from zero. `null` when it is not a number.
 */
export function toMinorUnits(value: unknown, currency: string): bigint | null {
	const exponent = currencyExponent(currency);
	let text: string;
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) return null;
		text = value.toFixed(Math.min(20, exponent + 6));
	} else if (typeof value === 'bigint') {
		text = value.toString();
	} else if (typeof value === 'string') {
		text = value.trim();
		if (/e/i.test(text)) {
			const n = Number(text);
			if (!Number.isFinite(n)) return null;
			text = n.toFixed(Math.min(20, exponent + 6));
		}
	} else {
		return null;
	}
	const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(text);
	if (!match || (match[2] === '' && (match[3] ?? '') === '')) return null;
	const [, sign, whole, fraction = ''] = match;
	const padded = fraction + '0'.repeat(exponent + 1);
	let minor = BigInt((whole || '0') + padded.slice(0, exponent));
	if (padded[exponent] >= '5') minor += 1n;
	return sign === '-' ? -minor : minor;
}
