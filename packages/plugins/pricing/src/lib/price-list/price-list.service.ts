import { BadRequestException, Injectable } from '@nestjs/common';
import { DeepPartial, DeleteResult, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { CurrencyCode, ID } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { IPriceContext, IResolvedPrice, PriceListStatus } from '../pricing.types';
import { ProductPriceService } from '../product-price/product-price.service';
import { PriceList } from './price-list.entity';
import { TypeOrmPriceListRepository } from './repository/type-orm-price-list.repository';
import { MikroOrmPriceListRepository } from './repository/mikro-orm-price-list.repository';

/**
 * Price lists: the lifecycle of a set of prices.
 *
 * A list is the unit an operator works with, and the three transitions this service owns are the
 * ones that change what the storefront charges:
 *
 * - **create / update** validate the window and the scope, because a list whose window ends before
 *   it starts is never eligible — silently, since nothing errors at read time.
 * - **activate** is the moment a built list goes live, which is why the operation has its own
 *   permission: drafting prices and publishing them are different jobs.
 * - **expire** withdraws a list without deleting it. `INACTIVE` keeps every price the list carried
 *   queryable, so a season that has ended can still be reported on and reinstated.
 *
 * `simulate` answers "what would this list do?" through exactly the resolution the storefront runs,
 * restricted to the list being asked about and with nothing written. A draft list is simulated as if
 * it were active, which is the whole point of previewing one.
 */
@Injectable()
export class PriceListService extends TenantAwareCrudService<PriceList> {
	constructor(
		readonly typeOrmPriceListRepository: TypeOrmPriceListRepository,
		readonly mikroOrmPriceListRepository: MikroOrmPriceListRepository,
		private readonly productPriceService: ProductPriceService
	) {
		super(typeOrmPriceListRepository, mikroOrmPriceListRepository);
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
	 * Creates a list after checking its window and its scope.
	 *
	 * @param entity The list to create.
	 * @returns The stored list.
	 * @throws BadRequestException when the list is unnamed, uncoded, scoped outside the caller's
	 * organization, or carries an empty window.
	 */
	public async createOne(entity: DeepPartial<PriceList>): Promise<PriceList> {
		return await super.create(this.prepare(entity));
	}

	/**
	 * Updates a list after the same checks.
	 *
	 * @param id The list to update.
	 * @param entity The fields to change.
	 * @returns The update result.
	 * @throws BadRequestException when the change would leave the list with an empty window.
	 */
	public async updateOne(id: ID, entity: QueryDeepPartialEntity<PriceList>): Promise<UpdateResult | PriceList> {
		const existing = await this.findOneByIdString(id);
		const prepared = this.prepare({
			...entity,
			id,
			// The window is validated as a whole, so a change to one bound is checked against the stored
			// value of the other rather than against nothing.
			startsAt: (entity.startsAt as Date) ?? existing.startsAt,
			endsAt: (entity.endsAt as Date) ?? existing.endsAt
		});

		return await super.update(id, prepared as unknown as QueryDeepPartialEntity<PriceList>);
	}

	/**
	 * Moves a list to `ACTIVE`, which is the moment its prices begin to resolve.
	 *
	 * @param id The list to activate.
	 * @returns The list, as it now stands.
	 * @throws BadRequestException when the list's own window has already closed, because activating it
	 * would publish prices that can never be charged.
	 */
	public async activate(id: ID): Promise<PriceList> {
		const list = await this.findOneByIdString(id);

		if (list.endsAt && new Date(list.endsAt).getTime() <= Date.now()) {
			throw new BadRequestException(
				`PRICE_LIST_WINDOW_CLOSED: the list "${list.code}" ended at ${new Date(list.endsAt).toISOString()} ` +
					'and would resolve to nothing if it were activated.'
			);
		}

		return await this.setStatus(list, PriceListStatus.ACTIVE);
	}

	/**
	 * Withdraws a list without deleting it.
	 *
	 * @param id The list to withdraw.
	 * @returns The list, as it now stands.
	 */
	public async expire(id: ID): Promise<PriceList> {
		const list = await this.findOneByIdString(id);

		return await this.setStatus(list, PriceListStatus.INACTIVE);
	}

	/**
	 * Dry-runs the resolution of one list against a context.
	 *
	 * @param id The list to simulate.
	 * @param context The context to price against.
	 * @returns One resolution per variant that the list prices.
	 */
	public async simulate(id: ID, context: IPriceContext): Promise<IResolvedPrice[]> {
		// Reading the list first is what scopes the dry run to the caller's tenant and organization: the
		// resolution that follows filters by the same scope, but the list itself is what the caller named.
		await this.findOneByIdString(id);

		return await this.productPriceService.resolvePrices(context, { priceListId: id });
	}

	/**
	 * Removes a list.
	 *
	 * A list with prices is never hard-deleted by accident: without `force` the row is soft-deleted and
	 * everything it carried stays queryable, and `force` is the caller stating that the list and its
	 * prices should go — which the foreign key then cascades.
	 *
	 * @param id The list to remove.
	 * @param options.force Whether the removal is a hard delete.
	 * @returns The delete result, or the soft-deleted list.
	 */
	public async deletePriceList(
		id: ID,
		options: { force?: boolean } = {}
	): Promise<DeleteResult | UpdateResult | PriceList> {
		await this.findOneByIdString(id);

		return options.force === true ? await this.delete(id) : await this.softDelete(id);
	}

	/**
	 * Normalises an incoming list and refuses an empty window.
	 *
	 * @param entity The list as it arrived.
	 * @returns The list with canonical currency and scoping.
	 */
	private prepare(entity: DeepPartial<PriceList>): DeepPartial<PriceList> {
		const { organizationId } = this.scope;

		if (!organizationId) {
			throw new BadRequestException('PRICE_ORGANIZATION_REQUIRED: a price list belongs to an organization.');
		}

		if (entity.organizationId && String(entity.organizationId) !== String(organizationId)) {
			throw new BadRequestException('PRICE_ORGANIZATION_MISMATCH: a price list belongs to the caller\'s organization.');
		}

		if (typeof entity.name !== 'string' || entity.name.trim() === '') {
			throw new BadRequestException('PRICE_LIST_NAME_REQUIRED: a price list needs a name.');
		}

		if (typeof entity.code !== 'string' || entity.code.trim() === '') {
			throw new BadRequestException('PRICE_LIST_CODE_REQUIRED: a price list needs a code.');
		}

		if (entity.currency && String(entity.currency).trim().length !== 3) {
			throw new BadRequestException(
				`PRICE_INVALID_CURRENCY: "${entity.currency}" is not a three-letter currency code.`
			);
		}

		if (entity.startsAt && entity.endsAt && new Date(entity.endsAt).getTime() <= new Date(entity.startsAt).getTime()) {
			throw new BadRequestException(
				'PRICE_LIST_WINDOW_INVALID: endsAt must be later than startsAt, otherwise the list is never eligible.'
			);
		}

		return {
			...entity,
			organizationId,
			name: entity.name.trim(),
			code: entity.code.trim(),
			currency: entity.currency ? (String(entity.currency).trim().toUpperCase() as CurrencyCode) : undefined
		};
	}

	/**
	 * @param list The list to move.
	 * @param status The status to move it to.
	 * @returns The list, as it now stands.
	 */
	private async setStatus(list: PriceList, status: PriceListStatus): Promise<PriceList> {
		if (list.status === status) {
			return list;
		}

		await super.update(list.id, { status } as QueryDeepPartialEntity<PriceList>);

		// Read back rather than mutating the loaded instance: the write went through the repository, and a
		// caller that received a hand-patched object would be reading a state the database never confirmed.
		return await this.findOneByIdString(list.id);
	}
}
