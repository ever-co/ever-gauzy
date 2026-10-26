/**
 * Money is an exact decimal, never a binary floating point number.
 *
 * A double cannot represent `0.1`, `24.99` or `0.15` exactly, and the representation error becomes
 * observable money the moment a total is rounded and persisted: `1.005 * 100` evaluates to
 * `100.49999999999999`, which rounds to `100` where the exact decimal rounds to `101`. Every
 * monetary value therefore travels as the string form of the decimal the database holds, and the
 * only place a value crosses a rounding boundary is a `RoundingStrategy`.
 */

/**
 * The string form of an exact decimal: an optional sign, up to fourteen integer digits and up to
 * twelve fractional digits — the widest value the platform's money math carries between boundaries.
 */
export type DecimalString = string;

/**
 * An ISO 4217 alpha-3 currency code, upper case.
 */
export type CurrencyCode = string;

/**
 * How a value that is not exact at the target scale is resolved.
 *
 * `NONE` is not "no rounding": it is "fail when rounding would be required", which an installation
 * under an accounting regime that forbids implicit rounding selects explicitly.
 */
export enum RoundingMode {
	/** Away from zero as soon as the first dropped digit is five or more. The platform default. */
	HALF_UP = 'HALF_UP',
	/** To the nearest neighbour, and to the even one on a tie. */
	HALF_EVEN = 'HALF_EVEN',
	/** Away from zero whenever anything is dropped. */
	UP = 'UP',
	/** Toward zero whenever anything is dropped. */
	DOWN = 'DOWN',
	/** Reject a value that is not already exact at the target scale. */
	NONE = 'NONE'
}

/**
 * Where a currency symbol sits relative to the amount when a value is displayed.
 */
export enum MoneySymbolPosition {
	PREFIX = 'PREFIX',
	SUFFIX = 'SUFFIX'
}

/**
 * The in-memory shape of a monetary value.
 *
 * `decimals` is the currency's decimal-place count as it was when the value was constructed; it is
 * never re-read afterwards, so a later change to a currency's precision cannot retroactively alter
 * an amount that was already recorded.
 */
export interface IMoney {
	/** The exact decimal amount. */
	readonly amount: DecimalString;

	/** The currency the amount is expressed in. */
	readonly currency: CurrencyCode;

	/** The decimal places of `currency` at construction time. */
	readonly decimals: number;
}

/**
 * How a monetary value is rendered for a person.
 */
export interface IMoneyDisplayOptions {
	/** Locale used for grouping and any locale-aware formatting. */
	locale?: string;

	/** Whether the currency symbol is included in the output. */
	withSymbol?: boolean;

	/** The symbol itself, supplied by the currency row rather than guessed here. */
	symbol?: string;

	/** Whether the symbol is a prefix or a suffix. */
	symbolPosition?: MoneySymbolPosition;

	/** Whether a space separates the symbol from the amount. */
	spaceBetweenSymbolAndAmount?: boolean;

	/** Whether thousands are grouped. Defaults to true. */
	grouping?: boolean;
}
