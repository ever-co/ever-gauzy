import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
	DecimalString,
	ID as Id,
	IInvoiceCreateInput,
	IInvoiceUpdateInput,
	IPagination,
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
import { FindOptionsQueryDTO } from '../core/crud';
import { RequestContext } from '../core/context';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { Invoice } from './invoice.entity';
import { InvoiceService } from './invoice.service';
import {
	InvoiceCreateCommand,
	InvoiceDeleteCommand,
	InvoiceGenerateLinkCommand,
	InvoiceGeneratePdfCommand,
	InvoicePaymentGeneratePdfCommand,
	InvoiceSendEmailCommand,
	InvoiceUpdateCommand
} from './commands';

/** The members `CreateInvoiceInput` declares in the schema. */
export interface ICreateInvoiceInput {
	invoiceNumber: DecimalString;
	invoiceDate: Date;
	dueDate: Date;
	status: string;
	currency: string;
	fromOrganizationId: Id;
	organizationId?: Id;
	sentTo?: string;
	invoiceType?: string;
	totalValue?: DecimalString;
	discountValue?: DecimalString;
	discountType?: string;
	tax?: DecimalString;
	taxType?: string;
	tax2?: DecimalString;
	tax2Type?: string;
	paid?: boolean;
	terms?: string;
	organizationContactId?: string;
	toContactId?: Id;
	isEstimate?: boolean;
	isAccepted?: boolean;
	internalNote?: string;
	alreadyPaid?: DecimalString;
	amountDue?: DecimalString;
	hasRemainingAmountInvoiced?: boolean;
	isArchived?: boolean;
	paymentTermId?: Id;
	tagIds?: Id[];
}

/** The members `UpdateInvoiceInput` declares in the schema. */
export interface IUpdateInvoiceInput {
	id: Id;
	invoiceNumber: DecimalString;
	invoiceDate: Date;
	dueDate: Date;
	status: string;
	currency: string;
	organizationId?: Id;
	sentTo?: string;
	totalValue?: DecimalString;
	discountValue?: DecimalString;
	discountType?: string;
	tax?: DecimalString;
	taxType?: string;
	tax2?: DecimalString;
	tax2Type?: string;
	paid?: boolean;
	terms?: string;
	organizationContactId?: string;
	toContactId?: Id;
	isEstimate?: boolean;
	isAccepted?: boolean;
	internalNote?: string;
	alreadyPaid?: DecimalString;
	amountDue?: DecimalString;
	hasRemainingAmountInvoiced?: boolean;
	isArchived?: boolean;
	paymentTermId?: Id;
	tagIds?: Id[];
}

/** The members `UpdateInvoiceActionInput` declares in the schema. */
export interface IUpdateInvoiceActionInput {
	status?: string;
	isEstimate?: boolean;
	internalNote?: string;
	isArchived?: boolean;
	paid?: boolean;
	alreadyPaid?: DecimalString;
	amountDue?: DecimalString;
	sentTo?: string;
}

/** The members `SendInvoiceEmailInput` declares in the schema. */
export interface ISendInvoiceEmailInput {
	email: string;
	invoiceId: Id;
	invoiceNumber: DecimalString;
	isEstimate: boolean;
	organizationId: Id;
}

/** The members `InvoiceNumberSeries` declares in the schema. */
export interface IInvoiceNumberSeries {
	max: DecimalString;
}

/** The members `InvoiceDocument` declares in the schema. */
export interface IInvoiceDocument {
	contentType: string;
	byteLength: number;
	content: string;
}

/**
 * The fields an invoice list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `InvoiceFilter` and `InvoiceSortField` are its
 * two renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member is a column of the document's own row. The amounts are `DECIMAL` rather than `NUMBER`
 * because they are money, and money compared as a floating-point number is money that selects the
 * wrong rows; `invoiceNumber` is `DECIMAL` for the same reason the object type carries it that way —
 * it is the numbering series, and its column is `numeric`.
 */
const INVOICE_FILTERABLE = {
	id: 'ID',
	invoiceNumber: 'DECIMAL',
	invoiceDate: 'DATE',
	dueDate: 'DATE',
	currency: 'STRING',
	discountValue: 'DECIMAL',
	discountType: 'STRING',
	paid: 'BOOLEAN',
	tax: 'DECIMAL',
	taxType: 'STRING',
	tax2: 'DECIMAL',
	tax2Type: 'STRING',
	terms: 'STRING',
	totalValue: 'DECIMAL',
	status: 'STRING',
	isEstimate: 'BOOLEAN',
	isAccepted: 'BOOLEAN',
	invoiceType: 'STRING',
	sentTo: 'STRING',
	organizationContactId: 'STRING',
	internalNote: 'STRING',
	alreadyPaid: 'DECIMAL',
	amountDue: 'DECIMAL',
	hasRemainingAmountInvoiced: 'BOOLEAN',
	token: 'STRING',
	paymentTermId: 'ID',
	vendorId: 'ID',
	fromOrganizationId: 'ID',
	toContactId: 'ID',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const INVOICE_SORTABLE = [
	'createdAt',
	'updatedAt',
	'invoiceNumber',
	'invoiceDate',
	'dueDate',
	'totalValue',
	'amountDue',
	'status'
] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered list read states no order of its own — it hands the store a filter and takes the rows
 * as they come back — so this is a decision the connection has to make rather than one it reproduces.
 * It is the platform's own: newest first, with the identifier as the last key so that two documents
 * raised in the same millisecond still have one order between them, which is what makes a cursor walk
 * over them total. A caller that wants the document's own order states it: `invoiceDate`, or the
 * numbering series itself, are both sort keys above.
 */
const INVOICE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The finance document over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `InvoiceService` method or dispatches the same command
 * the `/api/invoices` routes reach, with the same payload and the same language.
 *
 * **The guard chain and the permission are the controller's.** The class carries what the controller
 * class carries — both guards, and the class-level edit permission — and every field then states the
 * permission its own route runs under, so a field is never narrower or wider than the route it
 * mirrors. The inherited lifecycle routes are the case that reads oddly and is nevertheless the
 * parity: the withdrawal and the restoration state no permission of their own, so they run under the
 * controller's class-level edit permission, and the two fields state that same permission rather than
 * stating nothing.
 *
 * **The amounts are the row's own.** Nothing here rescales, rounds or reformats an amount: the
 * columns are read through the platform's numeric transformer and the values travel as they were
 * read, which is why the object type states them as the exact-decimal family rather than as a
 * binary fraction. The arithmetic over them is the platform's money layer's, and no field here
 * performs any.
 */
@Resolver('Invoice')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INVOICES_EDIT)
export class InvoiceResolver {
	constructor(private readonly invoiceService: InvoiceService, private readonly commandBus: CommandBus) {}

	/**
	 * The invoices and estimates of the caller's tenant, newest first.
	 */
	@Query('invoices')
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	async invoices(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Invoice>> {
		// The reader takes the query DTO the list route binds its query string to. This surface has no
		// query string to bind: the connection protocol states the same narrowing in `filter`, which is
		// applied to the rows the service returns, so the read runs with the route's own defaults — no
		// `where` and no `relations`.
		const options = {} as FindOptionsQueryDTO<Invoice>;
		const { items }: IPagination<Invoice> = await this.invoiceService.findAll(options);

		return buildConnection<Invoice>({
			rows: items ?? [],
			filterable: INVOICE_FILTERABLE,
			sortable: INVOICE_SORTABLE,
			defaultSort: INVOICE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One invoice or estimate of the caller's tenant.
	 *
	 * A document that is not there answers `null` rather than a refusal: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the REST route's `404` is that same fact
	 * stated in the other protocol's vocabulary.
	 *
	 * The node route reads the row with the relations its `data` query string names. This surface has
	 * no query string to bind, so the read states none and runs with the route's own defaults.
	 */
	@Query('invoice')
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	async invoice(@Args('id', { type: () => ID }) id: Id): Promise<Invoice | null> {
		try {
			return await this.invoiceService.findOneByIdString(id, { relations: [] });
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many invoices and estimates the caller's tenant holds.
	 *
	 * The same call the count route makes when it is given no options: that route binds its query
	 * string to the store's own `where` and hands it to `countBy`, and the connection protocol has no
	 * argument of that shape, so the field states no narrowing of its own. The tenant is applied to
	 * the criterion by the service, from the credential rather than from the caller.
	 */
	@Query('invoiceCount')
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	async invoiceCount(): Promise<number> {
		return await this.invoiceService.countBy();
	}

	/**
	 * The highest number the tenant's series has reached.
	 *
	 * The delivered look-up is the only look-up of its own this resource serves, and its answer is the
	 * aggregate row rather than a document — its own return type says `Invoice`, its statement selects
	 * the maximum under the alias `max`. The cast below is that difference, stated here rather than
	 * reproduced: the field answers what the method answers.
	 */
	@Query('highestInvoiceNumber')
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	async highestInvoiceNumber(): Promise<IInvoiceNumberSeries> {
		return (await this.invoiceService.getHighestInvoiceNumber()) as unknown as IInvoiceNumberSeries;
	}

	/**
	 * The document as a PDF, in the caller's own language.
	 *
	 * The delivered route renders from the same command with the locale its `I18nLang` decorator reads,
	 * which resolves the `language` header and falls back to English; `RequestContext.getLanguageCode`
	 * reads that same header off the same request and applies the same fallback, so one document is
	 * rendered in one language over either protocol.
	 */
	@Query('downloadInvoicePdf')
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	async downloadInvoicePdf(@Args('id', { type: () => ID }) id: Id): Promise<IInvoiceDocument | null> {
		const buffer: Buffer = await this.commandBus.execute(
			new InvoiceGeneratePdfCommand(id, this.languageOfTheCaller())
		);

		return this.documentOf(buffer);
	}

	/**
	 * The document's payment record as a PDF, on the same terms as the render above.
	 */
	@Query('downloadInvoicePaymentPdf')
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	async downloadInvoicePaymentPdf(@Args('id', { type: () => ID }) id: Id): Promise<IInvoiceDocument | null> {
		const buffer: Buffer = await this.commandBus.execute(
			new InvoicePaymentGeneratePdfCommand(id, this.languageOfTheCaller())
		);

		return this.documentOf(buffer);
	}

	/**
	 * Raises an invoice or an estimate.
	 *
	 * The write is dispatched as the same command the REST route dispatches, with the members its
	 * handler reads. The facets are handed over as the identifiers the pivot is written from, never as
	 * tag rows: the delivered write stores the membership, which is the pair of identifiers.
	 */
	@Mutation('createInvoice')
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	async createInvoice(@Args('input') input: ICreateInvoiceInput): Promise<Invoice> {
		return await this.commandBus.execute(new InvoiceCreateCommand(this.createPayload(input)));
	}

	/**
	 * Changes a document that exists.
	 *
	 * The delivered edit dispatches the same command as the create, carrying the identifier in the path
	 * and the body together, which is why the field states one identifier and leaves neither reading
	 * undefined. Its handler passes the body straight to the write, so the members this field states
	 * are the members that are written and a member the caller omits is left as it is.
	 */
	@Mutation('updateInvoice')
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	async updateInvoice(@Args('input') input: IUpdateInvoiceInput): Promise<Invoice> {
		const { tagIds, ...values } = input;

		return await this.commandBus.execute(
			new InvoiceUpdateCommand({
				...values,
				...(tagIds ? { tags: tagIds.map((id) => ({ id })) } : {})
			} as unknown as IInvoiceUpdateInput)
		);
	}

	/**
	 * Records the buyer's answer to an estimate.
	 *
	 * The same command the route dispatches, with the route's own body: the identifier and the answer,
	 * and nothing else.
	 */
	@Mutation('updateInvoiceEstimate')
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	async updateInvoiceEstimate(
		@Args('id', { type: () => ID }) id: Id,
		@Args('isAccepted', { type: () => Boolean }) isAccepted: boolean
	): Promise<Invoice> {
		return await this.commandBus.execute(new InvoiceUpdateCommand({ id, isAccepted }));
	}

	/**
	 * Moves a document along.
	 *
	 * The same command again, with the members the caller stated and no others — a step writes what it
	 * names and leaves every other column of the document as it is. The identifier is the path's, as it
	 * is on the route, and the body carries only the steps.
	 */
	@Mutation('updateInvoiceAction')
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	async updateInvoiceAction(
		@Args('id', { type: () => ID }) id: Id,
		@Args('input') input: IUpdateInvoiceActionInput
	): Promise<Invoice> {
		// The two amount members are stated as the exact decimals the schema carries them as, while the
		// contracts type the same columns as numbers; the cast states that difference rather than
		// converting an amount on its way through — which is the one thing this surface never does.
		return await this.commandBus.execute(
			new InvoiceUpdateCommand({ ...input, id } as unknown as IInvoiceUpdateInput)
		);
	}

	/**
	 * Sends the document to a recipient.
	 *
	 * The same command the route dispatches, with the language and the origin read from the request's
	 * own headers exactly as the route's decorators read them — so the message, including the link it
	 * carries, is built from the same request facts over either protocol.
	 *
	 * The answer is `true` once the dispatch has run, which is the whole of what the route
	 * establishes: it answers an accepted status and no body, and the delivered dispatcher logs a
	 * failure rather than raising it. A field that answered nothing would be a non-null member
	 * resolved to null, which is why the SDL declares this shape and states plainly what it does and
	 * does not claim.
	 */
	@Mutation('sendInvoiceEmail')
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	async sendInvoiceEmail(@Args('input') input: ISendInvoiceEmailInput): Promise<boolean> {
		const { email, invoiceNumber, invoiceId, isEstimate, organizationId } = input;

		await this.commandBus.execute(
			new InvoiceSendEmailCommand(
				this.languageOfTheCaller(),
				email,
				{ invoiceNumber, invoiceId, isEstimate, organizationId },
				this.originOfTheCaller()
			)
		);

		return true;
	}

	/**
	 * Generates the document's public link.
	 *
	 * The same command the route dispatches, and the answer is the row that write produced: the link
	 * is the pair of the document's identifier and the `token` written onto it, and a caller that
	 * needs the document's other members reads it back through the node field above.
	 */
	@Mutation('generateInvoiceLink')
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	async generateInvoiceLink(@Args('id', { type: () => ID }) id: Id): Promise<Invoice> {
		return await this.commandBus.execute(new InvoiceGenerateLinkCommand(id));
	}

	/**
	 * Removes a document outright.
	 *
	 * The same command the REST route dispatches. The delivered command answers the store's own delete
	 * result — a statement about the write, `{ affected }` — which is not a row and not what a field
	 * named `deleteInvoice` may return; the field answers the one fact the command establishes, that
	 * the removal ran.
	 */
	@Mutation('deleteInvoice')
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	async deleteInvoice(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.commandBus.execute(new InvoiceDeleteCommand(id));

		return true;
	}

	/**
	 * Withdraws a document without removing the row.
	 *
	 * No permission is stated on the field beyond the one the controller's class carries, because the
	 * delivered route states none of its own: the withdrawal is inherited from the CRUD base, where
	 * the controller's class-level edit permission is the whole of its scope. The delivered route
	 * passes the service the empty option list that leaves, so the field states none either.
	 */
	@Mutation('softDeleteInvoice')
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	async softDeleteInvoice(@Args('id', { type: () => ID }) id: Id): Promise<Invoice> {
		return await this.invoiceService.softRemove(id);
	}

	/**
	 * Puts a withdrawn document back. Its permission is the withdrawal's, for the same reason: the
	 * delivered route carries none of its own to mirror.
	 */
	@Mutation('recoverInvoice')
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	async recoverInvoice(@Args('id', { type: () => ID }) id: Id): Promise<Invoice> {
		return await this.invoiceService.softRecover(id);
	}

	/**
	 * The payload the delivered create handler reads.
	 *
	 * The tenant is deliberately not among the members: the service stamps the caller's own tenant
	 * onto the row and refuses a row that belongs to another one, so stating a tenant here would
	 * promise a scope the write refuses. The facets are carried as the identifiers the pivot row is
	 * written from.
	 */
	private createPayload(input: ICreateInvoiceInput): IInvoiceCreateInput {
		const { tagIds, ...values } = input;

		return {
			...values,
			...(tagIds ? { tags: tagIds.map((id) => ({ id })) } : {})
		} as unknown as IInvoiceCreateInput;
	}

	/**
	 * A rendered document, as the shape the SDL declares.
	 *
	 * The delivered renderer answers the document's bytes and nothing else, and it answers nothing at
	 * all when it fails — it logs the failure rather than raising it, and the routes answer an empty
	 * body in that case. The media type is the one the renderer produces and the length is the
	 * buffer's own, so the two members state what the bytes are rather than a second copy of them.
	 */
	private documentOf(buffer: Buffer): IInvoiceDocument | null {
		if (!buffer) {
			return null;
		}

		return {
			contentType: 'application/pdf',
			byteLength: buffer.length,
			content: buffer.toString('base64')
		};
	}

	/**
	 * The language the delivered reads and renders select.
	 *
	 * The controller reads the `language` request header — the list route through its language
	 * decorator, the two renders and the send through `I18nLang`, which the i18n configuration binds
	 * to a `language` header resolver with an English fallback. `RequestContext.getLanguageCode()`
	 * reads the same header off the same request and applies the same fallback, so a caller asking
	 * the same question over either protocol is answered in the same language. Without a request it
	 * answers English, which is that same fallback.
	 */
	private languageOfTheCaller(): LanguagesEnum {
		return RequestContext.getLanguageCode();
	}

	/**
	 * The origin the delivered send reads from the request's `origin` header.
	 *
	 * The delivered dispatcher builds the link the message carries from it, so the field reads it off
	 * the same request rather than asking the caller to state it a second time: a caller cannot state
	 * one origin over one protocol and a different one over the other. A request without the header
	 * states none, which is the route's own case.
	 */
	private originOfTheCaller(): string | undefined {
		const request = RequestContext.currentRequest() as { headers?: Record<string, unknown> } | null;
		const origin = request?.headers?.['origin'];

		return typeof origin === 'string' ? origin : undefined;
	}
}
