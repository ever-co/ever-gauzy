import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { PaymentProviderService } from '../../payment-provider/payment-provider.service';
import { IPaymentProvider } from '../../payment.types';
import { PaymentPermission } from '../../payment.permissions';
import { payload, rejection, toConnection, toOrder } from '../types/connection';
import {
	ICreatePaymentProviderGraphInput,
	ICreatePaymentProviderPayload,
	IDeletePaymentProviderPayload,
	IPaymentProviderConnection,
	IPaymentProviderFilter,
	IPaymentSort,
	IUpdatePaymentProviderGraphInput,
	IUpdatePaymentProviderPayload,
	PAYMENT_PROVIDER_SORT_FIELDS,
	withoutRange
} from '../types/payment.types';

/**
 * Provider registrations over GraphQL.
 *
 * The resolver is a transport adapter and nothing else: it resolves the same permissions, calls the
 * same service methods and returns the same rows as the REST controller, so a GraphQL caller and a
 * REST caller cannot drift apart. The one thing it owns is the shape of the answer — a connection for
 * a list, a payload for a mutation — and the conversion of a refusal the service threw into a
 * `userError` the caller can act on.
 */
@Resolver('PaymentProvider')
@UseGuards(TenantPermissionGuard, PermissionGuard)
export class PaymentProviderResolver {
	constructor(private readonly paymentProviderService: PaymentProviderService) {}

	/**
	 * Lists the provider registrations of the caller's organization.
	 */
	@Permissions(PaymentPermission.PAYMENT_PROVIDERS_VIEW as PermissionsEnum)
	@Query('paymentProviders')
	async paymentProviders(
		@Args('filter') filter?: IPaymentProviderFilter,
		@Args('sort') sort?: IPaymentSort,
		@Args('limit') limit?: number,
		@Args('offset') offset?: number
	): Promise<IPaymentProviderConnection> {
		const page = await this.paymentProviderService.findProviders({
			where: withoutRange(filter as Record<string, unknown>),
			order: toOrder(sort, PAYMENT_PROVIDER_SORT_FIELDS),
			...(limit ? { take: limit } : {}),
			...(offset ? { skip: offset } : {})
		});

		return toConnection(page, (row) => row.id);
	}

	/**
	 * Reads one registration with its non-secret configuration.
	 */
	@Permissions(PaymentPermission.PAYMENT_PROVIDERS_VIEW as PermissionsEnum)
	@Query('paymentProvider')
	async paymentProvider(@Args('id') id: ID): Promise<IPaymentProvider> {
		return this.paymentProviderService.findProviderOrFail(id);
	}

	/**
	 * Registers a provider against an existing integration.
	 */
	@Permissions(PaymentPermission.PAYMENT_PROVIDERS_CREATE as PermissionsEnum)
	@Mutation('createPaymentProvider')
	async createPaymentProvider(
		@Args('input') input: ICreatePaymentProviderGraphInput
	): Promise<ICreatePaymentProviderPayload> {
		try {
			return payload(await this.paymentProviderService.createProvider(input as never));
		} catch (error) {
			return rejection<IPaymentProvider>(error);
		}
	}

	/**
	 * Changes a registration. The code is immutable: it is the key the adapter is resolved from.
	 */
	@Permissions(PaymentPermission.PAYMENT_PROVIDERS_EDIT as PermissionsEnum)
	@Mutation('updatePaymentProvider')
	async updatePaymentProvider(
		@Args('input') input: IUpdatePaymentProviderGraphInput
	): Promise<IUpdatePaymentProviderPayload> {
		try {
			return payload(await this.paymentProviderService.updateProvider(input.id, input as never));
		} catch (error) {
			return rejection<IPaymentProvider>(error);
		}
	}

	/**
	 * Removes a registration that no session references.
	 */
	@Permissions(PaymentPermission.PAYMENT_PROVIDERS_DELETE as PermissionsEnum)
	@Mutation('deletePaymentProvider')
	async deletePaymentProvider(@Args('id') id: ID): Promise<IDeletePaymentProviderPayload> {
		try {
			const provider = await this.paymentProviderService.findProviderOrFail(id);
			await this.paymentProviderService.delete(id);

			return payload(provider);
		} catch (error) {
			return rejection<IPaymentProvider>(error);
		}
	}
}
