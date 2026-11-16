import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { ID, IInvoiceItem, IInvoiceItemCreateInput } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { Invoice } from '../core/entities/internal';
import { InvoiceItem } from './invoice-item.entity';
import {
	assertBillingInOrganization,
	assertBillingOnInvoice,
	IBillingLine,
	ILinesRepositories,
	ILinesTransaction,
	inLinesTransaction,
	saveBillingTime,
	splitBilledTime
} from './invoice-item-billed-time';
import { replaceLinesKeepingTime } from './invoice-item-kept-time';
import { holdInvoiceUnchanged, INVOICE_LINE_OF_ANOTHER_INVOICE, touchInvoice } from '../invoice/invoice-precondition';
import { MikroOrmInvoiceItemRepository } from './repository/mikro-orm-invoice-item.repository';
import { TypeOrmInvoiceItemRepository } from './repository/type-orm-invoice-item.repository';

@Injectable()
export class InvoiceItemService extends TenantAwareCrudService<InvoiceItem> {
	constructor(
		typeOrmInvoiceItemRepository: TypeOrmInvoiceItemRepository,
		mikroOrmInvoiceItemRepository: MikroOrmInvoiceItemRepository
	) {
		super(typeOrmInvoiceItemRepository, mikroOrmInvoiceItemRepository);
	}

	/**
	 * Creates multiple invoice items in bulk after removing existing ones for the given invoice.
	 *
	 * @param {ID} invoiceId - The unique identifier of the invoice.
	 * @param {IInvoiceItemCreateInput[]} input - An array of invoice items to be created.
	 * @param {Date | null} expectedUpdatedAt - The `updatedAt` the invoice was read with: the items are replaced only
	 * while the invoice still holds it (see `replaceLinesUnchangedSince`). Null, they are replaced as they always were.
	 * @returns {Promise<IInvoiceItem[]>} - A promise resolving to the newly created invoice items.
	 *
	 * @throws {HttpException} - Throws an error if the operation fails.
	 *
	 * @description
	 * This method first deletes any existing invoice items associated with the given `invoiceId`
	 * to ensure that only the new items are stored. It then performs a bulk insert operation
	 * to save the provided invoice items in the database, in the same transaction: a save that
	 * fails keeps the old items. Items that name the time logs they bill are replaced with that
	 * time (`replaceLinesBillingTime`); an item that names none and says what an old item said
	 * keeps the time the old one billed (`replaceLinesKeepingTime`).
	 */
	async createBulk(
		invoiceId: ID,
		input: IInvoiceItemCreateInput[],
		expectedUpdatedAt: Date | null = null
	): Promise<IInvoiceItem[]> {
		if (expectedUpdatedAt) {
			return await this.replaceLinesUnchangedSince(invoiceId, input, expectedUpdatedAt);
		}

		const { lines, billing } = splitBilledTime(input);
		if (billing.length > 0) {
			return await this.replaceLinesBillingTime(invoiceId, input, lines, billing);
		}

		try {
			return await inLinesTransaction(this, this.ownRepositories(), (service, transaction) =>
				replaceLinesKeepingTime(service, transaction, invoiceId, input, lines, [])
			);
		} catch (error) {
			throw new HttpException(
				`Failed to create bulk invoice items: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * Replaces the invoice's lines, as {@link createBulk} does, in a transaction another write opened (see
	 * `inLinesTransaction`): the invoice edit that saves its fields and its lines together, and the conditional
	 * replacement below. The replacement runs nested in that transaction, so a failure of either rolls both back.
	 *
	 * Every line is saved as a line of this invoice, the one whose precondition was checked, whichever `invoiceId` it
	 * states. A line that names an existing line by its `id` may name only a line of this invoice: a line of another
	 * invoice would be moved onto this one, and that invoice changed without its own precondition.
	 *
	 * @param transaction The transaction opened by the caller.
	 * @param invoiceId The invoice whose lines are replaced.
	 * @param input The new lines.
	 * @returns The new lines.
	 * @throws BadRequestException when a line names a line this invoice does not hold, or names one twice; nothing is
	 * saved.
	 */
	async replaceLinesIn(
		transaction: ILinesTransaction,
		invoiceId: ID,
		input: IInvoiceItemCreateInput[]
	): Promise<IInvoiceItem[]> {
		const service = this.onTransaction(transaction);
		const lines = await service.linesOfInvoice(invoiceId, input);
		return await service.createBulk(invoiceId, lines);
	}

	/**
	 * The lines, each bound to the invoice: stating it, and naming by `id`, when it names one, a line the invoice holds.
	 *
	 * @throws BadRequestException when a line names a line the invoice does not hold, or names one twice.
	 */
	private async linesOfInvoice(invoiceId: ID, input: IInvoiceItemCreateInput[]): Promise<IInvoiceItemCreateInput[]> {
		const namedIds = input.map((line) => line.id).filter((id): id is ID => Boolean(id));
		if (namedIds.length > 0) {
			const held = await this.find({ where: { invoiceId } as FindOptionsWhere<InvoiceItem> });
			const heldIds = new Set(held.map((line) => line.id));
			const namesEachOnce = new Set(namedIds).size === namedIds.length;
			const namesOnlyItsOwn = namedIds.every((id) => heldIds.has(id));
			if (!namesEachOnce || !namesOnlyItsOwn) {
				throw new BadRequestException(INVOICE_LINE_OF_ANOTHER_INVOICE);
			}
		}
		return input.map((line) => ({ ...line, invoiceId }));
	}

	/**
	 * Replaces the invoice's lines only while the invoice still holds the `updatedAt` the caller read: the invoice is
	 * locked and compared, its lines replaced, and its `updatedAt` moved, in one transaction, so the next precondition
	 * sees the change of its lines.
	 *
	 * @throws InvoiceChangedError (from `holdInvoiceUnchanged`) when the invoice was written since; nothing is saved, and
	 * the route answers 409.
	 */
	private async replaceLinesUnchangedSince(
		invoiceId: ID,
		input: IInvoiceItemCreateInput[],
		expectedUpdatedAt: Date
	): Promise<IInvoiceItem[]> {
		return await inLinesTransaction(this, this.ownRepositories(), async (service, transaction) => {
			const stored = await holdInvoiceUnchanged(transaction, invoiceId, expectedUpdatedAt);
			const saved = await service.replaceLinesIn(transaction, invoiceId, input);
			await touchInvoice(transaction, invoiceId, stored);
			return saved;
		});
	}

	/**
	 * This service on the transaction given: on TypeORM its repository is the transaction's, so the tenant-aware writes
	 * of the CRUD base run in it (as `inLinesTransaction` gives its work); on MikroORM the repositories follow the
	 * transaction on their own.
	 */
	private onTransaction(transaction: ILinesTransaction): InvoiceItemService {
		if (!transaction.typeOrm) {
			return this;
		}
		const repository = transaction.typeOrm.getRepository(this.typeOrmRepository.target);
		return Object.create(this, { typeOrmRepository: { value: repository, configurable: true } });
	}

	/**
	 * Replaces the invoice's lines with the ones given and writes, on each time log they bill, the line that bills it,
	 * in one transaction. Removing the old lines releases the time they billed; a time log the new lines may not bill
	 * keeps the old lines, and their time, in place. A line that bills time must be a line of this invoice, of its
	 * organization: the CRUD write holds each line to the caller's boundary only.
	 *
	 * @param invoiceId The invoice whose lines are replaced.
	 * @param requested The new lines, as the request states them.
	 * @param lines The new lines, as they are written.
	 * @param billing The new lines that bill time.
	 * @returns The new lines.
	 * @throws BadRequestException when a line bills time on another invoice or of another organization; nothing is saved.
	 */
	private async replaceLinesBillingTime(
		invoiceId: ID,
		requested: IInvoiceItemCreateInput[],
		lines: IInvoiceItemCreateInput[],
		billing: IBillingLine[]
	): Promise<IInvoiceItem[]> {
		assertBillingOnInvoice(billing, invoiceId);
		const invoice = await this.invoiceInCallerTenant(invoiceId);
		assertBillingInOrganization(billing, invoice?.organizationId);
		const named = billing.flatMap((line) => line.timeLogIds);
		return await saveBillingTime(
			this,
			this.ownRepositories(),
			(service, transaction) => replaceLinesKeepingTime(service, transaction, invoiceId, requested, lines, named),
			(saved) => saved,
			billing
		);
	}

	private ownRepositories(): ILinesRepositories<InvoiceItem> {
		return { typeOrm: this.typeOrmRepository, mikroOrm: this.mikroOrmRepository };
	}

	/**
	 * The invoice of that id in the caller's tenant, or `null` when the caller has no tenant or the tenant no such
	 * invoice. Read through TypeORM on either ORM, as the CRUD base reads the rows it checks a write against.
	 */
	private async invoiceInCallerTenant(invoiceId: ID): Promise<Invoice | null> {
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			return null;
		}
		return await this.typeOrmRepository.manager.findOne(Invoice, {
			where: { id: invoiceId, tenantId },
			select: { id: true, organizationId: true }
		});
	}
}
