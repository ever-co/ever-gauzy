import { Injectable } from '@nestjs/common';
import { CurrencyCode, DecimalString, IMoneyDisplayOptions, RoundingMode } from '@gauzy/contracts';
import { CurrencyPrecision, currencyPrecision } from './currency-precision';
import { Money } from './money';
import { RoundingStrategy, RoundingStrategyRegistry, roundingStrategies } from './rounding';

/**
 * The injectable face of the money layer.
 *
 * The value object itself is usable without Nest — a seed script, a migration or a unit test
 * constructs `Money` directly and gets the same arithmetic. The service exists for the two decisions
 * that are configuration rather than arithmetic: which rounding strategy is active, and how many
 * decimal places a currency carries. Both are installation-wide, so both are reached through this one
 * injectable rather than each money-bearing service reading a setting for itself.
 */
@Injectable()
export class MoneyService {
	/** @returns The currency precision table in use. */
	get precision(): CurrencyPrecision {
		return currencyPrecision;
	}

	/** @returns The rounding strategy registry in use. */
	get strategies(): RoundingStrategyRegistry {
		return roundingStrategies;
	}

	/** @returns The active rounding strategy. */
	get roundingStrategy(): RoundingStrategy {
		return roundingStrategies.active;
	}

	/**
	 * @param currency The currency code.
	 * @returns Its decimal places.
	 */
	decimalsFor(currency: CurrencyCode): number {
		return currencyPrecision.decimalsFor(currency);
	}

	/**
	 * @param amount The exact amount.
	 * @param currency The currency it is expressed in.
	 * @returns The value.
	 */
	of(amount: DecimalString | number | bigint, currency: CurrencyCode): Money {
		return Money.of(amount, currency);
	}

	/**
	 * @param currency The currency the zero is expressed in.
	 * @returns Zero in that currency.
	 */
	zero(currency: CurrencyCode): Money {
		return Money.zero(currency);
	}

	/**
	 * @param amount The stored amount, or null when the column is null.
	 * @param currency The currency it is expressed in.
	 * @returns The value.
	 */
	fromStorage(amount: DecimalString | number | null | undefined, currency: CurrencyCode): Money {
		return Money.fromStorage(amount, currency);
	}

	/**
	 * @param values The values to total.
	 * @param currency The currency they are expressed in.
	 * @returns The exact sum.
	 */
	sum(values: readonly Money[], currency: CurrencyCode): Money {
		return Money.sum(values, currency);
	}

	/**
	 * Splits an amount across weights so that the parts sum back to it.
	 *
	 * @param amount The whole being split.
	 * @param currency The currency it is expressed in.
	 * @param weights The shares.
	 * @returns One value per weight.
	 */
	allocate(amount: DecimalString, currency: CurrencyCode, weights: readonly DecimalString[]): Money[] {
		return Money.of(amount, currency).allocate(weights);
	}

	/**
	 * @param amount The value to round.
	 * @param currency The currency it is expressed in.
	 * @param mode How a value that is not exact at the currency's scale is resolved.
	 * @returns The value at the currency's scale.
	 */
	round(amount: DecimalString, currency: CurrencyCode, mode: RoundingMode = RoundingMode.HALF_UP): Money {
		return Money.of(amount, currency).round(mode);
	}

	/**
	 * @param left One value.
	 * @param right Another value.
	 * @returns -1, 0 or 1.
	 */
	compare(left: DecimalString, right: DecimalString, currency: CurrencyCode): -1 | 0 | 1 {
		return Money.of(left, currency).compare(Money.of(right, currency));
	}

	/**
	 * @param value The value to render.
	 * @param options How to render it.
	 * @returns The rendered value.
	 */
	format(value: Money, options: IMoneyDisplayOptions = {}): string {
		return value.toDisplayString(options);
	}

	/**
	 * Registers a rounding strategy an installation supplies.
	 *
	 * @param strategy The strategy to register. Registering an existing key replaces it.
	 */
	registerRoundingStrategy(strategy: RoundingStrategy): void {
		roundingStrategies.register(strategy);
	}

	/**
	 * Selects the active rounding strategy.
	 *
	 * @param key The key to activate.
	 * @throws Error when nothing is registered under the key.
	 */
	useRoundingStrategy(key: string): void {
		roundingStrategies.use(key);
	}

	/**
	 * Registers or overrides a currency's decimal places.
	 *
	 * @param currency The currency code.
	 * @param decimals Its decimal places.
	 */
	registerCurrencyPrecision(currency: CurrencyCode, decimals: number): void {
		currencyPrecision.register(currency, decimals);
	}
}
