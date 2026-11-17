import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { FilterQuery, LockMode } from '@mikro-orm/core';
import { DeleteResult, FindOptionsWhere, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ID, IInvoiceItem, IInvoiceItemCreateInput } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
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
	locksRows,
	saveBillingTime,
	splitBilledTime,
	typeOrmRowLock
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
	 * {@link writeLinesOf}). A body that names a stored line by its `id` saves over that line, which may move it from its
	 * invoice to the one the body names: the invoice it belongs to is locked and moved too, as for an update.
	 */
	async createLine(entity: IPartialEntity<InvoiceItem>): Promise<InvoiceItem> {
		const namedLineId = (entity as { id?: unknown }).id;
		const lineId = typeof namedLineId === 'string' && namedLineId ? namedLineId : null;
		return await this.writeLinesOf(lineId, invoicesStatedBy(entity), (service) => service.create(entity));
	}

	/**
	 * Changes one line (`PUT /invoice-item/:id`, GraphQL `updateInvoiceItem`), moving the `updatedAt` of the invoice it
	 * belongs to, and of the one it is moved to, if any (see {@link writeLinesOf}).
	 */
	async updateLine(id: ID, patch: QueryDeepPartialEntity<InvoiceItem>): Promise<UpdateResult | InvoiceItem> {
		const movedTo = invoicesStatedBy(patch);
		return await this.writeLinesOf(id, movedTo, (service) => service.update(id, patch));
	}

	/**
	 * Removes one line outright (`DELETE /invoice-item/:id`, GraphQL `deleteInvoiceItem`), moving its invoice's
	 * `updatedAt` (see {@link writeLinesOf}).
	 */
	async deleteLine(id: ID): Promise<DeleteResult> {
		return await this.writeLinesOf(id, [], (service) => service.delete(id));
	}

	/**
	 * Withdraws one line (`DELETE /invoice-item/:id/soft`, GraphQL `softDeleteInvoiceItem`), moving its invoice's
	 * `updatedAt` (see {@link writeLinesOf}).
	 */
	async softRemoveLine(id: ID, options?: IFindOneOptions<InvoiceItem>): Promise<InvoiceItem> {
		return await this.writeLinesOf(id, [], (service) => service.softRemove(id, options));
	}

	/**
	 * Restores one withdrawn line (`PUT /invoice-item/:id/recover`, GraphQL `recoverInvoiceItem`), moving its invoice's
	 * `updatedAt` (see {@link writeLinesOf}).
	 */
	async softRecoverLine(id: ID, options?: IFindOneOptions<InvoiceItem>): Promise<InvoiceItem> {
		return await this.writeLinesOf(id, [], (service) => service.softRecover(id, options));
	}

	/**
	 * Writes lines one at a time, as the line routes do, in a transaction that locks the invoices they belong to first
	 * and moves their `updatedAt` after (#5243): a line is a row of its own, so its write leaves the invoice's row as it
	 * was, and a precondition stated on the invoice later would not see the change. Locking first is also what a
	 * replacement of the lines and a conditional write do, so the three run one after the other on an invoice. A write
	 * that names no invoice of the caller's tenant is made as it always was, and moves nothing.
	 *
	 * The invoice a stored line belongs to is read before the transaction, to know what to lock, and read again once the
	 * locks are held: a line another request moved to another invoice in between would otherwise be written under the
	 * lock of the invoice it left, and the invoice it joined keep its `updatedAt`. The write then starts over with the
	 * invoice the line belongs to now, a few times at most.
	 *
	 * @param lineId The stored line the write changes, when it changes one.
	 * @param statedInvoiceIds The invoices the write names besides: the one a new line is recorded on, or the one an
	 * update moves a line to.
	 * @param write The write, run on this service in the transaction.
	 * @returns What the write answered.
	 * @throws ApiException 409 (`CONCURRENT_MODIFICATION`) when the line kept moving between invoices meanwhile; nothing
	 * is written.
	 */
	private async writeLinesOf<R>(
		lineId: ID | null,
		statedInvoiceIds: Array<ID | null | undefined>,
		write: (service: InvoiceItemService) => Promise<R>
	): Promise<R> {
		for (let attempt = 1; ; attempt += 1) {
			const owner = lineId ? await this.invoiceIdOfLine(lineId) : null;
			const named = [...new Set([owner, ...statedInvoiceIds].filter((id): id is ID => Boolean(id)))].sort();
			// A new line of no invoice is written as it always was; a stored line always runs locked, whatever its
			// invoice, so a request that attaches it to one meanwhile is waited for and seen
			if (named.length === 0 && !lineId) {
				return await write(this);
			}
			try {
				return await inLinesTransaction(this, this.ownRepositories(), async (service, transaction) => {
					const tenantId = RequestContext.currentTenantId();
					// In one order whatever the request, so two writes to the same two invoices never wait on each other
					for (const invoiceId of named) {
						await lockInvoice(transaction, invoiceId, tenantId);
					}
					if (lineId && (await lineOwnerIn(transaction, lineId)) !== owner) {
						throw new LineMovedError();
					}
					const result = await write(service);
					for (const invoiceId of named) {
						await touchInvoice(transaction, invoiceId);
					}
					return result;
				});
			} catch (error) {
				if (!(error instanceof LineMovedError)) {
					throw error;
				}
				if (attempt >= LINE_MOVED_ATTEMPTS) {
					throw new ApiException(HttpStatus.CONFLICT, ApiErrorCode.CONCURRENT_MODIFICATION, LINE_MOVED);
				}
			}
		}
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

/**
 * The invoices a line's payload names: its `invoiceId` and the id of its `invoice`, each when stated. Both are taken:
 * the ORMs do not write the same one (MikroORM writes the relation, `invoiceId` being its mirror), so the invoice the
 * line lands on is among them either way.
 */
function invoicesStatedBy(payload: unknown): ID[] {
	const line = (payload ?? {}) as { invoiceId?: unknown; invoice?: { id?: unknown } | null };
	return [line.invoiceId, line.invoice?.id].filter((id): id is ID => typeof id === 'string' && id.length > 0);
}

/** How many times a write of one line starts over when the line moved to another invoice meanwhile. */
const LINE_MOVED_ATTEMPTS = 3;

/** The refusal of a write of one line that kept moving between invoices while it was written. */
const LINE_MOVED =
	'INVOICE_LINE_MOVED: the line kept moving to another invoice while it was written. Nothing was saved: try again.';

/** Raised inside the transaction when the line no longer belongs to the invoice locked for it: the write starts over. */
class LineMovedError extends Error {
	constructor() {
		super(LINE_MOVED);
		this.name = 'LineMovedError';
	}
}

/**
 * The invoice a line belongs to, withdrawn or not, in the caller's tenant, read in the transaction given after the
 * invoices' locks were taken, and with the line's own row locked until the transaction ends where the database locks
 * rows: a request that moves or attaches the line meanwhile is waited for and seen, and one that comes after waits for
 * this write. Every write of the line updates its row, so they all meet on that lock.
 */
async function lineOwnerIn(transaction: ILinesTransaction, id: ID): Promise<ID | null> {
	const tenantId = RequestContext.currentTenantId();
	const where = tenantId ? { id, tenantId } : { id };
	if (transaction.mikroOrm) {
		// Read apart from the identity map, the withdrawn line included; the invoice through its relation, as MikroORM
		// maps `invoiceId` as a mirror it does not load
		const line = await transaction.mikroOrm.findOne(InvoiceItem, where as FilterQuery<InvoiceItem>, {
			fields: ['id', 'invoice'] as never,
			filters: false,
			disableIdentityMap: true,
			lockMode: locksRows() ? LockMode.PESSIMISTIC_WRITE : undefined
		});
		const stored = line as unknown as { invoiceId?: ID | null; invoice?: { id?: ID } | null } | null;
		return stored?.invoiceId ?? stored?.invoice?.id ?? null;
	}
	const line = await transaction.typeOrm.findOne(InvoiceItem, {
		where,
		select: { id: true, invoiceId: true },
		withDeleted: true,
		...typeOrmRowLock()
	});
	return line?.invoiceId ?? null;
}
