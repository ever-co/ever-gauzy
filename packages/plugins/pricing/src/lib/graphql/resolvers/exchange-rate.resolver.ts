import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FindOptionsWhere, In } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { PRICING_PERMISSION_VALUES, pricingPermission } from '../../pricing.permissions';
import { ExchangeRate } from '../../exchange-rate/exchange-rate.entity';
import { ExchangeRateService } from '../../exchange-rate/exchange-rate.service';
import {
	ExchangeRateConnection,
	ExchangeRateSortField,
	ICreateExchangeRateInput,
	IDeleteExchangeRatePayload,
	IExchangeRateFilter,
	IExchangeRateSort,
	IPageInput,
	IUpdateExchangeRateInput
} from '../graphql.types';
import { readConnection } from '../pagination';

/**
 * Exchange rates over GraphQL.
 *
 * Both the read and the write are behind the pair of permissions the REST surface uses, and the write
 * one is administrative: changing a rate changes the conversion applied to every foreign-currency
 * amount in the tenant, which is a different kind of act from editing one price.
 */
@Resolver('ExchangeRate')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.EXCHANGE_RATES_VIEW))
export class ExchangeRateResolver {
	constructor(private readonly exchangeRateService: ExchangeRateService) {}

	/**
	 * Lists the exchange rates of the caller's organization.
	 *
	 * @param filter How to narrow the list.
	 * @param sort How to order it.
	 * @param page The cursor window, when one is asked for.
	 * @param limit The page size, when one is asked for.
	 * @param offset The offset, when one is asked for.
	 * @returns The page and its boundary.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.EXCHANGE_RATES_VIEW))
	@Query('exchangeRates')
	async exchangeRates(
		@Args('filter') filter?: IExchangeRateFilter,
		@Args('sort') sort?: IExchangeRateSort,
		@Args('page') page?: IPageInput,
		@Args('limit') limit?: number,
		@Args('offset') offset?: number
	): Promise<ExchangeRateConnection> {
		return await readConnection(page, limit, offset, (window) =>
			this.exchangeRateService.paginate({
				where: this.whereOf(filter),
				order: this.orderOf(sort),
				take: window.take,
				skip: window.skip
			})
		);
	}

	/**
	 * Reads one exchange rate.
	 *
	 * @param id The rate to read.
	 * @returns The rate.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.EXCHANGE_RATES_VIEW))
	@Query('exchangeRate')
	async exchangeRate(@Args('id') id: ID): Promise<ExchangeRate> {
		return await this.exchangeRateService.findOneByIdString(id);
	}

	/**
	 * Creates an exchange rate.
	 *
	 * @param input The rate to create.
	 * @returns The created rate.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.EXCHANGE_RATES_EDIT))
	@Mutation('createExchangeRate')
	async createExchangeRate(@Args('input') input: ICreateExchangeRateInput): Promise<ExchangeRate> {
		return await this.exchangeRateService.createOne(input);
	}

	/**
	 * Updates an exchange rate.
	 *
	 * @param input The rate to update and the fields to change.
	 * @returns The rate, as it now stands.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.EXCHANGE_RATES_EDIT))
	@Mutation('updateExchangeRate')
	async updateExchangeRate(@Args('input') input: IUpdateExchangeRateInput): Promise<ExchangeRate> {
		const { id, ...changes } = input;

		await this.exchangeRateService.updateOne(id, changes);

		return await this.exchangeRateService.findOneByIdString(id);
	}

	/**
	 * Deletes an exchange rate.
	 *
	 * @param id The rate to delete.
	 * @param force Whether the removal is a hard delete.
	 * @returns What the deletion did.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.EXCHANGE_RATES_EDIT))
	@Mutation('deleteExchangeRate')
	async deleteExchangeRate(
		@Args('id') id: ID,
		@Args('force') force?: boolean
	): Promise<IDeleteExchangeRatePayload> {
		await this.exchangeRateService.findOneByIdString(id);

		if (force === true) {
			await this.exchangeRateService.delete(id);
		} else {
			await this.exchangeRateService.softDelete(id);
		}

		return { id, deleted: true, hard: force === true };
	}

	/**
	 * @param filter The GraphQL filter.
	 * @returns The equivalent row predicate.
	 */
	private whereOf(filter?: IExchangeRateFilter): FindOptionsWhere<ExchangeRate> {
		const where: FindOptionsWhere<ExchangeRate> = {};

		if (!filter) {
			return where;
		}

		if (filter.ids?.length) {
			where.id = In(filter.ids);
		}

		if (filter.fromCurrency) {
			where.fromCurrency = filter.fromCurrency.toUpperCase();
		}

		if (filter.toCurrency) {
			where.toCurrency = filter.toCurrency.toUpperCase();
		}

		if (filter.isManual !== undefined) {
			where.isManual = filter.isManual;
		}

		return where;
	}

	/**
	 * @param sort The GraphQL sort.
	 * @returns The equivalent ordering, newest validity first by default — the order an operator
	 * checks a rate in.
	 */
	private orderOf(sort?: IExchangeRateSort): Record<string, 'ASC' | 'DESC'> {
		const direction = sort?.direction;

		switch (sort?.field) {
			case ExchangeRateSortField.FROM_CURRENCY:
				return { fromCurrency: direction ?? 'ASC' };
			case ExchangeRateSortField.TO_CURRENCY:
				return { toCurrency: direction ?? 'ASC' };
			case ExchangeRateSortField.VALID_FROM:
				return { validFrom: direction ?? 'DESC' };
			case ExchangeRateSortField.RATE:
				return { rate: direction ?? 'ASC' };
			case ExchangeRateSortField.CREATED_AT:
				return { createdAt: direction ?? 'DESC' };
			default:
				return { validFrom: 'DESC' };
		}
	}
}
