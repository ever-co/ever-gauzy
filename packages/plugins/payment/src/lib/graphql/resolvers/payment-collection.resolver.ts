import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { FeatureFlagGuard, Idempotent, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { PaymentCollectionService } from '../../payment-collection/payment-collection.service';
import { IPaymentCollection } from '../../payment.types';
import { PaymentPermission } from '../../payment.permissions';
import { rejection, toConnection, toOrder } from '../types/connection';import {
	ICreatePaymentCollectionGraphInput,
	ICreatePaymentCollectionPayload,
	IPaymentCollectionConnection,
	IPaymentCollectionFilter,
	IPaymentSort,
	IUpdatePaymentCollectionGraphInput,
	IUpdatePaymentCollectionPayload,
	PAYMENT_COLLECTION_SORT_FIELDS,
	withoutRange
} from '../types/payment.types';

/**
 * Payment collections over GraphQL.
 *
 * A collection is created with the amount that has to be collected and the order or cart it belongs
 * to; its status and its four amounts are derived by the service, which is why neither an input type
 * nor an update input carries them. The resolver would have nothing to do with them if they did.
 *
 * **The gate is the catalogue's.** `FeatureFlagGuard` is appended to the guard chain this resolver
 * already carried, and the code it reads is `FEATURE_GRAPHQL` — the commerce catalogue's entry for "the
 * GraphQL endpoint and its resolvers, under the same guards and permissions as REST". The code is
 * imported rather than restated because the value has to agree with the catalogue's `code` and nothing
 * checks one string against another: a literal that drifted names a code no catalogue row carries, which
 * the guard resolves as disabled, so every field here would answer `Cannot query field <name>` for every
 * caller with nothing red anywhere. One statement on the class puts every field behind it, and a tenant
 * that switched the capability off is answered the refusal a disabled capability's routes answer with a
 * 404.
 */
@Resolver('PaymentCollection')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class PaymentCollectionResolver {
	constructor(private readonly paymentCollectionService: PaymentCollectionService) {}

	/**
	 * Lists the collections of the caller's organization.
	 */
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_VIEW as PermissionsEnum)
	@Query('paymentCollections')
	async paymentCollections(
		@Args('filter') filter?: IPaymentCollectionFilter,
		@Args('sort') sort?: IPaymentSort,
		@Args('limit') limit?: number,
		@Args('offset') offset?: number
	): Promise<IPaymentCollectionConnection> {
		const page = await this.paymentCollectionService.findCollections({
			where: withoutRange(filter as Record<string, unknown>),
			order: toOrder(sort, PAYMENT_COLLECTION_SORT_FIELDS),
			...(limit ? { take: limit } : {}),
			...(offset ? { skip: offset } : {})
		});

		return toConnection(page, (row) => row.id);
	}

	/**
	 * Reads one collection with the four amounts and the derived status.
	 */
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_VIEW as PermissionsEnum)
	@Query('paymentCollection')
	async paymentCollection(@Args('id') id: ID): Promise<IPaymentCollection> {
		return this.paymentCollectionService.findCollectionOrFail(id);
	}

	/**
	 * Creates the collection of an order or a cart.
	 */
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_AUTHORIZE as PermissionsEnum)
	// An order or a cart has one collection and the service refuses a second one, so the key is optional
	// here exactly as it is on the REST route, under the same scope.
	@Idempotent({ scope: 'payment.collection.create', required: false, resourceType: 'payment_collection' })
	@Mutation('createPaymentCollection')
	async createPaymentCollection(
		@Args('input') input: ICreatePaymentCollectionGraphInput
	): Promise<ICreatePaymentCollectionPayload> {
		try {
			return {
				paymentCollection: await this.paymentCollectionService.createCollection(input as never),
				userErrors: []
			};
		} catch (error) {
			return { paymentCollection: null, ...rejection<IPaymentCollection>(error) };
		}
	}

	/**
	 * Changes the descriptive fields of a collection. Its amount and currency are refused once money
	 * has moved against it.
	 */
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_AUTHORIZE as PermissionsEnum)
	@Mutation('updatePaymentCollection')
	async updatePaymentCollection(
		@Args('input') input: IUpdatePaymentCollectionGraphInput
	): Promise<IUpdatePaymentCollectionPayload> {
		try {
			return {
				paymentCollection: await this.paymentCollectionService.updateCollection(input.id, input as never),
				userErrors: []
			};
		} catch (error) {
			return { paymentCollection: null, ...rejection<IPaymentCollection>(error) };
		}
	}
}
