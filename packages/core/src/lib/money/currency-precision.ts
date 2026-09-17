import { CurrencyCode, DecimalString, RoundingMode } from '@gauzy/contracts';
import { WORKING_SCALE, formatDecimalUnits, isValidDecimalString, normalizeDecimalString, parseDecimalString } from './decimal';
import { roundingStrategies } from './rounding';

/**
 * How many decimal places a currency's amounts carry.
 *
 * The count decides where a monetary value is presented and how a minor unit is read, so it lives in
 * one place: a currency that is not known here falls back to two, which is the ISO 4217 default and
 * the safe assumption for a currency the platform has not been told about yet. An installation that
 * adds a currency registers its precision once, at boot, rather than each service carrying its own
 * idea of how many decimals a dinar has.
 */

/** Decimal places used for a currency the platform has no explicit precision for. */
export const DEFAULT_CURRENCY_DECIMALS = 2;

/**
 * Currencies whose minor unit is the currency itself.
 */
export const ZERO_DECIMAL_CURRENCIES: readonly CurrencyCode[] = [
	'BIF',
	'CLP',
	'DJF',
	'GNF',
	'ISK',
	'JPY',
	'KMF',
	'KRW',
	'PYG',
	'RWF',
	'UGX',
	'UYI',
	'VND',
	'VUV',
	'XAF',
	'XOF',
	'XPF'
];

/**
 * Currencies divided into thousandths.
 */
export const THREE_DECIMAL_CURRENCIES: readonly CurrencyCode[] = ['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND'];

/**
 * Maps a currency code to its decimal places.
 */
export class CurrencyPrecision {
	private readonly decimals = new Map<CurrencyCode, number>();

	/**
	 * @param initial Currencies whose precision the installation states explicitly, overriding the
	 * built-in table.
	 */
	constructor(initial: Record<CurrencyCode, number> = {}) {
		for (const currency of ZERO_DECIMAL_CURRENCIES) {
			this.decimals.set(currency, 0);
		}

		for (const currency of THREE_DECIMAL_CURRENCIES) {
			this.decimals.set(currency, 3);
		}

		for (const [currency, places] of Object.entries(initial)) {
			this.register(currency, places);
		}
	}

	/**
	 * @param currency The currency code.
	 * @returns Its decimal places, or `DEFAULT_CURRENCY_DECIMALS` when it is not known.
	 */
	decimalsFor(currency: CurrencyCode): number {
		if (typeof currency !== 'string' || currency.trim() === '') {
			return DEFAULT_CURRENCY_DECIMALS;
		}

		return this.decimals.get(currency.trim().toUpperCase()) ?? DEFAULT_CURRENCY_DECIMALS;
	}

	/**
	 * Registers or overrides a currency's precision.
	 *
	 * @param currency The currency code.
	 * @param decimals Its decimal places.
	 * @returns This helper, so registration can be chained.
	 */
	register(currency: CurrencyCode, decimals: number): this {
		if (typeof currency !== 'string' || currency.trim() === '') {
			throw new Error('MONEY_INVALID_CURRENCY: a currency precision needs a currency code.');
		}

		// The bound is the working scale rather than the ISO 4217 range: a currency the platform has been
		// told about may carry more places than an ISO currency does (a four-decimal fund unit, an
		// eight-decimal crypto unit), and the money layer can carry all of them exactly.
		if (!Number.isInteger(decimals) || decimals < 0 || decimals > WORKING_SCALE) {
			throw new Error(
				`MONEY_INVALID_CURRENCY_DECIMALS: ${currency} cannot carry ${decimals} decimal places.`
			);
		}

		this.decimals.set(currency.trim().toUpperCase(), decimals);
		return this;
	}

	/**
	 * Reads an amount as whole minor units, rounding it to the currency's scale first.
	 *
	 * @param amount The amount.
	 * @param currency The currency it is expressed in.
	 * @returns The amount in minor units.
	 */
	toMinorUnits(amount: DecimalString, currency: CurrencyCode): bigint {
		const scale = this.decimalsFor(currency);
		const rounded = roundingStrategies.active.round(amount, scale, RoundingMode.HALF_UP);

		return parseDecimalString(rounded).units;
	}

	/**
	 * @param minor The amount in minor units.
	 * @param currency The currency they are expressed in.
	 * @returns The amount as an exact decimal at the currency's scale.
	 */
	fromMinorUnits(minor: bigint, currency: CurrencyCode): DecimalString {
		return formatDecimalUnits(minor, this.decimalsFor(currency));
	}

	/**
	 * @param amount The amount to present.
	 * @param currency The currency it is expressed in.
	 * @returns The amount at the currency's scale, so a display always shows the currency's digits
	 * rather than however many the stored value happened to carry.
	 */
	toCurrencyScale(amount: DecimalString, currency: CurrencyCode): DecimalString {
		return roundingStrategies.active.round(amount, this.decimalsFor(currency), RoundingMode.HALF_UP);
	}

	/**
	 * @param amount The value to test.
	 * @param currency The currency it is expressed in.
	 * @returns True when the value is an exact decimal carrying no more digits than the currency does.
	 */
	isAtCurrencyScale(amount: unknown, currency: CurrencyCode): boolean {
		if (!isValidDecimalString(amount)) {
			return false;
		}

		return parseDecimalString(normalizeDecimalString(amount)).scale <= this.decimalsFor(currency);
	}
}

/**
 * The precision table money code uses when it is not running inside Nest.
 */
export const currencyPrecision = new CurrencyPrecision();
