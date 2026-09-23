import { BadRequestException, HttpStatus, Optional, UseGuards } from '@nestjs/common';
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ID, IPaymentMethodToken, PermissionsEnum } from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	FieldVisibility,
	Idempotent,
	PaymentMethodTokenService,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	VisibleWith,
	IConnectionPageSelection,
	resolveConnectionWindow
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { PaymentPermission } from '../../payment.permissions';
import { PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED } from '../../payment.card-data.pipe';
import { findCardDataField } from '../../payment.validators';
import { PaymentMethodTokenLifecycleService } from '../../payment-method-token/payment-method-token-lifecycle.service';
import { rejection, toConnection, toOrder } from '../types/connection';
import {
	ICreatePaymentMethodTokenGraphInput,
	ICreatePaymentMethodTokenPayload,
	IPaymentMethodTokenConnection,
	IPaymentMethodTokenFilter,
	IPaymentSort,
	IRecoverPaymentMethodTokenPayload,
	IRevokePaymentMethodTokenPayload,
	ISetDefaultPaymentMethodTokenPayload,
	ISoftDeletePaymentMethodTokenPayload,
	IUpdatePaymentMethodTokenGraphInput,
	IUpdatePaymentMethodTokenPayload,
	PAYMENT_METHOD_TOKEN_SORT_FIELDS,
	withoutRange
} from '../types/payment.types';

/**
 * Saved instruments, over GraphQL.
 *
 * The resolver is a transport adapter: the same permissions, the same service methods and the same
 * rows as the REST controller. Two things are its own, and both are the point of the resource.
 *
 * **It is not only a read and a status move.** `DELETE /:id/soft` and `PUT /:id/recover` are inherited
 * from `CrudController` by this resource's controller, which overrides both to state the permission the
 * base leaves unstated, so an instrument could be retired and restored recoverably over REST while no
 * field answered either half of that pair. Both halves are served here by the instrument's own kernel
 * service — the one the controller hands to the base class — which is why this resolver injects it
 * beside the lifecycle collaborator that sequences the other acts.
 *
 * **The stored reference is a gated field.** `PaymentMethodToken.token` is declared in the schema —
 * a schema that varied by caller would be two schemas — and resolves to `null` plus a typed denial
 * for a caller that does not hold `PAYMENT_METHOD_TOKENS_CHARGE`. The gate is the platform's own
 * `FieldVisibility`, the same decision the REST projection and the account-holder projection ask, so
 * the two surfaces cannot disagree; the `@VisibleWith` declaration above the resolver states the
 * requirement in the same terms the entities do. Holding the permission is necessary and not
 * sufficient — the owning credential still bounds a contact-scoped caller — and this resolver never
 * widens it: no list carries the value for any caller, and the field is reached through a single row
 * only.
 *
 * **A card-shaped body is a validation failure, not a business outcome.** The schema declares no card
 * member at all, so an undeclared member never reaches this resolver; what the check below catches is
 * card data nested inside a member that *is* declared and free-form (`metadata`), and it answers with
 * the same code and the same `details.field` REST answers with, as an error entry rather than as a
 * payload `userError`.
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
@Resolver('PaymentMethodToken')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class PaymentMethodTokenResolver {
	constructor(
		/**
		 * Named for the service rather than for the root field it serves: the query below is called
		 * `paymentMethodTokens`, which is the schema's name for the connection and not a second name for
		 * this collaborator.
		 */
		private readonly paymentMethodTokenLifecycle: PaymentMethodTokenLifecycleService,
		/**
		 * The platform's field-level visibility decision. Optional and defaulted rather than injected,
		 * exactly as the REST projection interceptor takes it: it is a pure decision over the caller's
		 * grants and owns no state.
		 */
		@Optional() private readonly visibility: FieldVisibility = new FieldVisibility(),
		/**
		 * The instrument's own kernel service, which is the one the controller hands to `CrudController`
		 * and therefore the one the two inherited lifecycle routes call. The lifecycle collaborator above
		 * sequences the acts of a saved instrument and does not reach the generic removal at all, so the
		 * pair of fields this resolver answers for it is served by the service the routes are served by
		 * rather than by a second path to the same table.
		 */
		private readonly paymentMethodTokenService: PaymentMethodTokenService
	) {}

	/**
	 * Lists the saved instruments of the caller's organization, defaults first unless sorted.
	 */
	@Permissions(PaymentPermission.PAYMENT_METHOD_TOKENS_VIEW as PermissionsEnum)
	@Query('paymentMethodTokens')
	async paymentMethodTokens(
		@Args('filter') filter?: IPaymentMethodTokenFilter,
		@Args('sort') sort?: IPaymentSort,
		@Args('limit') limit?: number,
		@Args('offset') offset?: number,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean,
	): Promise<IPaymentMethodTokenConnection> {
		const { skip, take } = resolveConnectionWindow({ ...(page ?? {}), limit, offset });
		const listing = await this.paymentMethodTokenLifecycle.list(withoutRange(filter as Record<string, unknown>) as never, {
			take,
			skip,
			...(withDeleted ? { withDeleted: true } : {})
		}, sort?.field ? toOrder(sort, PAYMENT_METHOD_TOKEN_SORT_FIELDS) : undefined);

		return toConnection(listing, skip);
	}

	/**
	 * Reads one saved instrument.
	 */
	@Permissions(PaymentPermission.PAYMENT_METHOD_TOKENS_VIEW as PermissionsEnum)
	@Query('paymentMethodToken')
	async paymentMethodToken(@Args('id') id: ID): Promise<IPaymentMethodToken> {
		return this.paymentMethodTokenLifecycle.read(id);
	}

	/**
	 * Saves an instrument from a reference the provider issued and confirmed.
	 */
	@Permissions(PaymentPermission.PAYMENT_METHOD_TOKENS_EDIT as PermissionsEnum)
	// Saving an instrument is a write at the provider as well as a row here, so this mutation requires
	// the retry key the REST route requires, under the same scope.
	@Idempotent({ scope: 'payment.instrument.create', required: true, resourceType: 'payment_method_token' })
	@Mutation('createPaymentMethodToken')
	async createPaymentMethodToken(
		@Args('input') input: ICreatePaymentMethodTokenGraphInput
	): Promise<ICreatePaymentMethodTokenPayload> {
		this.assertNoCardData(input);

		try {
			return { paymentMethodToken: await this.paymentMethodTokenLifecycle.register(input as never), userErrors: [] };
		} catch (error) {
			return { paymentMethodToken: null, ...rejection<IPaymentMethodToken>(error) };
		}
	}

	/**
	 * Corrects the display facts of an instrument: its brand, its last four, its expiry, the name on it
	 * and the address it bills to.
	 *
	 * The route it mirrors is `PUT /payment-method-tokens/:id`, which is the repair surface for the
	 * row's own descriptive fields and deliberately not the default change beside it. The stored
	 * reference, the account, the provider key and the kind are not among the members: a reference is
	 * what the provider issued, an instrument never moves between accounts or providers, and the kind
	 * decides both the default rule and whether a mandate is required before an off-session charge. The
	 * reference never appears in a request that is not a creation, which is why the update input does
	 * not carry it either.
	 *
	 * A card-shaped body is refused here as it is on the route: the schema declares no card member at
	 * all, and what the check below catches is card data nested inside a member that is declared and
	 * free-form (`metadata`). It answers the same code and the same `details.field` the route's card
	 * refusal answers with, and the kernel service refuses an instrument that was revoked rather than
	 * editing it — a removed instrument is re-added as a new row.
	 *
	 * No retry key is declared, and that mirrors the route rather than the specification: the route
	 * carries no `@Idempotent` scope, so a field that declared one would demand of a GraphQL caller what
	 * REST does not demand of a REST caller. `06-api-specification.md` §12.1 makes the key optional but
	 * honoured on every unsafe route, so the route and that section disagree here; the disagreement is
	 * recorded rather than resolved on one surface only.
	 *
	 * @param input The instrument to change and the display facts to change.
	 * @returns The payload, carrying the instrument as the write left it.
	 */
	@Permissions(PaymentPermission.PAYMENT_METHOD_TOKENS_EDIT as PermissionsEnum)
	@Mutation('updatePaymentMethodToken')
	async updatePaymentMethodToken(
		@Args('input') input: IUpdatePaymentMethodTokenGraphInput
	): Promise<IUpdatePaymentMethodTokenPayload> {
		this.assertNoCardData(input);

		// The identifier is separated from the facts before the call, because a path carries it on REST and
		// a GraphQL input has to state it: what the service receives is one shape from both surfaces rather
		// than the input's own `id` travelling into the payload it writes.
		const { id, ...facts } = input;

		try {
			return {
				paymentMethodToken: await this.paymentMethodTokenLifecycle.update(id, facts as never),
				userErrors: []
			};
		} catch (error) {
			return { paymentMethodToken: null, ...rejection<IPaymentMethodToken>(error) };
		}
	}

	/**
	 * Makes an instrument the default for its kind, reporting the one it displaced.
	 */
	@Permissions(PaymentPermission.PAYMENT_METHOD_TOKENS_EDIT as PermissionsEnum)
	@Mutation('setDefaultPaymentMethodToken')
	async setDefaultPaymentMethodToken(@Args('id') id: ID): Promise<ISetDefaultPaymentMethodTokenPayload> {
		try {
			const instrument = await this.paymentMethodTokenLifecycle.makeDefault(id);

			return {
				paymentMethodToken: instrument,
				previousDefaultId: instrument.previousDefaultId,
				userErrors: []
			};
		} catch (error) {
			return { paymentMethodToken: null, ...rejection<IPaymentMethodToken>(error) };
		}
	}

	/**
	 * Revokes an instrument — never a hard delete.
	 */
	@Permissions(PaymentPermission.PAYMENT_METHOD_TOKENS_EDIT as PermissionsEnum)
	@Mutation('revokePaymentMethodToken')
	async revokePaymentMethodToken(@Args('id') id: ID): Promise<IRevokePaymentMethodTokenPayload> {
		try {
			return { paymentMethodToken: await this.paymentMethodTokenLifecycle.revoke(id), deleted: true, userErrors: [] };
		} catch (error) {
			return { paymentMethodToken: null, deleted: false, ...rejection<IPaymentMethodToken>(error) };
		}
	}

	/**
	 * Retires a saved instrument recoverably.
	 *
	 * The route it mirrors is `DELETE /payment-method-tokens/:id/soft`, inherited from `CrudController`
	 * and overridden by the controller only to state the permission the base declares no metadata for.
	 * It is not the act `revokePaymentMethodToken` performs beside it: revoking moves the instrument's
	 * status to `REVOKED` and stamps `revokedAt`, because a charge history has to keep resolving against
	 * a row that may no longer be charged, whereas this takes the row out of the reads recoverably. The
	 * service is the instrument's own kernel service — the one the controller hands to `CrudController`
	 * — so the two surfaces retire the same row the same way.
	 *
	 * The permission is the route's own, `PAYMENT_METHOD_TOKENS_EDIT`, and not the class's view grant.
	 * This class states no `@Permissions` of its own, so a field that stated none would carry no
	 * metadata at all, and `PermissionGuard` answers `true` to empty metadata.
	 *
	 * @param id The instrument to retire.
	 * @returns The payload, carrying the instrument as the soft delete left it.
	 */
	@Permissions(PaymentPermission.PAYMENT_METHOD_TOKENS_EDIT as PermissionsEnum)
	@Mutation('softDeletePaymentMethodToken')
	async softDeletePaymentMethodToken(@Args('id') id: ID): Promise<ISoftDeletePaymentMethodTokenPayload> {
		try {
			return { paymentMethodToken: await this.paymentMethodTokenService.softRemove(id), userErrors: [] };
		} catch (error) {
			return { paymentMethodToken: null, ...rejection<IPaymentMethodToken>(error) };
		}
	}

	/**
	 * Restores a saved instrument that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /payment-method-tokens/:id/recover`, inherited from `CrudController`
	 * and overridden by the controller only to state the permission the base declares no metadata for.
	 * The restored row is readable and chargeable again under the gates it was written with — the stored
	 * reference is still withheld from a caller that may not charge it — so restoring never widens what
	 * the instrument exposes.
	 *
	 * @param id The instrument to restore.
	 * @returns The payload, carrying the restored instrument.
	 */
	@Permissions(PaymentPermission.PAYMENT_METHOD_TOKENS_EDIT as PermissionsEnum)
	@Mutation('recoverPaymentMethodToken')
	async recoverPaymentMethodToken(@Args('id') id: ID): Promise<IRecoverPaymentMethodTokenPayload> {
		try {
			return { paymentMethodToken: await this.paymentMethodTokenService.softRecover(id), userErrors: [] };
		} catch (error) {
			return { paymentMethodToken: null, ...rejection<IPaymentMethodToken>(error) };
		}
	}

	/**
	 * The stored reference, for a caller that may charge the instrument.
	 *
	 * The field is nullable in the schema, which is what makes a denial resolve this field to `null`
	 * and append the typed error — the contract's shape for a withheld field — rather than nulling the
	 * whole instrument. The read is a callback so nothing is read for a caller that may not see the
	 * result.
	 *
	 * **The operation's own permission is stated beside the escalation, because the class states none.**
	 * `PAYMENT_METHOD_TOKENS_CHARGE` is required *in addition to* the permission the operation is reached
	 * with and never instead of it (`17-graphql-api-specification.md` §6, the two consequences of the
	 * routes being mirrored one for one), and the reach is the read of a stored instrument. This class
	 * carries no `@Permissions` of its own — every root field above states its own — so without the line
	 * below the field would carry no permission metadata at all, and `PermissionGuard` answers `true`
	 * when the metadata is empty (`permission.guard.ts`, the `isEmpty(permissions)` return): the charge
	 * check inside the method body would then be the only gate on a field the guard chain no longer
	 * constrains. The declaration is the same value `paymentMethodTokens` and `paymentMethodToken(id)`
	 * carry, which is what makes the two halves of the field's requirement legible in one place.
	 */
	@Permissions(PaymentPermission.PAYMENT_METHOD_TOKENS_VIEW as PermissionsEnum)
	@VisibleWith(PermissionsEnum.PAYMENT_METHOD_TOKENS_CHARGE)
	@ResolveField('token')
	async token(@Parent() row: IPaymentMethodToken): Promise<string | null> {
		return this.visibility.guard(PermissionsEnum.PAYMENT_METHOD_TOKENS_CHARGE, () => row?.token, {
			resource: 'PaymentMethodToken',
			field: 'token'
		});
	}

	/**
	 * Refuses a mutation input that carries card data, naming the member it carried it in.
	 *
	 * @param input The mutation's input.
	 * @throws BadRequestException `400 PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED` with `details.field`.
	 */
	private assertNoCardData(input: unknown): void {
		const member = findCardDataField(input);

		if (!member) {
			return;
		}

		throw new BadRequestException({
			statusCode: HttpStatus.BAD_REQUEST,
			code: PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED,
			message:
				`${PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED}: card data is not accepted. The platform stores a ` +
				`provider-issued token only; the field '${member}' must be collected by the provider.`,
			details: { field: member }
		});
	}
}
