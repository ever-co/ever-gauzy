import { BadRequestException, Injectable } from '@nestjs/common';
import { DeepPartial, FindOptionsWhere, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ID } from '@gauzy/contracts';
import { RequestContext, assertPlainReferencesNotForeign } from '@gauzy/core';
import { CART_SHIPPING_METHOD_REFERENCES } from '../cart.references';
import { CommerceCartShippingMethod } from './commerce-cart-shipping-method.entity';
import { TypeOrmCommerceCartShippingMethodRepository } from './repository/type-orm-commerce-cart-shipping-method.repository';
import { MikroOrmCommerceCartShippingMethodRepository } from './repository/mikro-orm-commerce-cart-shipping-method.repository';
import { CartCrudService } from '../cart-crud.service';

/**
 * The delivery choices held against a cart.
 *
 * The price is computed by the shipping calculation strategy and recorded here; this service never
 * prices a delivery itself, and it never writes the cart's `shippingSubtotal` — the totals calculator
 * derives that from these rows.
 *
 * Every write of a choice — the `/cart-shipping-methods` routes and the cart's delivery verb on both
 * protocols, the merge included — passes through `create` and `update` below, where its shipping option
 * and tax class are held to the caller's tenant (`cart.references.ts`).
 */
@Injectable()
export class CommerceCartShippingMethodService extends CartCrudService<CommerceCartShippingMethod> {
	constructor(
		readonly typeOrmCommerceCartShippingMethodRepository: TypeOrmCommerceCartShippingMethodRepository,
		readonly mikroOrmCommerceCartShippingMethodRepository: MikroOrmCommerceCartShippingMethodRepository
	) {
		super(typeOrmCommerceCartShippingMethodRepository, mikroOrmCommerceCartShippingMethodRepository);
	}

	/**
	 * Refuses a choice, or a change to one, that names a shipping option or tax class of another tenant.
	 *
	 * `create` and `update` run it; the cart's own verbs run it as well, before they spend the cart's version or
	 * replace anything, so a refused write leaves the cart exactly as it was.
	 *
	 * @param payload The choice, or the change set, about to be written.
	 * @throws ForbiddenException when a reference names a row of another tenant.
	 */
	public async assertReferences(payload: object): Promise<void> {
		await assertPlainReferencesNotForeign(
			this.typeOrmCommerceCartShippingMethodRepository.manager,
			payload,
			CART_SHIPPING_METHOD_REFERENCES,
			RequestContext.currentTenantId()
		);
	}

	/**
	 * Records a delivery choice, refusing a shipping option or tax class of another tenant.
	 *
	 * **The organization is the request's when the payload states none (R2-G19).** The GraphQL inputs declare
	 * no organization, and the tenant-aware base stamps the tenant only, so a row written over GraphQL had
	 * `organizationId = NULL` and every organization-scoped read missed it. A stated organization is kept (REST
	 * states it, validated against the caller).
	 *
	 * **A choice is rated by the cart, not stored as stated (R3-07c).** The cart's `setShippingMethod` writes the
	 * configured option's name and rate; a row reaching this method without them was not rated — a direct write to
	 * the child resource — and is refused rather than stored half-empty.
	 *
	 * @param entity The choice to create.
	 * @returns The created choice.
	 */
	public async create(entity: DeepPartial<CommerceCartShippingMethod>): Promise<CommerceCartShippingMethod> {
		if (!entity?.name || entity.amount === undefined || entity.amount === null) {
			throw new BadRequestException({
				message:
					'CART_SHIPPING_OPTION_REQUIRED: a delivery choice is set on its cart (POST /carts/:id/shipping-methods), which rates the configured shipping option it names.',
				code: 'CART_SHIPPING_OPTION_REQUIRED'
			});
		}

		await this.assertReferences(entity);

		return super.create({
			...entity,
			organizationId: entity.organizationId ?? RequestContext.currentOrganizationId() ?? undefined
		} as DeepPartial<CommerceCartShippingMethod>);
	}

	/**
	 * Changes a delivery choice, refusing a change that points it at a row of another tenant.
	 *
	 * @param id The choice, or the conditions that select the choices to change.
	 * @param partialEntity The fields to change.
	 * @returns The update result, as the base class answers it.
	 */
	public async update(
		id: ID | FindOptionsWhere<CommerceCartShippingMethod>,
		partialEntity: QueryDeepPartialEntity<CommerceCartShippingMethod>
	): Promise<CommerceCartShippingMethod | UpdateResult> {
		await this.assertReferences(partialEntity);

		return super.update(id, partialEntity);
	}
}
