import { Injectable } from '@nestjs/common';
import { DeepPartial, FindOptionsWhere, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ID } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService, assertPlainReferencesNotForeign } from '@gauzy/core';
import { CART_PROMOTION_REFERENCES } from '../cart.references';
import { CommerceCartPromotion } from './commerce-cart-promotion.entity';
import { TypeOrmCommerceCartPromotionRepository } from './repository/type-orm-commerce-cart-promotion.repository';
import { MikroOrmCommerceCartPromotionRepository } from './repository/mikro-orm-commerce-cart-promotion.repository';

/**
 * The promotions applied to a cart, as snapshots.
 *
 * The discount an applied promotion produced is computed by the promotion engine and recorded on the
 * snapshot row. This service keeps the snapshot set consistent with the cart: the cart's recalculation
 * rebuilds it rather than appending to it, so a promotion that has stopped matching cannot leave a
 * stale discount behind.
 *
 * Every write of a snapshot — the `/cart-promotions` routes and the cart's apply verb on both protocols —
 * passes through `create` and `update` below, where its promotion and coupon are held to the caller's
 * tenant (`cart.references.ts`).
 */
@Injectable()
export class CommerceCartPromotionService extends TenantAwareCrudService<CommerceCartPromotion> {
	constructor(
		readonly typeOrmCommerceCartPromotionRepository: TypeOrmCommerceCartPromotionRepository,
		readonly mikroOrmCommerceCartPromotionRepository: MikroOrmCommerceCartPromotionRepository
	) {
		super(typeOrmCommerceCartPromotionRepository, mikroOrmCommerceCartPromotionRepository);
	}

	/**
	 * Refuses a snapshot, or a change to one, that names a promotion or coupon of another tenant.
	 *
	 * `create` and `update` run it; the cart's own verbs run it as well, before they spend the cart's version or
	 * replace anything, so a refused write leaves the cart exactly as it was.
	 *
	 * @param payload The snapshot, or the change set, about to be written.
	 * @throws ForbiddenException when a reference names a row of another tenant.
	 */
	public async assertReferences(payload: object): Promise<void> {
		await assertPlainReferencesNotForeign(
			this.typeOrmCommerceCartPromotionRepository.manager,
			payload,
			CART_PROMOTION_REFERENCES,
			RequestContext.currentTenantId()
		);
	}

	/**
	 * Records an applied promotion, refusing a promotion or coupon of another tenant.
	 *
	 * **The organization is the request's when the payload states none (R2-G19).** The GraphQL inputs declare
	 * no organization, and the tenant-aware base stamps the tenant only, so a row written over GraphQL had
	 * `organizationId = NULL` and every organization-scoped read missed it. A stated organization is kept (REST
	 * states it, validated against the caller).
	 *
	 * @param entity The snapshot to create.
	 * @returns The created snapshot.
	 */
	public async create(entity: DeepPartial<CommerceCartPromotion>): Promise<CommerceCartPromotion> {
		await this.assertReferences(entity);

		return super.create({
			...entity,
			organizationId: entity.organizationId ?? RequestContext.currentOrganizationId() ?? undefined
		} as DeepPartial<CommerceCartPromotion>);
	}

	/**
	 * Changes a snapshot, refusing a change that points it at a promotion or coupon of another tenant.
	 *
	 * @param id The snapshot, or the conditions that select the snapshots to change.
	 * @param partialEntity The fields to change.
	 * @returns The update result, as the base class answers it.
	 */
	public async update(
		id: ID | FindOptionsWhere<CommerceCartPromotion>,
		partialEntity: QueryDeepPartialEntity<CommerceCartPromotion>
	): Promise<CommerceCartPromotion | UpdateResult> {
		await this.assertReferences(partialEntity);

		return super.update(id, partialEntity);
	}
}
