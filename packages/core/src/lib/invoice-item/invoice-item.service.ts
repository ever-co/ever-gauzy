import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
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
	inLinesTransaction,
	saveBillingTime,
	splitBilledTime
} from './invoice-item-billed-time';
import { replaceLinesKeepingTime } from './invoice-item-kept-time';
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
	async createBulk(invoiceId: ID, input: IInvoiceItemCreateInput[]): Promise<IInvoiceItem[]> {
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
