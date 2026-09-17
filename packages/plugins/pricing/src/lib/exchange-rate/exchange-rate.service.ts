import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeepPartial, FindOptionsWhere, IsNull, LessThanOrEqual, MoreThanOrEqual, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import { Money, RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { ExchangeRate } from './exchange-rate.entity';
import { TypeOrmExchangeRateRepository } from './repository/type-orm-exchange-rate.repository';
import { MikroOrmExchangeRateRepository } from './repository/mikro-orm-exchange-rate.repository';

/**
 * Exchange rates: reading the rate in force at an instant and converting through it.
 *
 * Two rules decide everything here. A rate is a fact about a moment, so a lookup asks for the row
 * with the greatest `validFrom` at or before the instant whose `validUntil` has not passed — never
 * "the latest row", which would silently apply tomorrow's rate to today's order. And a missing rate
 * is refused rather than defaulted: an implicit one-to-one conversion is how a foreign-currency
 * order is charged the wrong amount with nobody noticing, so the caller receives an explicit
 * missing-rate error and decides what to do about it.
 *
 * Every amount crosses the platform money helper. Nothing in this file multiplies two numbers.
 */
@Injectable()
export class ExchangeRateService extends TenantAwareCrudService<ExchangeRate> {
	constructor(
		readonly typeOrmExchangeRateRepository: TypeOrmExchangeRateRepository,
		readonly mikroOrmExchangeRateRepository: MikroOrmExchangeRateRepository
	) {
		super(typeOrmExchangeRateRepository, mikroOrmExchangeRateRepository);
	}

	/**
	 * The tenant and organization every read and write of this service is scoped to.
	 */
	protected get scope(): { tenantId: ID; organizationId: ID } {
		return {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
	}

	/**
	 * The rate in force for a currency pair at an instant.
	 *
	 * @param fromCurrency Currency being converted from.
	 * @param toCurrency Currency being converted to.
	 * @param at Instant the rate must be in force at; defaults to now.
	 * @returns The rate row.
	 * @throws NotFoundException when no rate covers the pair at that instant.
	 */
	public async findRateAt(fromCurrency: CurrencyCode, toCurrency: CurrencyCode, at: Date = new Date()): Promise<ExchangeRate> {
		const from = this.normalizeCurrency(fromCurrency);
		const to = this.normalizeCurrency(toCurrency);

		if (from === to) {
			throw new BadRequestException(
				`PRICE_EXCHANGE_RATE_NOT_REQUIRED: ${from} and ${to} are the same currency and convert one to one.`
			);
		}

		const { tenantId, organizationId } = this.scope;

		if (!organizationId) {
			throw new BadRequestException('PRICE_ORGANIZATION_REQUIRED: an exchange rate is read inside an organization.');
		}

		// Two predicates make one window: a rate with no end is still in force, and a rate whose end has
		// not passed is in force. Expressing them as two `where` alternatives keeps the open-ended row and
		// the closed one in a single ordered query.
		const where: FindOptionsWhere<ExchangeRate>[] = [
			{
				tenantId,
				organizationId,
				fromCurrency: from,
				toCurrency: to,
				validFrom: LessThanOrEqual(at),
				validUntil: IsNull()
			},
			{
				tenantId,
				organizationId,
				fromCurrency: from,
				toCurrency: to,
				validFrom: LessThanOrEqual(at),
				validUntil: MoreThanOrEqual(at)
			}
		];

		const rows = await this.typeOrmExchangeRateRepository.find({
			where,
			order: { validFrom: 'DESC' },
			take: 1
		});

		if (!rows.length) {
			throw new NotFoundException(
				`PRICE_EXCHANGE_RATE_MISSING: no ${from}/${to} rate is in force at ${at.toISOString()}. ` +
					'Record the rate before pricing in that currency.'
			);
		}

		return rows[0];
	}

	/**
	 * Converts an amount through the rate in force.
	 *
	 * @param amount The amount to convert, exact.
	 * @param fromCurrency Currency the amount is expressed in.
	 * @param toCurrency Currency the result is expressed in.
	 * @param at Instant the conversion happens at; defaults to now.
	 * @returns The converted amount, rounded at the target currency's scale — the one boundary a
	 * conversion crosses.
	 * @throws NotFoundException when no rate covers the pair at that instant.
	 */
	public async convert(
		amount: DecimalString | number,
		fromCurrency: CurrencyCode,
		toCurrency: CurrencyCode,
		at: Date = new Date()
	): Promise<Money> {
		const from = this.normalizeCurrency(fromCurrency);
		const to = this.normalizeCurrency(toCurrency);
		const value = this.toMoney(amount, 'amount', from);

		if (from === to) {
			return value.round();
		}

		const rate = await this.findRateAt(from, to, at);
		const product = value.multiply(rate.rate);

		// The product carries the source currency because that is what `multiply` preserves; the result
		// is re-expressed in the target currency here, and only then rounded to that currency's scale.
		return this.toMoney(product.amount, 'converted amount', to).round();
	}

	/**
	 * Creates a rate after checking the pair and the sign.
	 *
	 * @param entity The rate to create.
	 * @returns The stored rate.
	 * @throws BadRequestException when the pair is not two different currencies, the rate is not
	 * positive, or a rate already covers the same pair from the same instant.
	 */
	public async createOne(entity: DeepPartial<ExchangeRate>): Promise<ExchangeRate> {
		const prepared = this.prepare(entity);
		await this.assertPairIsFree(prepared);

		return await super.create(prepared);
	}

	/**
	 * Updates a rate. Only the rate, its end and its manual flag are meaningful to change: the pair
	 * and the instant it became valid are the row's identity, because the lookup is "the greatest
	 * `validFrom` at or before the instant".
	 *
	 * @param id The rate to update.
	 * @param entity The fields to change.
	 * @returns The update result.
	 * @throws BadRequestException when the new rate is not positive.
	 */
	public async updateOne(id: ID, entity: QueryDeepPartialEntity<ExchangeRate>): Promise<UpdateResult | ExchangeRate> {
		// The row is read first for two reasons: it scopes the update to the caller's tenant and
		// organization, and it supplies the currency the incoming rate is expressed in.
		const existing = await this.findOneByIdString(id);

		if (entity.rate !== undefined && entity.rate !== null) {
			const rate = this.toMoney(entity.rate as DecimalString, 'rate', existing.fromCurrency);

			if (!rate.isPositive()) {
				throw new BadRequestException('PRICE_EXCHANGE_RATE_INVALID: a rate must be greater than zero.');
			}
		}

		if (entity.validFrom !== undefined || entity.validUntil !== undefined) {
			// A window that ends before it starts would make the row invisible to every lookup.
			const validFrom = (entity.validFrom as Date) ?? existing.validFrom;
			const validUntil = (entity.validUntil as Date) ?? existing.validUntil;

			this.assertWindow(validFrom, validUntil);
		}

		return await super.update(id, entity);
	}

	/**
	 * Normalises and checks a rate about to be written.
	 *
	 * @param entity The incoming rate.
	 * @returns The rate with its currency codes canonicalised.
	 */
	private prepare(entity: DeepPartial<ExchangeRate>): DeepPartial<ExchangeRate> {
		const fromCurrency = this.normalizeCurrency(entity.fromCurrency);
		const toCurrency = this.normalizeCurrency(entity.toCurrency);

		if (fromCurrency === toCurrency) {
			throw new BadRequestException(
				`PRICE_EXCHANGE_RATE_INVALID: ${fromCurrency} cannot be converted into itself.`
			);
		}

		const rate = this.toMoney(entity.rate, 'rate', fromCurrency);

		if (!rate.isPositive()) {
			throw new BadRequestException('PRICE_EXCHANGE_RATE_INVALID: a rate must be greater than zero.');
		}

		this.assertWindow(entity.validFrom, entity.validUntil);

		return { ...entity, fromCurrency, toCurrency };
	}

	/**
	 * @param validFrom Start of the window.
	 * @param validUntil End of the window, when one is given.
	 * @throws BadRequestException when the window is empty.
	 */
	private assertWindow(validFrom: Date, validUntil?: Date): void {
		if (validUntil && validFrom && new Date(validUntil).getTime() <= new Date(validFrom).getTime()) {
			throw new BadRequestException(
				'PRICE_EXCHANGE_RATE_INVALID: validUntil must be later than validFrom, otherwise the rate is never in force.'
			);
		}
	}

	/**
	 * @param entity The prepared rate.
	 * @throws BadRequestException when a rate already covers the pair from the same instant.
	 */
	private async assertPairIsFree(entity: DeepPartial<ExchangeRate>): Promise<void> {
		const { tenantId, organizationId } = this.scope;
		const existing = await this.typeOrmExchangeRateRepository.findOne({
			where: {
				tenantId,
				organizationId,
				fromCurrency: entity.fromCurrency,
				toCurrency: entity.toCurrency,
				validFrom: entity.validFrom
			} as FindOptionsWhere<ExchangeRate>
		});

		if (existing) {
			throw new BadRequestException(
				`PRICE_EXCHANGE_RATE_EXISTS: a ${entity.fromCurrency}/${entity.toCurrency} rate from that instant already exists.`
			);
		}
	}

	/**
	 * @param currency A currency code from a caller.
	 * @returns The code, trimmed and upper-cased.
	 * @throws BadRequestException when the code is not a three-letter code.
	 */
	private normalizeCurrency(currency: CurrencyCode): CurrencyCode {
		const code = typeof currency === 'string' ? currency.trim().toUpperCase() : '';

		if (code.length !== 3) {
			throw new BadRequestException(`PRICE_INVALID_CURRENCY: "${currency}" is not a three-letter currency code.`);
		}

		return code;
	}

	/**
	 * Reads an exact decimal from a caller.
	 *
	 * @param value The value as it arrived.
	 * @param field Field name, named in the error.
	 * @param currency Currency the decimal is carried in, which decides its scale.
	 * @returns The value.
	 * @throws BadRequestException when the value is not a decimal the money layer can hold, so a
	 * malformed amount is refused at the edge instead of surfacing as a driver error.
	 */
	private toMoney(value: DecimalString | number, field: string, currency: CurrencyCode): Money {
		try {
			return Money.of(value, currency);
		} catch {
			throw new BadRequestException(`PRICE_INVALID_DECIMAL: ${field} must be an exact decimal.`);
		}
	}
}
