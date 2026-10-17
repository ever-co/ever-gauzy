import { Injectable } from '@nestjs/common';
import { DeepPartial, FindOptionsWhere, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ID } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService, assertPlainReferencesNotForeign } from '@gauzy/core';
import { CART_LINE_REFERENCES } from '../cart.references';
import { CommerceCartLine } from './commerce-cart-line.entity';
import { TypeOrmCommerceCartLineRepository } from './repository/type-orm-commerce-cart-line.repository';
import { MikroOrmCommerceCartLineRepository } from './repository/mikro-orm-commerce-cart-line.repository';

/**
 * The lines of a cart.
 *
 * A line is never priced here — the price arrives already resolved — and a line is never totalled
 * here: the cart's totals are computed from the lines by `CartTotalsCalculator`. This service owns the
 * line's own lifecycle and nothing else.
 *
 * Every write of a line passes through `create` and `update` below — the `/cart-lines` routes, and the
 * cart's add, change and merge verbs on both protocols — which is where the line's plain id columns are
 * held to the caller's tenant (`cart.references.ts`).
 */
@Injectable()
export class CommerceCartLineService extends TenantAwareCrudService<CommerceCartLine> {
	constructor(
		readonly typeOrmCommerceCartLineRepository: TypeOrmCommerceCartLineRepository,
		readonly mikroOrmCommerceCartLineRepository: MikroOrmCommerceCartLineRepository
	) {
		super(typeOrmCommerceCartLineRepository, mikroOrmCommerceCartLineRepository);
	}

	/**
	 * Refuses a line, or a change to one, that names a product, variant, seller, tax class, location or plan of another tenant.
	 *
	 * `create` and `update` run it; the cart's own verbs run it as well, before they spend the cart's version or
	 * replace anything, so a refused write leaves the cart exactly as it was.
	 *
	 * @param payload The line, or the change set, about to be written.
	 * @throws ForbiddenException when a reference names a row of another tenant.
	 */
	public async assertReferences(payload: object): Promise<void> {
		await assertPlainReferencesNotForeign(
			this.typeOrmCommerceCartLineRepository.manager,
			payload,
			CART_LINE_REFERENCES,
			RequestContext.currentTenantId()
		);
	}

	/**
	 * Creates a line, refusing a product, variant, seller, tax class, location or plan of another tenant.
	 *
	 * **The organization is the request's when the payload states none (R2-G19).** The GraphQL inputs declare
	 * no organization, and the tenant-aware base stamps the tenant only, so a row written over GraphQL had
	 * `organizationId = NULL` and every organization-scoped read missed it. A stated organization is kept (REST
	 * states it, validated against the caller).
	 *
	 * @param entity The line to create.
	 * @returns The created line.
	 */
	public async create(entity: DeepPartial<CommerceCartLine>): Promise<CommerceCartLine> {
		await this.assertReferences(entity);

		return super.create({
			...entity,
			organizationId: entity.organizationId ?? RequestContext.currentOrganizationId() ?? undefined
		} as DeepPartial<CommerceCartLine>);
	}

	/**
	 * Changes a line, refusing a change that points it at a row of another tenant.
	 *
	 * @param id The line, or the conditions that select the lines to change.
	 * @param partialEntity The fields to change.
	 * @returns The update result, as the base class answers it.
	 */
	public async update(
		id: ID | FindOptionsWhere<CommerceCartLine>,
		partialEntity: QueryDeepPartialEntity<CommerceCartLine>
	): Promise<CommerceCartLine | UpdateResult> {
		await this.assertReferences(partialEntity);

		return super.update(id, partialEntity);
	}
}
