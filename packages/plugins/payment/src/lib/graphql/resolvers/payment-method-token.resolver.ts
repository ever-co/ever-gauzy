import { BadRequestException, HttpStatus, Optional, UseGuards } from '@nestjs/common';
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ID, IPaymentMethodToken, PermissionsEnum } from '@gauzy/contracts';
import {
	FieldVisibility,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	VisibleWith
} from '@gauzy/core';
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
	IRevokePaymentMethodTokenPayload,
	ISetDefaultPaymentMethodTokenPayload,
	PAYMENT_METHOD_TOKEN_SORT_FIELDS,
	withoutRange
} from '../types/payment.types';

/**
 * Saved instruments, over GraphQL.
 *
 * The resolver is a transport adapter: the same permissions, the same service methods and the same
 * rows as the REST controller. Two things are its own, and both are the point of the resource.
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
 */
@Resolver('PaymentMethodToken')
@UseGuards(TenantPermissionGuard, PermissionGuard)
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
		@Optional() private readonly visibility: FieldVisibility = new FieldVisibility()
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
		@Args('offset') offset?: number
	): Promise<IPaymentMethodTokenConnection> {
		const page = await this.paymentMethodTokenLifecycle.list(withoutRange(filter as Record<string, unknown>) as never, {
			take: limit,
			skip: offset
		}, sort?.field ? toOrder(sort, PAYMENT_METHOD_TOKEN_SORT_FIELDS) : undefined);

		return toConnection(page, (row) => row.id);
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
	 * The stored reference, for a caller that may charge the instrument.
	 *
	 * The field is nullable in the schema, which is what makes a denial resolve this field to `null`
	 * and append the typed error — the contract's shape for a withheld field — rather than nulling the
	 * whole instrument. The read is a callback so nothing is read for a caller that may not see the
	 * result.
	 */
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
