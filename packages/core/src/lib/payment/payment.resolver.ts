import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import {
	DecimalString,
	ID as Id,
	IInvoice,
	IPagination,
	IPayment,
	LanguagesEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { BaseQueryDTO } from '../core/crud';
import { RequestContext } from '../core/context';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { Payment } from './payment.entity';
import { PaymentService } from './payment.service';

/** The members `CreatePaymentInput` declares in the schema. */
export interface ICreatePaymentInput {
	amount: DecimalString;
	currency?: string;
	paymentDate?: Date;
	paymentMethod?: string;
	overdue?: boolean;
	note?: string;
	organizationId?: Id;
	employeeId?: Id;
	invoiceId?: Id;
	projectId?: Id;
	organizationContactId?: Id;
	tagIds?: Id[];
}

/**
 * The members `UpdatePaymentInput` declares in the schema.
 *
 * The employee is deliberately not among them: the delivered edit body drops that member while the
 * create keeps it, so an input here that carried it would offer a member no write of this route
 * honours.
 */
export interface IUpdatePaymentInput {
	id: Id;
	amount: DecimalString;
	currency?: string;
	paymentDate?: Date;
	paymentMethod?: string;
	overdue?: boolean;
	note?: string;
	organizationId?: Id;
	invoiceId?: Id;
	projectId?: Id;
	organizationContactId?: Id;
	tagIds?: Id[];
}

/** The members `PaymentReceiptContactInput` declares in the schema. */
export interface IPaymentReceiptContactInput {
	primaryEmail: string;
	name: string;
}

/** The members `PaymentReceiptOrganizationInput` declares in the schema. */
export interface IPaymentReceiptOrganizationInput {
	id: Id;
	name: string;
	tenantId?: Id;
}

/** The members `PaymentReceiptInvoiceInput` declares in the schema. */
export interface IPaymentReceiptInvoiceInput {
	invoiceNumber: DecimalString;
	toContact: IPaymentReceiptContactInput;
	fromOrganization: IPaymentReceiptOrganizationInput;
}

/** The members `PaymentReceiptPaymentInput` declares in the schema. */
export interface IPaymentReceiptPaymentInput {
	amount: DecimalString;
	currency: string;
}

/** The members `SendPaymentReceiptInput` declares in the schema. */
export interface ISendPaymentReceiptInput {
	invoice: IPaymentReceiptInvoiceInput;
	payment: IPaymentReceiptPaymentInput;
}

/**
 * The fields a payment list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `PaymentFilter` and `PaymentSortField` are its
 * two renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member is a column of the row, and every amount is `DECIMAL` rather than `NUMBER` because it
 * is money: an amount compared as a floating-point number is an amount that selects the wrong rows.
 * `deletedAt` is absent because the delivered list read answers live rows only, and the tenant and the
 * organization are absent because both are applied to the criterion from the credential rather than
 * from the caller.
 */
const PAYMENT_FILTERABLE = {
	id: 'ID',
	paymentDate: 'DATE',
	amount: 'DECIMAL',
	note: 'STRING',
	currency: 'STRING',
	paymentMethod: 'STRING',
	overdue: 'BOOLEAN',
	orderId: 'ID',
	paymentCollectionId: 'ID',
	paymentSessionId: 'ID',
	paymentProviderId: 'ID',
	status: 'STRING',
	externalId: 'STRING',
	reference: 'STRING',
	authorizedAmount: 'DECIMAL',
	capturedAmount: 'DECIMAL',
	refundedAmount: 'DECIMAL',
	canceledAmount: 'DECIMAL',
	settlementCurrency: 'STRING',
	settlementAmount: 'DECIMAL',
	fxRate: 'DECIMAL',
	fxRateId: 'ID',
	fxCapturedAt: 'DATE',
	authorizedAt: 'DATE',
	capturedAt: 'DATE',
	canceledAt: 'DATE',
	metadata: 'JSON',
	employeeId: 'ID',
	invoiceId: 'ID',
	projectId: 'ID',
	organizationContactId: 'ID',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const PAYMENT_SORTABLE = ['createdAt', 'updatedAt', 'paymentDate', 'amount', 'status'] as const;

/**
 * The order the connection means when the caller states none.
 *
 * The delivered list read states no order of its own — it hands the store a criterion and takes the
 * rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces. It is the ledger's own order: the date the money moved, newest first, which is the
 * column the delivered report read orders by. The creation instant and then the identifier follow it,
 * because a ledger has rows that share a date and the last key is what makes the order total and a
 * cursor walk over it stable. `paymentDate` is nullable and the connection's own rule places an absent
 * value first under a descending walk, so a row whose date was never recorded stands at the head of
 * the ledger rather than silently inside it.
 */
const PAYMENT_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'paymentDate', direction: 'DESC' },
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The money ledger over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `PaymentService` method the `/api/payments` route behind
 * it calls, with the same payload and the same request facts. This is the table the whole platform
 * writes what it was paid with into — an invoice, a payroll run, an expense and a commerce order all
 * record a row here — so a client that speaks this protocol reads the same ledger the REST callers
 * write, rather than a second answer to "how much has been paid".
 *
 * **The guard chain and the permission are the controller's.** The class carries what the controller
 * class carries — both guards, and the class-level edit permission — and every field then states the
 * permission its own route runs under, so a field is never narrower or wider than the route it
 * mirrors. Three cases read oddly and are nevertheless the parity: the node read, the count and the
 * two lifecycle moves are inherited from the CRUD base without a permission of their own, so they run
 * under the controller's class-level edit permission, and the fields state that same permission rather
 * than stating nothing. Only the list states the view permission, because only its route states one.
 *
 * **The gate is the catalogue's, and it is declared once for every field.** `FeatureFlagGuard` is
 * appended to the chain above — after the controller's two, so a caller with no credential is refused
 * as a credential problem before a tenant's switches are consulted — and the code it reads is
 * `FEATURE_GRAPHQL`, the commerce catalogue's own entry for "the GraphQL endpoint and its resolvers,
 * under the same guards and permissions as REST". The code is imported rather than restated here
 * because the value has to agree with the catalogue's `code` and nothing checks one string against
 * another: a literal that drifted names a code no catalogue row carries, which the guard resolves as
 * disabled, so every field below would answer `Cannot query field <name>` for every caller with
 * nothing red anywhere. One statement on the class is what puts every field behind it — the guard
 * reads the metadata with `getAllAndOverride` over the handler and then the class — and its effect is
 * the REST one in this protocol's vocabulary: a tenant that switched the capability off is answered
 * `Cannot query field <name>`, the same refusal a disabled capability's routes answer with a 404.
 * Nothing ad-hoc is done inside a field, because a gate stated in one place and enforced in another is
 * a gate that can be removed from one of them.
 *
 * **The amounts are the row's own.** Nothing here rescales, rounds or reformats an amount: the columns
 * are read through the platform's numeric transformer and the values travel as they were read — and
 * written as the exact decimals the schema states them as, so a payment recorded over this protocol
 * stores the digits it was given rather than a binary fraction that approximates them. The arithmetic
 * over them is the platform's money layer's, and no field here performs any.
 *
 * This resolver is declared by `PaymentModule`, beside the service it calls, so the GraphQL host can
 * scan that module for it — a resolver injects services, and a module is what reaches them.
 */
@Resolver('Payment')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ORG_PAYMENT_ADD_EDIT)
export class PaymentResolver {
	constructor(private readonly paymentService: PaymentService) {}

	/**
	 * The payments of the caller's tenant, newest movement first.
	 */
	@Query('payments')
	@Permissions(PermissionsEnum.ORG_PAYMENT_VIEW)
	async payments(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Payment>> {
		// The reader takes the query DTO the list route binds its query string to. This surface has no
		// query string to bind: the connection protocol states the same narrowing in `filter`, which is
		// applied to the rows the service returns, so the read runs with the route's own defaults — no
		// `where` and no `relations`.
		const options = {} as BaseQueryDTO<Payment>;
		const { items }: IPagination<Payment> = await this.paymentService.findAll(options);

		return buildConnection<Payment>({
			rows: items ?? [],
			filterable: PAYMENT_FILTERABLE,
			sortable: PAYMENT_SORTABLE,
			defaultSort: PAYMENT_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One payment of the caller's tenant.
	 *
	 * A row that is not there answers `null` rather than a refusal: GraphQL has one answer for "no such
	 * row" on a field that may have none, and the REST route's `404` is that same fact stated in the
	 * other protocol's vocabulary.
	 *
	 * The route's own `data` query string can name relations to load. This surface has no query string
	 * to bind, so the read states none and runs with the route's own default.
	 */
	@Query('payment')
	@Permissions(PermissionsEnum.ORG_PAYMENT_ADD_EDIT)
	async payment(@Args('id', { type: () => ID }) id: Id): Promise<Payment | null> {
		try {
			return await this.paymentService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many payments the caller's tenant holds.
	 *
	 * The same call the count route makes when it is given no options: that route binds its query
	 * string to the store's own `where` and hands it to `countBy`, and the connection protocol has no
	 * argument of that shape, so the field states no narrowing of its own. The tenant is applied to the
	 * criterion by the service, from the credential rather than from the caller.
	 */
	@Query('paymentCount')
	@Permissions(PermissionsEnum.ORG_PAYMENT_ADD_EDIT)
	async paymentCount(): Promise<number> {
		return await this.paymentService.countBy();
	}

	/**
	 * Records a money movement.
	 *
	 * The same service method the REST route calls, with the same payload: the members the caller
	 * states, the facets as the identifiers the pivot row is written from, and the amount as the exact
	 * decimal the column stores. The tenant is stamped by the service from the credential and the
	 * caller's own employee may be stamped beside it, which is why neither is a member the caller can
	 * choose freely.
	 */
	@Mutation('createPayment')
	@Permissions(PermissionsEnum.ORG_PAYMENT_ADD_EDIT)
	async createPayment(@Args('input') input: ICreatePaymentInput): Promise<Payment> {
		return await this.paymentService.create(this.writePayload(input) as unknown as Payment);
	}

	/**
	 * Changes a movement that exists.
	 *
	 * The delivered edit reaches the same write the create does, carrying the identifier in the path and
	 * the body together, so the field states one identifier and leaves neither reading undefined. Its
	 * answer is that write's answer — the row — and a member the caller omits is left as it is.
	 *
	 * The delivered route wraps every failure of this write into a bad request. That wrapper is the
	 * controller's own translation of the failure and not part of the write, so it is not restated
	 * here: this field lets the failure the service raised reach the caller, which the platform's error
	 * contract renders with the code and the status the condition actually has.
	 */
	@Mutation('updatePayment')
	@Permissions(PermissionsEnum.ORG_PAYMENT_ADD_EDIT)
	async updatePayment(@Args('input') input: IUpdatePaymentInput): Promise<Payment> {
		const { id, ...values } = input;

		return await this.paymentService.create({ ...this.writePayload(values), id } as unknown as Payment);
	}

	/**
	 * Removes a movement outright.
	 *
	 * The same service method the REST route calls. The delivered store answers its own delete result —
	 * a statement about the write, `{ affected }` — which is not a row and not what a field named
	 * `deletePayment` may return; the field answers the one fact the removal establishes, that it ran.
	 */
	@Mutation('deletePayment')
	@Permissions(PermissionsEnum.ORG_PAYMENT_ADD_EDIT)
	async deletePayment(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.paymentService.delete(id);

		return true;
	}

	/**
	 * Withdraws a movement without removing the row.
	 *
	 * No permission is stated on the field beyond the one the controller's class carries, because the
	 * delivered route states none of its own: the withdrawal is inherited from the CRUD base, where the
	 * controller's class-level edit permission is the whole of its scope. The delivered route passes the
	 * service the empty option list that leaves, so the field states none either.
	 */
	@Mutation('softDeletePayment')
	@Permissions(PermissionsEnum.ORG_PAYMENT_ADD_EDIT)
	async softDeletePayment(@Args('id', { type: () => ID }) id: Id): Promise<Payment> {
		return await this.paymentService.softRemove(id);
	}

	/**
	 * Puts a withdrawn movement back. Its permission is the withdrawal's, for the same reason: the
	 * delivered route carries none of its own to mirror.
	 */
	@Mutation('recoverPayment')
	@Permissions(PermissionsEnum.ORG_PAYMENT_ADD_EDIT)
	async recoverPayment(@Args('id', { type: () => ID }) id: Id): Promise<Payment> {
		return await this.paymentService.softRecover(id);
	}

	/**
	 * Sends a receipt for one movement.
	 *
	 * The same service method the REST route calls, with the same two objects: the delivered method
	 * reads the recipient, the document number and the issuing organization off the invoice and the
	 * amount and its currency off the payment, and the inputs this field takes carry exactly those
	 * members. The language and the origin are read off the request's own headers, as the route's
	 * decorators read them, so the message including the link it carries is built from the same request
	 * facts over either protocol.
	 *
	 * The answer is the method's own boolean rather than a constant: the delivered dispatch answers
	 * `true` once the message was handed to the mailer and `false` when it refused, reporting the
	 * refusal instead of raising it, so a field that answered `true` unconditionally would claim a
	 * delivery nobody established.
	 */
	@Mutation('sendPaymentReceipt')
	@Permissions(PermissionsEnum.ORG_PAYMENT_ADD_EDIT)
	async sendPaymentReceipt(@Args('input') input: ISendPaymentReceiptInput): Promise<boolean> {
		return await this.paymentService.sendReceipt(
			this.languageOfTheCaller(),
			input.invoice as unknown as IInvoice,
			input.payment as unknown as IPayment,
			this.originOfTheCaller()
		);
	}

	/**
	 * The payload the delivered write stores.
	 *
	 * The facets are handed over as the identifiers the pivot is written from, never as tag rows: the
	 * delivered write stores the membership, which is the pair of identifiers. The tenant is
	 * deliberately not among the members the caller states, because the service stamps the caller's own
	 * tenant onto the row and refuses a row that belongs to another one. No amount is touched here:
	 * the exact decimal the caller stated is the value the write receives.
	 */
	private writePayload(input: Omit<ICreatePaymentInput, 'id'> | IUpdatePaymentInput): Partial<Payment> {
		const { tagIds, ...values } = input;

		return {
			...values,
			...(tagIds ? { tags: tagIds.map((id) => ({ id })) } : {})
		} as unknown as Partial<Payment>;
	}

	/**
	 * The language the delivered dispatch writes in.
	 *
	 * The controller reads the `language` request header — the receipt route through `I18nLang`, which
	 * the i18n configuration binds to a `language` header resolver with an English fallback.
	 * `RequestContext.getLanguageCode()` reads the same header off the same request and applies the same
	 * fallback, so a caller asking the same question over either protocol is answered in the same
	 * language. Without a request it answers English, which is that same fallback.
	 */
	private languageOfTheCaller(): LanguagesEnum {
		return RequestContext.getLanguageCode();
	}

	/**
	 * The origin the message's link is built from.
	 *
	 * The delivered route reads it from the request's `origin` header and the delivered dispatch falls
	 * back to the configured client base URL when it is absent, so the field reads it off the same
	 * request rather than asking the caller to state it a second time: a caller cannot state one origin
	 * over one protocol and a different one over the other. A request without the header states none,
	 * which is the route's own case and the dispatch's own fallback.
	 */
	private originOfTheCaller(): string | undefined {
		const request = RequestContext.currentRequest() as { headers?: Record<string, unknown> } | null;
		const origin = request?.headers?.['origin'];

		return typeof origin === 'string' ? origin : undefined;
	}
}
