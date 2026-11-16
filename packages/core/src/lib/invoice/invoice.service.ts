import { BaseQueryDTO, TenantAwareCrudService } from './../core/crud';
import { Invoice } from './invoice.entity';
import { FilterQuery } from '@mikro-orm/core';
import { InvoiceItem } from '../core/entities/internal';
import { Between, FindOperator, In, IsNull, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { EmailService } from './../email-send/email.service';
import {
	BaseEntityEnum,
	DecimalString,
	ID,
	IInvoice,
	IInvoiceCreateInput,
	IInvoiceItem,
	IInvoiceItemCreateInput,
	IInvoiceUpdateInput,
	IOrganization,
	InvoiceStats,
	LanguagesEnum
} from '@gauzy/contracts';
import { isPlainObject } from '@gauzy/utils';
import { addDecimalStrings, normalizeDecimalString } from '../money/decimal';
import { signPurposeToken, TokenPurposeEnum } from '../auth/purpose-token';
import { MultiORMEnum, parseFindOptionsRelations } from './../core/utils';
import { RequestContext } from './../core/context';
import { I18nService } from 'nestjs-i18n';
import * as moment from 'moment';
import { EstimateEmailService } from '../estimate-email/estimate-email.service';
import { Readable } from 'stream';
import { randomUUID } from 'node:crypto';
import { PdfmakerService } from './pdfmaker.service';
import { generateInvoicePdfDefinition, generateInvoicePaymentPdfDefinition } from './index';
import { OrganizationService } from './../organization';
import { TypeOrmInvoiceRepository } from './repository/type-orm-invoice.repository';
import { MikroOrmInvoiceRepository } from './repository/mikro-orm-invoice.repository';
import { FavoriteService } from '../core/decorators';
import {
	assertFinalStatusKept,
	holdFinalStatus,
	IInvoiceStatusChange,
	statesStatusOtherThanVoid,
	withoutReleasedTimeMark
} from './invoice-final-status';
import {
	assertBillingInOrganization,
	ILinesRepositories,
	ILinesTransaction,
	ILockedInvoice,
	inLinesTransaction,
	lockedOrganizationIdOf,
	lockInvoice,
	saveBillingTime,
	splitBilledTime
} from '../invoice-item/invoice-item-billed-time';
import {
	holdInvoiceUnchanged,
	INVOICE_LINE_OF_ANOTHER_INVOICE,
	INVOICE_ORGANIZATION_IS_KEPT,
	InvoiceChangedError,
	invoiceChangedException,
	touchInvoice
} from './invoice-precondition';

/**
 * What sending a document by e-mail did.
 *
 * `reason` names the step that failed when the message was not sent: the estimate e-mail record or the
 * organization could not be prepared, the PDF could not be generated, or the message was not sent (the mail
 * transport refused it, or the address is of a domain the platform never emails, such as `@example.com`).
 */
export interface IInvoiceEmailOutcome {
	/** Whether the message was handed to the mail transport. */
	sent: boolean;
	/** The step that failed, when it was not. */
	reason?: 'EMAIL_NOT_PREPARED' | 'DOCUMENT_NOT_GENERATED' | 'EMAIL_NOT_SENT';
}

/** One total of invoice values in one currency: how many documents, and their exact sum. */
export interface IInvoiceCurrencyTotal {
	currency: string;
	count: number;
	totalValue: DecimalString;
}

/** One status's total in one currency. */
export interface IInvoiceStatusTotal extends IInvoiceCurrencyTotal {
	status: string | null;
}

/** One organization's invoices (or estimates), counted and totalled per currency and per status. */
export interface IInvoiceStatistics {
	count: number;
	totals: IInvoiceCurrencyTotal[];
	byStatus: IInvoiceStatusTotal[];
}

/**
 * What replaces an invoice's lines in a transaction another write opened: `InvoiceItemService`, which the invoice edit
 * that saves the fields and the lines together (`PUT /invoices/:id/with-items`) hands over.
 */
export interface IInvoiceLinesWriter {
	replaceLinesIn(
		transaction: ILinesTransaction,
		invoiceId: ID,
		input: IInvoiceItemCreateInput[]
	): Promise<IInvoiceItem[]>;
}

/** What the conflict of a conditional write carries: the invoice with its lines, as the caller may read it now. */
const CHANGED_INVOICE_RELATIONS = ['invoiceItems'];

/** The ids of the stored lines a write of an invoice names among its `invoiceItems`. */
function namedLineIdsOf(change: { invoiceItems?: unknown }): ID[] {
	const lines = Array.isArray(change.invoiceItems) ? (change.invoiceItems as Array<{ id?: unknown } | null>) : [];
	return lines.map((line) => line?.id).filter((id): id is ID => typeof id === 'string' && id.length > 0);
}

/**
 * Refuses lines, saved by cascade with an invoice, that name by `id` a line of another invoice: the save would move
 * that line onto this invoice, and the invoice it left would lose it without its own `updatedAt` moving. A line named
 * by an id no line holds is a new line, as before; one of this invoice is saved in place, as before.
 *
 * @throws BadRequestException (`INVOICE_LINE_OF_ANOTHER_INVOICE`) when one does, or when one is named twice.
 */
async function assertNamedLinesOwn(transaction: ILinesTransaction, change: { id?: ID; invoiceItems?: unknown }) {
	const named = namedLineIdsOf(change);
	if (named.length === 0) {
		return;
	}
	if (new Set(named).size !== named.length) {
		throw new BadRequestException(INVOICE_LINE_OF_ANOTHER_INVOICE);
	}
	const tenantId = RequestContext.currentTenantId();
	let owners: Array<ID | null>;
	if (transaction.mikroOrm) {
		const where = (
			tenantId ? { id: { $in: named }, tenantId } : { id: { $in: named } }
		) as FilterQuery<InvoiceItem>;
		const stored = (await transaction.mikroOrm.find(InvoiceItem, where, {
			fields: ['id', 'invoice'] as never,
			filters: false,
			disableIdentityMap: true
		})) as unknown as Array<{ invoiceId?: ID | null; invoice?: { id?: ID } | null }>;
		owners = stored.map((line) => line.invoiceId ?? line.invoice?.id ?? null);
	} else {
		const stored = await transaction.typeOrm.find(InvoiceItem, {
			where: tenantId ? { id: In(named), tenantId } : { id: In(named) },
			select: { id: true, invoiceId: true },
			withDeleted: true
		});
		owners = stored.map((line) => line.invoiceId ?? null);
	}
	if (owners.some((owner) => owner !== change.id)) {
		throw new BadRequestException(INVOICE_LINE_OF_ANOTHER_INVOICE);
	}
}

/** Whether a write names an invoice and states lines for it, which its save writes by cascade. */
function statesLinesOfInvoice(change: { id?: ID; invoiceItems?: unknown }): boolean {
	const statesLines = Array.isArray(change.invoiceItems) && change.invoiceItems.length > 0;
	return Boolean(change.id) && statesLines;
}

/**
 * Runs a write of an invoice and of the lines it states (`POST /invoices` for an invoice saved before, or
 * `PUT /invoices/:id` with `invoiceItems`), and moves the invoice's `updatedAt` after, in the transaction given (#5243):
 * the lines are rows of their own, saved by cascade, and the invoice's own row may be left as it was, so a
 * precondition stated on it later would not see the change. A new invoice moves nothing more than its creation.
 *
 * @param transaction The transaction the write runs in.
 * @param change The write, naming the invoice when it names one.
 * @param write The write.
 * @returns What the write answered, with the invoice's new `updatedAt` when it moved.
 */
async function writingLinesOf(
	transaction: ILinesTransaction,
	change: { id?: ID; invoiceItems?: unknown },
	write: () => Promise<IInvoice>
): Promise<IInvoice> {
	await assertNamedLinesOwn(transaction, change);
	const savedBefore = statesLinesOfInvoice(change)
		? await lockInvoice(transaction, change.id, RequestContext.currentTenantId())
		: null;
	const written = await write();
	if (!savedBefore) {
		return written;
	}
	const updatedAt = await touchInvoice(transaction, change.id);
	return updatedAt ? Object.assign(written, { updatedAt }) : written;
}

/**
 * Refuses a change that moves the invoice to another organization in the save of its lines: the lines' time is checked
 * against the organization the invoice is stored in, and the edit screens never move an invoice.
 *
 * Both members are read, each when it is sent: `organizationId` and the `organization` relation. On MikroORM the
 * relation is what writes the foreign key (`organizationId` is its unpersisted mirror), so `organization: null` sent
 * beside the stored `organizationId` would clear the organization while the id alone looks unchanged.
 *
 * @param stored The invoice as the locking read answered it.
 * @param change The change.
 * @throws BadRequestException when either member states another organization than the stored one, or none.
 */
function assertOrganizationKept(stored: ILockedInvoice, change: IInvoiceUpdateInput): void {
	const storedOrganizationId = lockedOrganizationIdOf(stored);
	const stated: Array<ID | null> = [];
	if (change.organizationId !== undefined) {
		stated.push(change.organizationId ?? null);
	}
	if (change.organization !== undefined) {
		stated.push(change.organization?.id ?? null);
	}
	const movesIt = stated.some((organizationId) => organizationId !== storedOrganizationId);
	if (movesIt) {
		throw new BadRequestException(INVOICE_ORGANIZATION_IS_KEPT);
	}
}

/** What an invoice is read with to be rendered as a PDF (`InvoiceService.renderInvoicePdf`). */
export const INVOICE_PDF_RELATIONS: ReadonlyArray<string> = [
	'fromOrganization',
	'invoiceItems.employee.user',
	'invoiceItems.employee',
	'invoiceItems.expense',
	'invoiceItems.product',
	'invoiceItems.product.translations',
	'invoiceItems.project',
	'invoiceItems.task',
	'invoiceItems',
	'toContact'
];

@FavoriteService(BaseEntityEnum.Invoice)
@Injectable()
export class InvoiceService extends TenantAwareCrudService<Invoice> {
	constructor(
		readonly typeOrmInvoiceRepository: TypeOrmInvoiceRepository,
		readonly mikroOrmInvoiceRepository: MikroOrmInvoiceRepository,
		private readonly emailService: EmailService,
		private readonly estimateEmailService: EstimateEmailService,
		private readonly pdfmakerService: PdfmakerService,
		private readonly i18n: I18nService,
		private readonly organizationService: OrganizationService
	) {
		super(typeOrmInvoiceRepository, mikroOrmInvoiceRepository);
	}

	/**
	 * Creates an invoice and writes, on each time log a line names in `timeLogIds`, the line that bills it, in the
	 * transaction that saves the invoice and its lines (see `saveBillingTime`). An invoice whose lines bill no time is
	 * created as `create()` creates it. A create that names an invoice saved earlier updates it, so it keeps a final
	 * status as an update does (see `writeKeepingFinalStatus`).
	 *
	 * @param input The invoice and its lines, as the create route and the GraphQL mutation state them.
	 * @returns The invoice created, with its lines.
	 * @throws BadRequestException when a line names a time log it may not bill, or the create would take an invoice
	 * saved earlier out of a final status; nothing is saved.
	 */
	async createWithBilledTime(
		request: IInvoiceCreateInput & { invoiceItems?: IInvoiceItemCreateInput[] }
	): Promise<IInvoice> {
		// The mark of released time billed since is written by the billing only, never from a request body
		const input = withoutReleasedTimeMark(request);
		if (!input.invoiceItems) {
			return await this.writeKeepingFinalStatus(input, (service) => service.create(input));
		}
		const { lines, billing } = splitBilledTime(input.invoiceItems);
		const invoice = { ...input, invoiceItems: lines };
		if (billing.length === 0) {
			return await this.writeKeepingFinalStatus(input, (service) => service.create(invoice));
		}
		// `create` holds the invoice's organization to the caller's boundary, not the one each nested line states: a line
		// may only bill time of its invoice's organization (else a member of two organizations could bill one's time on
		// the other's invoice).
		const invoiceOrganizationId = input.organizationId ?? input.organization?.id;
		assertBillingInOrganization(billing, invoiceOrganizationId);
		const leavesFinalStatus = await this.mayLeaveFinalStatus(input);
		return await saveBillingTime(
			this,
			this.ownRepositories(),
			async (service, transaction) => {
				if (leavesFinalStatus) {
					await holdFinalStatus(transaction, input);
				}
				return await writingLinesOf(transaction, input, () => service.create(invoice));
			},
			(created) => created.invoiceItems,
			billing
		);
	}

	/**
	 * Writes a change to an invoice, or a new invoice, keeping a final status: a void invoice or estimate, or a rejected
	 * estimate, is not taken out of it (see `assertFinalStatusKept`). A change that may do so runs in a transaction that
	 * first locks the invoice and reads its status, so a void or a rejection another request writes meanwhile is waited
	 * for and refused against, not written over. A change that states lines of an invoice saved before runs in a
	 * transaction too, which moves the invoice's `updatedAt` once its lines are saved (see `writingLinesOf`). Any other
	 * change is written as it was, reading nothing more.
	 *
	 * @param change The change, or the new invoice, as the write states it.
	 * @param write The write, run on the service it is given (the transaction's, when there is one).
	 * @returns What the write answered.
	 * @throws BadRequestException when the change states a status the invoice's final status refuses; nothing is saved.
	 */
	async writeKeepingFinalStatus(
		change: IInvoiceStatusChange & { invoiceItems?: unknown },
		write: (service: InvoiceService) => Promise<IInvoice>
	): Promise<IInvoice> {
		const leavesFinalStatus = await this.mayLeaveFinalStatus(change);
		const savesLines = statesLinesOfInvoice(change) || namedLineIdsOf(change).length > 0;
		if (!leavesFinalStatus && !savesLines) {
			return await write(this);
		}
		return await inLinesTransaction(this, this.ownRepositories(), async (service, transaction) => {
			if (leavesFinalStatus) {
				await holdFinalStatus(transaction, change);
			}
			if (!savesLines) {
				return await write(service);
			}
			return await writingLinesOf(transaction, change, () => write(service));
		});
	}

	/**
	 * Writes a change to an invoice only while the invoice still holds the `updatedAt` the caller read
	 * (`PUT /invoices/:id` with `expectedUpdatedAt`). The invoice is locked, compared and written in one transaction,
	 * so nothing saved after the comparison is written over, and a final status is kept as
	 * {@link writeKeepingFinalStatus} keeps it. Its `updatedAt` is then moved, in the same transaction, so the
	 * `updatedAt` the caller read no longer matches: a database that keeps it to the second (SQLite) would otherwise
	 * let a second save made on the same read through.
	 *
	 * @param change The change, naming the invoice.
	 * @param expectedUpdatedAt The `updatedAt` the caller read.
	 * @returns What the write answered, with the invoice's new `updatedAt`.
	 * @throws ApiException 409 (`CONCURRENT_MODIFICATION`) with the invoice as it is now, when it was written since;
	 * nothing is saved. 404 when the caller's tenant has no such invoice.
	 */
	async updateUnchangedSince(change: IInvoiceUpdateInput, expectedUpdatedAt: Date): Promise<IInvoice> {
		return await this.answeringChange(() =>
			inLinesTransaction(this, this.ownRepositories(), async (service, transaction) => {
				const stored = await holdInvoiceUnchanged(transaction, change.id, expectedUpdatedAt);
				assertFinalStatusKept(stored, change.status);
				await assertNamedLinesOwn(transaction, change);
				const written = await service.create(change);
				// Past the value checked too: the write above can leave the row behind it (see `touchInvoice`)
				const updatedAt = await touchInvoice(transaction, change.id, stored.updatedAt);
				return { ...written, updatedAt: updatedAt ?? written.updatedAt } as IInvoice;
			})
		);
	}

	/**
	 * Writes a status action that states no precondition (`PUT /invoices/:id/action` without `expectedUpdatedAt`, and
	 * GraphQL `updateInvoiceAction`), as it always was written, final status kept, and moves the invoice's `updatedAt`
	 * in the same transaction (ever-co/ever-teams#5382). The ORM's own update date leaves it as it was when nothing
	 * changed, and keeps it to the second on SQLite and MySQL; a precondition read before the action would then still
	 * hold. The response is the one the action always answered, with the new `updatedAt`.
	 *
	 * @param change The action, naming the invoice.
	 * @returns What the write answered, with the invoice's new `updatedAt`.
	 * @throws BadRequestException when the action states a status the invoice's final status refuses; nothing is saved.
	 */
	async writeActionMovingUpdatedAt(change: IInvoiceUpdateInput): Promise<IInvoice> {
		const leavesFinalStatus = await this.mayLeaveFinalStatus(change);
		return await inLinesTransaction(this, this.ownRepositories(), async (service, transaction) => {
			if (leavesFinalStatus) {
				await holdFinalStatus(transaction, change);
			}
			const stored = await lockInvoice(transaction, change.id, RequestContext.currentTenantId());
			const written = await service.create(change);
			if (!stored) {
				return written;
			}
			const updatedAt = await touchInvoice(transaction, change.id, stored.updatedAt);
			return { ...written, updatedAt: updatedAt ?? written.updatedAt } as IInvoice;
		});
	}

	/**
	 * Writes an invoice's fields and replaces its lines in one transaction (`PUT /invoices/:id/with-items`): a save that
	 * fails, or is refused, writes neither, so an edit is never left half saved. With `expectedUpdatedAt`, both are
	 * written only while the invoice still holds it, as {@link updateUnchangedSince} writes the fields.
	 *
	 * The invoice's `updatedAt` is moved once the lines are replaced, so the next precondition sees a change of the
	 * lines alone too. The invoice keeps its organization: the lines' time is checked against the organization it is
	 * stored in, which a change made in the same transaction would leave behind.
	 *
	 * @param change The fields, naming the invoice; no lines.
	 * @param lines Every line of the invoice once saved, as `POST /invoice-item/bulk/:invoiceId` takes them.
	 * @param expectedUpdatedAt The `updatedAt` the caller read, or null to save without a precondition.
	 * @param linesWriter What replaces the lines in this transaction.
	 * @returns The invoice as written, with its new lines and its new `updatedAt`.
	 * @throws ApiException 409 (`CONCURRENT_MODIFICATION`) with the invoice as it is now, when it was written since;
	 * nothing is saved. 404 when the caller's tenant has no such invoice.
	 * @throws BadRequestException when the change moves the invoice to another organization; nothing is saved.
	 */
	async updateWithItems(
		change: IInvoiceUpdateInput,
		lines: IInvoiceItemCreateInput[],
		expectedUpdatedAt: Date | null,
		linesWriter: IInvoiceLinesWriter
	): Promise<IInvoice> {
		return await this.answeringChange(() =>
			inLinesTransaction(this, this.ownRepositories(), async (service, transaction) => {
				const stored = await holdInvoiceUnchanged(transaction, change.id, expectedUpdatedAt);
				assertFinalStatusKept(stored, change.status);
				assertOrganizationKept(stored, change);
				const written = await service.create(change);
				const invoiceItems = await linesWriter.replaceLinesIn(transaction, change.id, lines);
				// The replacement moved `updatedAt` already; this states the value the invoice ends the save with, past the
				// value checked too (see `touchInvoice`)
				const updatedAt = await touchInvoice(transaction, change.id, stored.updatedAt);
				return { ...written, invoiceItems, updatedAt: updatedAt ?? written.updatedAt } as IInvoice;
			})
		);
	}

	/**
	 * The answer to a conditional write whose precondition no longer holds: 409 with the invoice as the caller may read
	 * it now, read once the refused write's transaction is over.
	 *
	 * @param error What the transaction found.
	 * @returns The exception to throw.
	 */
	async invoiceChangedAnswer(error: InvoiceChangedError) {
		return await invoiceChangedException(error, (invoiceId) =>
			this.findOneByIdString(invoiceId, { relations: CHANGED_INVOICE_RELATIONS })
		);
	}

	/** Runs a conditional write, answering a precondition that no longer holds with {@link invoiceChangedAnswer}. */
	private async answeringChange<R>(write: () => Promise<R>): Promise<R> {
		try {
			return await write();
		} catch (error) {
			if (error instanceof InvoiceChangedError) {
				throw await this.invoiceChangedAnswer(error);
			}
			throw error;
		}
	}

	/**
	 * Whether a change may take an invoice out of a final status: it states a status other than VOID, for an invoice
	 * the caller can read, removed or not, since a write by id updates a removed invoice too. A new id, or an invoice
	 * the caller cannot read, is left to the write, which answers it as it did.
	 */
	private async mayLeaveFinalStatus(change: IInvoiceStatusChange): Promise<boolean> {
		const namesInvoice = Boolean(change.id);
		const statesOtherStatus = statesStatusOtherThanVoid(change.status);
		if (!namesInvoice || !statesOtherStatus) {
			return false;
		}
		const stored = await this.invoiceTheCallerReads(change.id);
		return stored !== null;
	}

	/** The invoice of that id as the caller reads it, removed or not; `null` when the caller cannot read it. */
	private async invoiceTheCallerReads(id: ID): Promise<Invoice | null> {
		try {
			return await this.findOneByIdString(id, { withDeleted: true });
		} catch {
			return null;
		}
	}

	private ownRepositories(): ILinesRepositories<Invoice> {
		return { typeOrm: this.typeOrmRepository, mikroOrm: this.mikroOrmRepository };
	}

	/**
	 * Retrieves the count and total amount of invoices where `isEstimate` is false.
	 *
	 * @returns {Promise<InvoiceStats>} An object containing the count of invoices and the total amount.
	 */
	async getInvoiceStats(): Promise<InvoiceStats> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const knex = this.mikroOrmRepository.getEntityManager().getKnex();
				// Raw knex bypasses the soft-delete filter that TypeORM's query builder applies
				const result = await knex('invoice')
					.where('isEstimate', false)
					.whereNull('deletedAt')
					.count('id as count')
					.sum('totalValue as amount')
					.first();
				return {
					count: parseInt(result?.count ?? '0', 10),
					amount: parseFloat(result?.amount ?? '0') || 0
				};
			}
			case MultiORMEnum.TypeORM:
			default: {
				const result = await this.typeOrmInvoiceRepository
					.createQueryBuilder('invoice')
					.select('COUNT(invoice.id)', 'count')
					.addSelect('SUM(invoice.totalValue)', 'amount')
					.where('invoice.isEstimate = :isEstimate', { isEstimate: false })
					.getRawOne();

				return {
					count: parseInt(result.count, 10),
					amount: parseFloat(result.amount) || 0
				};
			}
		}
	}

	/**
	 * One organization's invoices — or, when asked, its estimates — counted and totalled per currency and per
	 * status.
	 *
	 * Scoped where `getInvoiceStats` is not: that read feeds the platform-wide statistics and counts every
	 * tenant's invoices together, and is left as it is. This one reads only the credential's tenant (the CRUD
	 * read applies it) and the one organization named, and refuses to run without an organization rather
	 * than widening to the whole tenant. A soft-deleted document is not counted, because the CRUD read does
	 * not return it.
	 *
	 * Money is summed as exact decimal strings and never across currencies: an invoice in euros and one in
	 * dollars have no total. A document with no stored total counts and adds nothing.
	 *
	 * @param input The organization, and whether to read estimates instead of invoices (default: invoices).
	 * @returns The count, the totals per currency, and the totals per status and currency.
	 */
	async getStatistics(input: {
		tenantId?: ID;
		organizationId?: ID;
		isEstimate?: boolean;
	}): Promise<IInvoiceStatistics> {
		const { organizationId } = input ?? {};

		if (!organizationId) {
			throw new BadRequestException('INVOICE_ORGANIZATION_REQUIRED: invoice statistics are per organization.');
		}

		const rows = await this.find({
			where: { organizationId, isEstimate: input.isEstimate === true },
			select: { id: true, status: true, currency: true, totalValue: true }
		});

		const totals = new Map<string, IInvoiceCurrencyTotal>();
		const byStatus = new Map<string, IInvoiceStatusTotal>();

		for (const row of rows ?? []) {
			const currency = row.currency;
			const status = row.status ?? null;
			// The column is numeric; a driver may hand it over as a number or as text, and a document may hold
			// none. Each is read as the exact decimal it spells.
			const value = normalizeDecimalString(row.totalValue ?? 0);

			const total = totals.get(currency) ?? { currency, count: 0, totalValue: '0' };
			total.count += 1;
			total.totalValue = addDecimalStrings(total.totalValue, value);
			totals.set(currency, total);

			const key = `${status}|${currency}`;
			const bucket = byStatus.get(key) ?? { status, currency, count: 0, totalValue: '0' };
			bucket.count += 1;
			bucket.totalValue = addDecimalStrings(bucket.totalValue, value);
			byStatus.set(key, bucket);
		}

		return {
			count: rows?.length ?? 0,
			totals: Array.from(totals.values()).map((total) => ({
				...total,
				totalValue: normalizeDecimalString(total.totalValue)
			})),
			byStatus: Array.from(byStatus.values()).map((bucket) => ({
				...bucket,
				totalValue: normalizeDecimalString(bucket.totalValue)
			}))
		};
	}

	/**
	 * GET highest invoice number of the current tenant
	 *
	 * Invoices and estimates share one number sequence per tenant, and the unique constraint on
	 * `invoiceNumber` is tenant-local (tenantId, invoiceNumber). The aggregate runs on raw builders,
	 * which bypass TenantAwareCrudService scoping, so it must add the tenant predicate itself —
	 * unscoped, it disclosed the installation-wide maximum across tenants (GHSA-57hw-jqpj-ww97).
	 *
	 * @returns
	 */
	async getHighestInvoiceNumber(): Promise<IInvoice> {
		// Fail closed: without a tenant there is no sequence this caller may read.
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new ForbiddenException();
		}

		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					const knex = this.mikroOrmRepository.getEntityManager().getKnex();
					const result = await knex(this.tableName).where({ tenantId }).max('invoiceNumber as max').first();
					return { max: result?.max ?? 0 } as any;
				}
				case MultiORMEnum.TypeORM:
				default: {
					const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
					// Soft-deleted invoices included: they keep their number under UNIQUE(tenantId, invoiceNumber),
					// so leaving them out (the query builder's default) handed out a number already taken
					return await query
						.withDeleted()
						.select(`COALESCE(MAX(${query.alias}.invoiceNumber), 0)`, 'max')
						.where(`${query.alias}.tenantId = :tenantId`, { tenantId })
						.getRawOne();
				}
			}
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Sends an invoice or an estimate to a recipient, with the document attached as a PDF.
	 *
	 * A failure is logged and never raised — the route answers an accepted status whatever happened, and
	 * that is unchanged. What the method now also does is **say** what happened: a caller that records a
	 * document and then sends it (an order's quote) has to be able to report the send's outcome without
	 * failing the write it already made, and a send that answered nothing could only be reported as
	 * "attempted". The reason is a fixed code rather than the transport's own text, which can carry the
	 * mail server's details.
	 *
	 * @returns Whether the message was handed to the mail transport, and when it was not, which step failed.
	 */
	async sendEmail(
		languageCode: LanguagesEnum,
		email: string,
		invoiceNumber: number,
		invoiceId: string,
		isEstimate: boolean,
		origin: string,
		organizationId: string
	): Promise<IInvoiceEmailOutcome> {
		try {
			//create estimate email record: an invoice's names the invoice, and the language its reminders follow
			const estimateEmail = await this.estimateEmailService.createEstimateEmail(
				invoiceId,
				email,
				isEstimate ? undefined : { languageCode }
			);
			// Read inside the try: an invoice's row already names the invoice, so any failure from here on clears it
			let step: IInvoiceEmailOutcome['reason'] = 'EMAIL_NOT_PREPARED';
			try {
				const organization: IOrganization = await this.organizationService.findOneByIdString(organizationId);
				step = 'DOCUMENT_NOT_GENERATED';
				//generate estimate/invoice pdf and attached in email
				const buffer: Buffer = await this.generateInvoicePdf(invoiceId, languageCode);
				if (!buffer) throw new Error('PDF generation failed');
				const base64 = buffer?.toString('base64');

				// An invoice's email links to its public page, where the client opens it without an account
				const publicToken = isEstimate ? null : await this.publicLinkTokenOf(invoiceId);

				step = 'EMAIL_NOT_SENT';
				const handed = await this.emailService.emailInvoice(
					languageCode,
					email,
					base64,
					invoiceNumber,
					invoiceId,
					isEstimate,
					estimateEmail.token,
					origin,
					organization,
					...(publicToken ? [publicToken] : [])
				);
				if (!handed) throw new Error('the address is of a domain the platform never emails');

				return { sent: true };
			} catch (error) {
				console.log(`Error while sending estimate email ${invoiceNumber}: %s`, error?.message);
				if (!isEstimate) {
					await this.forgetInvoiceDelivery(estimateEmail.id, invoiceNumber);
				}

				return { sent: false, reason: step };
			}
		} catch (error) {
			console.log(`Error while creating estimate email for invoice ${invoiceId}: %s`, error?.message);

			return { sent: false, reason: 'EMAIL_NOT_PREPARED' };
		}
	}

	/**
	 * Takes back the delivery an invoice's email row named from its creation, when the email did not go: the invoice's
	 * payment reminders keep going where it last went. The send's outcome is already known, so a failure is logged:
	 * the row then still names the invoice, and its reminders may go to this address, each with the invoice attached.
	 */
	private async forgetInvoiceDelivery(estimateEmailId: ID, invoiceNumber: number): Promise<void> {
		try {
			await this.estimateEmailService.forgetInvoiceDelivery(estimateEmailId);
		} catch (error) {
			console.log(
				`Invoice ${invoiceNumber} was not emailed, and its email row still names it, so its payment reminders may go to that address: %s`,
				error?.message
			);
		}
	}

	/**
	 * The token of an invoice's public page, for the email that sends the invoice. Every invoice gets one when it is
	 * created (`InvoiceSubscriber`), and that one is kept: a new token would revoke a link the client may already hold.
	 * An invoice whose link was revoked gets a new one, because sending the invoice shares it again. The new token is
	 * written only where the invoice still has none, so two sends at once mail the same link.
	 *
	 * A failure is logged and answers null: the email then goes without the link, as it did before links were mailed.
	 *
	 * @returns The token, or null when the invoice could not be given one.
	 */
	async publicLinkTokenOf(invoiceId: ID): Promise<string | null> {
		try {
			const invoice = await this.findOneByIdString(invoiceId);
			if (invoice.token) {
				return invoice.token;
			}
			// A claim of its own: a token signed in the same second as the revoked one would otherwise be that same token
			const token = signPurposeToken(TokenPurposeEnum.INVOICE_SHARE, {
				id: invoice.id,
				organizationId: invoice.organizationId,
				tenantId: invoice.tenantId,
				jti: randomUUID()
			});
			await this.typeOrmInvoiceRepository.update(
				{ id: invoice.id, tenantId: invoice.tenantId, token: IsNull() },
				{ token }
			);
			// Read back from the database through the repository that wrote it: a send at the same moment may have written
			// its token first, and that is the one that holds. The entity read above may be cached (MikroORM's identity
			// map) with the token it had before the write.
			const stored = await this.typeOrmInvoiceRepository.findOne({
				where: { id: invoice.id, tenantId: invoice.tenantId },
				select: { id: true, token: true }
			});
			return stored?.token ?? null;
		} catch (error) {
			console.log(`Invoice ${invoiceId} is emailed without a link to its public page: %s`, error?.message);
			return null;
		}
	}

	/**
	 * Revokes the public link of an invoice or an estimate: the link stops opening it, wherever it was sent. Generating
	 * a link again, or sending an invoice again, makes a new one.
	 *
	 * @param invoiceId An invoice of the caller's tenant.
	 * @throws NotFoundException when the caller's tenant has no such invoice.
	 */
	async revokeLink(invoiceId: ID): Promise<void> {
		const invoice = await this.findOneByIdString(invoiceId);
		await this.typeOrmInvoiceRepository.update({ id: invoice.id, tenantId: invoice.tenantId }, { token: null });
	}

	/**
	 * Generate invoice public link
	 *
	 * @param invoiceId
	 * @returns
	 */
	async generateLink(invoiceId: string): Promise<IInvoice> {
		try {
			const invoice = await this.findOneByIdString(invoiceId);
			// A claim of its own, so a link generated again in the same second is never the one it replaces
			const payload = {
				id: invoice.id,
				organizationId: invoice.organizationId,
				tenantId: invoice.tenantId,
				jti: randomUUID()
			};
			return await this.create({
				id: invoiceId,
				token: signPurposeToken(TokenPurposeEnum.INVOICE_SHARE, payload)
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	async generateInvoicePdf(invoiceId: string, language: string) {
		const invoice: IInvoice = await this.findOneByIdString(invoiceId, {
			relations: [...INVOICE_PDF_RELATIONS]
		});
		return await this.renderInvoicePdf(invoice, language);
	}

	/**
	 * Renders an invoice of `tenantId` as a PDF, in `language`, as `generateInvoicePdf` does, but reading the invoice by
	 * its id and its tenant rather than through the request: for a caller outside one (the payment reminder sweep).
	 *
	 * @returns The PDF, or null when the tenant has no such invoice.
	 */
	async generateTenantInvoicePdf(invoiceId: ID, tenantId: ID, language: string): Promise<Buffer | null> {
		const invoice = await this.typeOrmInvoiceRepository.findOne({
			where: { id: invoiceId, tenantId },
			relations: parseFindOptionsRelations<Invoice>([...INVOICE_PDF_RELATIONS])
		});
		return invoice ? await this.renderInvoicePdf(invoice, language) : null;
	}

	/** Renders an invoice read with {@link INVOICE_PDF_RELATIONS} as a PDF, in `language`. Reads nothing from the request. */
	private async renderInvoicePdf(invoice: IInvoice, language: string): Promise<Buffer> {
		const translatedText = {
			item: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.INVOICE_ITEM.ITEM', { lang: language }),
			description: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.INVOICE_ITEM.DESCRIPTION', {
				lang: language
			}),
			quantity: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.INVOICE_ITEM.QUANTITY', {
				lang: language
			}),
			price: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.INVOICE_ITEM.PRICE', { lang: language }),
			totalValue: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.INVOICE_ITEM.TOTAL_VALUE', {
				lang: language
			}),

			invoice: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.INVOICE', { lang: language }),
			estimate: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.ESTIMATE', { lang: language }),
			number: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.NUMBER', { lang: language }),
			from: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.FROM', { lang: language }),
			to: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.TO', { lang: language }),
			date: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.DATE', { lang: language }),
			dueDate: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.DUE_DATE', { lang: language }),
			discountValue: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.INVOICES_SELECT_DISCOUNT_VALUE', {
				lang: language
			}),
			discountType: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.DISCOUNT_TYPE', {
				lang: language
			}),
			taxValue: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.TAX_VALUE', { lang: language }),
			taxType: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.TAX_TYPE', { lang: language }),
			currency: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.CURRENCY', { lang: language }),
			terms: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.INVOICES_SELECT_TERMS', {
				lang: language
			}),
			paid: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAID', { lang: language }),
			yes: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.YES', { lang: language }),
			no: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.NO', { lang: language }),
			alreadyPaid: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.ALREADY_PAID', { lang: language }),
			amountDue: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.AMOUNT_DUE', { lang: language })
		};
		const docDefinition = await generateInvoicePdfDefinition(
			invoice,
			invoice.fromOrganization,
			invoice.toContact,
			translatedText,
			language
		);
		return await this.pdfmakerService.generatePdf(docDefinition);
	}

	async generateInvoicePaymentPdf(invoiceId: string, language: string) {
		const invoice: IInvoice = await this.findOneByIdString(invoiceId, {
			relations: [
				'invoiceItems',
				'fromOrganization',
				'toContact',
				'payments',
				'payments.invoice',
				'payments.createdByUser'
			]
		});

		const translatedText = {
			overdue: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.OVERDUE', { lang: language }),
			onTime: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.ON_TIME', { lang: language }),
			paymentDate: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.PAYMENT_DATE', {
				lang: language
			}),
			amount: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.AMOUNT', { lang: language }),
			createdByUser: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.RECORDED_BY', {
				lang: language
			}),
			note: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.NOTE', { lang: language }),
			status: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.STATUS', { lang: language }),
			paymentsForInvoice: await this.i18n.translate(
				'USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.PAYMENTS_FOR_INVOICE',
				{ lang: language }
			),
			dueDate: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.DUE_DATE', { lang: language }),
			totalValue: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.INVOICE_ITEM.TOTAL_VALUE', {
				lang: language
			}),
			totalPaid: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.TOTAL_PAID', {
				lang: language
			}),
			receivedFrom: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.RECEIVED_FROM', {
				lang: language
			}),
			receiver: await this.i18n.translate('USER_ORGANIZATION.INVOICES_PAGE.PAYMENTS.RECEIVER', { lang: language })
		};

		const docDefinition = await generateInvoicePaymentPdfDefinition(
			invoice,
			invoice.payments,
			invoice.fromOrganization,
			invoice.toContact,
			invoice.alreadyPaid,
			translatedText
		);

		return await this.pdfmakerService.generatePdf(docDefinition);
	}

	getReadableStream(buffer: Buffer): Readable {
		const stream = new Readable();

		stream.push(buffer);
		stream.push(null);

		return stream;
	}

	/**
	 * GET invoices pagination by params
	 *
	 * @param filter
	 * @returns
	 */
	public pagination(filter?: BaseQueryDTO<any>) {
		if ('where' in filter) {
			const { where } = filter;
			if (where.tags) {
				filter.where.tags = {
					id: In(where.tags)
				};
			}
			if (where.toContact) {
				filter.where.toContact = {
					id: In(where.toContact)
				};
			}
			// The end bounds below cover their whole last second: the add/edit forms save dates with
			// `endOf('day')` (23:59:59.999), which a `HH:mm:ss` bound of 23:59:59 would exclude.
			if ('invoiceDate' in where) {
				const { invoiceDate } = where;
				const { startDate, endDate } = invoiceDate;

				if (startDate && endDate) {
					filter.where.invoiceDate = Between(
						moment.utc(startDate).format('YYYY-MM-DD HH:mm:ss'),
						moment.utc(endDate).endOf('second').format('YYYY-MM-DD HH:mm:ss.SSS')
					);
				} else {
					filter.where.invoiceDate = Between(
						moment().startOf('month').utc().format('YYYY-MM-DD HH:mm:ss'),
						moment().endOf('month').utc().format('YYYY-MM-DD HH:mm:ss')
					);
				}
			}
			if ('dueDate' in where) {
				const { dueDate } = where;
				const { startDate, endDate } = dueDate;

				if (startDate && endDate) {
					filter.where.dueDate = Between(
						moment.utc(startDate).format('YYYY-MM-DD HH:mm:ss'),
						moment.utc(endDate).endOf('second').format('YYYY-MM-DD HH:mm:ss.SSS')
					);
				} else {
					filter.where.dueDate = Between(
						moment().startOf('month').utc().format('YYYY-MM-DD HH:mm:ss'),
						moment().endOf('month').utc().format('YYYY-MM-DD HH:mm:ss')
					);
				}
			}

			// Only a `{ min, max }` range is rewritten: a scalar is the exact amount the Invoices search form sends.
			if (isPlainObject(where.totalValue) && !(where.totalValue instanceof FindOperator)) {
				const range = where.totalValue as { min?: unknown; max?: unknown };
				const min = this.toRangeBound(range.min);
				const max = this.toRangeBound(range.max);

				if (min !== undefined && max !== undefined && min > max) {
					throw new BadRequestException('Minimum value cannot be greater than maximum value');
				}

				if (min !== undefined && max !== undefined) {
					filter.where.totalValue = Between(min, max);
				} else if (min !== undefined) {
					filter.where.totalValue = MoreThanOrEqual(min);
				} else if (max !== undefined) {
					filter.where.totalValue = LessThanOrEqual(max);
				} else {
					delete filter.where.totalValue;
				}
			}
		}
		return super.paginate(filter);
	}

	/**
	 * Reads one bound of a range filter as a number.
	 *
	 * Bounds come from the query string as text, which compares as text ('50' > '100'), and a bound the
	 * client left empty comes as `false` (it sends `null`, which `convertNativeLeaf` maps to `false`).
	 *
	 * @param value - The `min` or `max` of the range, as received.
	 * @returns A finite number, or `undefined` for a missing, empty or non-numeric bound.
	 */
	private toRangeBound(value: unknown): number | undefined {
		const bound = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
		return typeof bound === 'number' && Number.isFinite(bound) ? bound : undefined;
	}
}
