import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ID, IInvoiceItem, IInvoiceItemCreateInput } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { IFindOneOptions, IPartialEntity } from './../core/crud/icrud.service';
import { Invoice } from '../core/entities/internal';
import { InvoiceItem } from './invoice-item.entity';
import {
	assertBillingInOrganization,
	assertBillingOnInvoice,
	IBillingLine,
	ILinesRepositories,
	ILinesTransaction,
	inLinesTransaction,
	lockInvoice,
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
	 *
	 * Every replacement moves the invoice's `updatedAt`, in its transaction, precondition or not (#5243): the invoice's
	 * own row is otherwise left as it was, and a precondition stated on it later would not see that its lines changed.
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
				replaceLinesMovingInvoice(service, transaction, invoiceId, input, lines, [])
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
	 * locked and compared, and its lines replaced (which moves its `updatedAt`), in one transaction.
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
			await holdInvoiceUnchanged(transaction, invoiceId, expectedUpdatedAt);
			return await service.replaceLinesIn(transaction, invoiceId, input);
		});
	}

	/**
	 * Records one line (`POST /invoice-item`, GraphQL `createInvoiceItem`), moving its invoice's `updatedAt` (see
	 * {@link writeLinesOf}).
	 */
	async createLine(entity: IPartialEntity<InvoiceItem>): Promise<InvoiceItem> {
		return await this.writeLinesOf([invoiceIdStatedBy(entity)], (service) => service.create(entity));
	}

	/**
	 * Changes one line (`PUT /invoice-item/:id`, GraphQL `updateInvoiceItem`), moving the `updatedAt` of the invoice it
	 * belongs to, and of the one it is moved to, if any (see {@link writeLinesOf}).
	 */
	async updateLine(id: ID, patch: QueryDeepPartialEntity<InvoiceItem>): Promise<UpdateResult | InvoiceItem> {
		const invoiceId = await this.invoiceIdOfLine(id);
		const invoiceIds = [invoiceId, invoiceIdStatedBy(patch as Record<string, unknown>)];
		return await this.writeLinesOf(invoiceIds, (service) => service.update(id, patch));
	}

	/**
	 * Removes one line outright (`DELETE /invoice-item/:id`, GraphQL `deleteInvoiceItem`), moving its invoice's
	 * `updatedAt` (see {@link writeLinesOf}).
	 */
	async deleteLine(id: ID): Promise<DeleteResult> {
		const invoiceId = await this.invoiceIdOfLine(id);
		return await this.writeLinesOf([invoiceId], (service) => service.delete(id));
	}

	/**
	 * Withdraws one line (`DELETE /invoice-item/:id/soft`, GraphQL `softDeleteInvoiceItem`), moving its invoice's
	 * `updatedAt` (see {@link writeLinesOf}).
	 */
	async softRemoveLine(id: ID, options?: IFindOneOptions<InvoiceItem>): Promise<InvoiceItem> {
		const invoiceId = await this.invoiceIdOfLine(id);
		return await this.writeLinesOf([invoiceId], (service) => service.softRemove(id, options));
	}

	/**
	 * Restores one withdrawn line (`PUT /invoice-item/:id/recover`, GraphQL `recoverInvoiceItem`), moving its invoice's
	 * `updatedAt` (see {@link writeLinesOf}).
	 */
	async softRecoverLine(id: ID, options?: IFindOneOptions<InvoiceItem>): Promise<InvoiceItem> {
		const invoiceId = await this.invoiceIdOfLine(id);
		return await this.writeLinesOf([invoiceId], (service) => service.softRecover(id, options));
	}

	/**
	 * Writes lines one at a time, as the line routes do, in a transaction that locks the invoices they belong to first
	 * and moves their `updatedAt` after (#5243): a line is a row of its own, so its write leaves the invoice's row as it
	 * was, and a precondition stated on the invoice later would not see the change. Locking first is also what a
	 * replacement of the lines and a conditional write do, so the three run one after the other on an invoice. A write
	 * that names no invoice of the caller's tenant is made as it always was, and moves nothing.
	 *
	 * @param invoiceIds The invoices the write changes a line of.
	 * @param write The write, run on this service in the transaction.
	 * @returns What the write answered.
	 */
	private async writeLinesOf<R>(
		invoiceIds: Array<ID | null | undefined>,
		write: (service: InvoiceItemService) => Promise<R>
	): Promise<R> {
		const named = [...new Set(invoiceIds.filter((invoiceId): invoiceId is ID => Boolean(invoiceId)))].sort();
		if (named.length === 0) {
			return await write(this);
		}
		return await inLinesTransaction(this, this.ownRepositories(), async (service, transaction) => {
			const tenantId = RequestContext.currentTenantId();
			// In one order whatever the request, so two writes to the same two invoices never wait on each other
			for (const invoiceId of named) {
				await lockInvoice(transaction, invoiceId, tenantId);
			}
			const result = await write(service);
			for (const invoiceId of named) {
				await touchInvoice(transaction, invoiceId);
			}
			return result;
		});
	}

	/** The invoice a line belongs to, withdrawn or not, in the caller's tenant; null for a line it does not hold. */
	private async invoiceIdOfLine(id: ID): Promise<ID | null> {
		const tenantId = RequestContext.currentTenantId();
		const where = tenantId ? { id, tenantId } : { id };
		const line = await this.typeOrmRepository.manager.findOne(InvoiceItem, {
			where,
			select: { id: true, invoiceId: true },
			withDeleted: true
		});
		return line?.invoiceId ?? null;
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
			(service, transaction) =>
				replaceLinesMovingInvoice(service, transaction, invoiceId, requested, lines, named),
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

/**
 * Replaces an invoice's lines (see `replaceLinesKeepingTime`) and moves the invoice's `updatedAt`, in the transaction
 * given: whoever replaces them, a precondition stated on the invoice later sees that its lines changed.
 */
async function replaceLinesMovingInvoice(
	service: TenantAwareCrudService<InvoiceItem>,
	transaction: ILinesTransaction,
	invoiceId: ID,
	requested: IInvoiceItemCreateInput[],
	lines: IInvoiceItemCreateInput[],
	named: ID[]
): Promise<InvoiceItem[]> {
	const saved = await replaceLinesKeepingTime(service, transaction, invoiceId, requested, lines, named);
	await touchInvoice(transaction, invoiceId);
	return saved;
}

/** The invoice a line's payload names: its `invoiceId`, or the id of its `invoice`. */
function invoiceIdStatedBy(payload: unknown): ID | null {
	const line = (payload ?? {}) as { invoiceId?: unknown; invoice?: { id?: unknown } | null };
	const stated = line.invoiceId ?? line.invoice?.id;
	return typeof stated === 'string' && stated ? stated : null;
}
