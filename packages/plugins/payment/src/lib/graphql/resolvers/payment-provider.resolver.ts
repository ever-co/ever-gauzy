import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { FeatureFlagGuard, Idempotent, PermissionGuard, Permissions, TenantPermissionGuard,
	IConnectionPageSelection,
	resolveConnectionWindow
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { PaymentProviderService } from '../../payment-provider/payment-provider.service';
import { IPaymentProvider } from '../../payment.types';
import { PaymentPermission } from '../../payment.permissions';
import { rejection, toConnection, toOrder } from '../types/connection';
import {
	ICreatePaymentProviderGraphInput,
	ICreatePaymentProviderPayload,
	IDeletePaymentProviderPayload,
	IPaymentProviderConnection,
	IPaymentProviderFilter,
	IPaymentSort,
	IRecoverPaymentProviderPayload,
	ISoftDeletePaymentProviderPayload,
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
@Resolver('PaymentProvider')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
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
		@Args('offset') offset?: number,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean,
	): Promise<IPaymentProviderConnection> {
		const { skip, take } = resolveConnectionWindow({ ...(page ?? {}), limit, offset });
		const listing = await this.paymentProviderService.findProviders({
			where: withoutRange(filter as Record<string, unknown>),
			order: toOrder(sort, PAYMENT_PROVIDER_SORT_FIELDS),
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		});

		return toConnection(listing, skip);
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
	// A registration is refused when the code is taken, which already makes a duplicate harmless, so the
	// key is optional here exactly as it is on the REST route, under the same scope.
	@Idempotent({ scope: 'payment.provider.create', required: false, resourceType: 'payment_provider' })
	@Mutation('createPaymentProvider')
	async createPaymentProvider(
		@Args('input') input: ICreatePaymentProviderGraphInput
	): Promise<ICreatePaymentProviderPayload> {
		try {
			return { paymentProvider: await this.paymentProviderService.createProvider(input as never), userErrors: [] };
		} catch (error) {
			return { paymentProvider: null, ...rejection<IPaymentProvider>(error) };
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
			return {
				paymentProvider: await this.paymentProviderService.updateProvider(input.id, input as never),
				userErrors: []
			};
		} catch (error) {
			return { paymentProvider: null, ...rejection<IPaymentProvider>(error) };
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

			return { paymentProvider: provider, deleted: true, userErrors: [] };
		} catch (error) {
			return { paymentProvider: null, deleted: false, ...rejection<IPaymentProvider>(error) };
		}
	}

	/**
	 * Retires a provider registration recoverably, keeping the sessions that ran against it.
	 *
	 * The route it mirrors is `DELETE /payment-providers/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base declares no metadata for. The
	 * registration is withdrawable rather than removable for the same reason the delete above is
	 * refused while a session references it: the attempts that settled through a provider have to keep
	 * resolving, so the row leaves every read that does not ask for retired rows and stays behind them.
	 *
	 * The permission is the route's own — `PAYMENT_PROVIDERS_DELETE` — and not the class's view grant.
	 * This class states no `@Permissions` of its own, so a field that stated none would carry no
	 * metadata at all, and `PermissionGuard` answers `true` to empty metadata.
	 *
	 * @param id The registration to retire.
	 * @returns The payload, carrying the registration as the soft delete left it.
	 */
	@Permissions(PaymentPermission.PAYMENT_PROVIDERS_DELETE as PermissionsEnum)
	@Mutation('softDeletePaymentProvider')
	async softDeletePaymentProvider(@Args('id') id: ID): Promise<ISoftDeletePaymentProviderPayload> {
		try {
			return { paymentProvider: await this.paymentProviderService.softRemove(id), userErrors: [] };
		} catch (error) {
			return { paymentProvider: null, ...rejection<IPaymentProvider>(error) };
		}
	}

	/**
	 * Restores a provider registration that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /payment-providers/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base declares no metadata for.
	 * Restoring is the delete grant exercised backwards, so the field states `PAYMENT_PROVIDERS_DELETE`
	 * too and the two halves of the pair are refusable by exactly the callers the routes refuse.
	 *
	 * @param id The registration to restore.
	 * @returns The payload, carrying the restored registration.
	 */
	@Permissions(PaymentPermission.PAYMENT_PROVIDERS_DELETE as PermissionsEnum)
	@Mutation('recoverPaymentProvider')
	async recoverPaymentProvider(@Args('id') id: ID): Promise<IRecoverPaymentProviderPayload> {
		try {
			return { paymentProvider: await this.paymentProviderService.softRecover(id), userErrors: [] };
		} catch (error) {
			return { paymentProvider: null, ...rejection<IPaymentProvider>(error) };
		}
	}
}
