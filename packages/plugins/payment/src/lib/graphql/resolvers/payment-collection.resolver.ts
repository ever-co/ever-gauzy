import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { PaymentCollectionService } from '../../payment-collection/payment-collection.service';
import { IPaymentCollection } from '../../payment.types';
import { PaymentPermission } from '../../payment.permissions';
import { payload, rejection, toConnection, toOrder } from '../types/connection';
import {
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
 */
@Resolver('PaymentCollection')
@UseGuards(TenantPermissionGuard, PermissionGuard)
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
	@Mutation('createPaymentCollection')
	async createPaymentCollection(
		@Args('input') input: ICreatePaymentCollectionGraphInput
	): Promise<ICreatePaymentCollectionPayload> {
		try {
			return payload(await this.paymentCollectionService.createCollection(input as never));
		} catch (error) {
			return rejection<IPaymentCollection>(error);
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
			return payload(await this.paymentCollectionService.updateCollection(input.id, input as never));
		} catch (error) {
			return rejection<IPaymentCollection>(error);
		}
	}
}
