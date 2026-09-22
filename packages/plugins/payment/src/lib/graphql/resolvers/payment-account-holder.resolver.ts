import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ID, IPaymentAccountHolder, IPaymentMethodToken, PermissionsEnum } from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	Idempotent,
	PaymentAccountHolderService,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	IConnectionPageSelection,
	resolveConnectionWindow
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { PaymentPermission } from '../../payment.permissions';
import { PaymentAccountHolderLifecycleService } from '../../payment-account-holder/payment-account-holder-lifecycle.service';
import { PaymentMethodTokenLifecycleService } from '../../payment-method-token/payment-method-token-lifecycle.service';
import { rejection, toConnection, toOrder } from '../types/connection';
import {
	ICreatePaymentAccountHolderGraphInput,
	ICreatePaymentAccountHolderPayload,
	IDeletePaymentAccountHolderPayload,
	IPaymentAccountHolderConnection,
	IPaymentAccountHolderFilter,
	IPaymentSort,
	IUpdatePaymentAccountHolderGraphInput,
	IUpdatePaymentAccountHolderPayload,
	IVerifyPaymentAccountHolderGraphInput,
	IVerifyPaymentAccountHolderPayload,
	PAYMENT_ACCOUNT_HOLDER_SORT_FIELDS,
	withoutRange
} from '../types/payment.types';

/**
 * A party's account at a provider, over GraphQL.
 *
 * The resolver is a transport adapter and nothing else: it resolves the same permissions, calls the
 * same service methods and returns the same rows as the REST controller, so a GraphQL caller and a
 * REST caller cannot drift apart. The one thing it owns is the shape of the answer — a connection for
 * a list, a payload for a mutation — and the conversion of a refusal the service threw into a
 * `userError` the caller can act on.
 *
 * One field of the type is resolved here rather than returned with the row. `methodTokens` is the
 * account's instruments, and it is fetched only when a caller selects it: an account list that always
 * loaded its instruments would be one query per row for a field nobody asked for. The rows are the
 * masked summary — brand, last four, expiry — because no list carries a stored instrument reference,
 * for any caller (17-graphql-api-specification.md §6.4).
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
@Resolver('PaymentAccountHolder')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class PaymentAccountHolderResolver {
	constructor(
		private readonly paymentAccountHolderService: PaymentAccountHolderService,
		private readonly accountHolders: PaymentAccountHolderLifecycleService,
		private readonly paymentMethodTokens: PaymentMethodTokenLifecycleService
	) {}

	/**
	 * Lists the accounts of the caller's organization.
	 */
	@Permissions(PaymentPermission.PAYMENT_ACCOUNT_HOLDERS_VIEW as PermissionsEnum)
	@Query('paymentAccountHolders')
	async paymentAccountHolders(
		@Args('filter') filter?: IPaymentAccountHolderFilter,
		@Args('sort') sort?: IPaymentSort,
		@Args('limit') limit?: number,
		@Args('offset') offset?: number,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean,
	): Promise<IPaymentAccountHolderConnection> {
		const { skip, take } = resolveConnectionWindow({ ...(page ?? {}), limit, offset });
		const listing = await this.paymentAccountHolderService.findAll({
			where: withoutRange(filter as Record<string, unknown>),
			// Newest first when the caller states no order, which is the order the REST list answers in:
			// a default that differs between the two surfaces is the same resource answering two ways.
			order: sort?.field ? toOrder(sort, PAYMENT_ACCOUNT_HOLDER_SORT_FIELDS) : { createdAt: 'DESC' },
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		} as never);

		return toConnection(listing, skip);
	}

	/**
	 * Reads one account.
	 */
	@Permissions(PaymentPermission.PAYMENT_ACCOUNT_HOLDERS_VIEW as PermissionsEnum)
	@Query('paymentAccountHolder')
	async paymentAccountHolder(@Args('id') id: ID): Promise<IPaymentAccountHolder> {
		return this.accountHolders.read(id);
	}

	/**
	 * Records a party's account at a provider, in the state onboarding starts from.
	 */
	@Permissions(PaymentPermission.PAYMENT_ACCOUNT_HOLDERS_EDIT as PermissionsEnum)
	// Recording an account starts an onboarding at the provider, so this mutation requires the retry key
	// the REST route requires, under the same scope.
	@Idempotent({ scope: 'payment.account.create', required: true, resourceType: 'payment_account_holder' })
	@Mutation('createPaymentAccountHolder')
	async createPaymentAccountHolder(
		@Args('input') input: ICreatePaymentAccountHolderGraphInput
	): Promise<ICreatePaymentAccountHolderPayload> {
		try {
			return { paymentAccountHolder: await this.paymentAccountHolderService.createHolder(input as never), userErrors: [] };
		} catch (error) {
			return { paymentAccountHolder: null, ...rejection<IPaymentAccountHolder>(error) };
		}
	}

	/**
	 * Changes the non-secret attributes of an account, and its mandate with them.
	 */
	@Permissions(PaymentPermission.PAYMENT_ACCOUNT_HOLDERS_EDIT as PermissionsEnum)
	@Mutation('updatePaymentAccountHolder')
	async updatePaymentAccountHolder(
		@Args('input') input: IUpdatePaymentAccountHolderGraphInput
	): Promise<IUpdatePaymentAccountHolderPayload> {
		try {
			return { paymentAccountHolder: await this.accountHolders.update(input.id, input as never), userErrors: [] };
		} catch (error) {
			return { paymentAccountHolder: null, ...rejection<IPaymentAccountHolder>(error) };
		}
	}

	/**
	 * Records a verification verdict and moves the account where the verdict says it belongs.
	 */
	@Permissions(PaymentPermission.PAYMENT_ACCOUNT_HOLDERS_EDIT as PermissionsEnum)
	// A verification is recorded once and carries evidence with it, so this mutation requires the retry
	// key the REST route requires, under the same scope.
	@Idempotent({ scope: 'payment.account.verify', required: true, resourceType: 'payment_account_holder' })
	@Mutation('verifyPaymentAccountHolder')
	async verifyPaymentAccountHolder(
		@Args('input') input: IVerifyPaymentAccountHolderGraphInput
	): Promise<IVerifyPaymentAccountHolderPayload> {
		try {
			return { paymentAccountHolder: await this.accountHolders.verify(input.id, input as never), userErrors: [] };
		} catch (error) {
			return { paymentAccountHolder: null, ...rejection<IPaymentAccountHolder>(error) };
		}
	}

	/**
	 * Disables the account and revokes its instruments in the same transaction.
	 */
	@Permissions(PaymentPermission.PAYMENT_ACCOUNT_HOLDERS_EDIT as PermissionsEnum)
	@Mutation('deletePaymentAccountHolder')
	async deletePaymentAccountHolder(@Args('id') id: ID): Promise<IDeletePaymentAccountHolderPayload> {
		try {
			const account = await this.accountHolders.disable(id);

			return {
				paymentAccountHolder: account,
				deleted: true,
				revokedTokenCount: account.revokedTokenCount,
				userErrors: []
			};
		} catch (error) {
			return { paymentAccountHolder: null, deleted: false, revokedTokenCount: 0, ...rejection<IPaymentAccountHolder>(error) };
		}
	}

	/**
	 * The instruments saved under one account, as the masked summary.
	 *
	 * Reached only through an account the caller has already been allowed to read, and it carries no
	 * stored reference whatever the caller's permissions are: a list — and this is one — never carries
	 * the value.
	 *
	 * **The field states the permission its own rows are read under, and it states it here rather than
	 * nowhere.** The class carries no `@Permissions` of its own — every root field above states its own —
	 * so before this line the field carried no permission metadata at all, and `PermissionGuard` answers
	 * `true` when the metadata is empty (`permission.guard.ts`, the `isEmpty(permissions)` return): the
	 * field was therefore reachable by any authenticated caller that could obtain a `PaymentAccountHolder`
	 * parent, and would have been reachable by any caller at all had a second root field ever returned
	 * that type. A saved instrument is its own resource with its own grant — `PAYMENT_METHOD_TOKENS_VIEW`
	 * reads "a party's saved instruments: the masked display facts and the status, never the token value"
	 * (`appendix-b-permissions-and-features.md` §2.13) — and the route that serves these rows directly is
	 * `GET /payment-method-tokens`, which carries exactly that permission. Stating the parent's own
	 * `PAYMENT_ACCOUNT_HOLDERS_VIEW` here instead would have copied the REST account-holder read, which
	 * returns the same instrument summaries under the account grant; that route is the looser of the two
	 * and is reported as such rather than mirrored into the resolver.
	 */
	@Permissions(PaymentPermission.PAYMENT_METHOD_TOKENS_VIEW as PermissionsEnum)
	@ResolveField('methodTokens')
	async methodTokens(@Parent() holder: IPaymentAccountHolder): Promise<IPaymentMethodToken[]> {
		const instruments = await this.paymentMethodTokens.list({ accountHolderId: holder.id });

		return instruments.items;
	}
}
