import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { ID, IInvoiceItem, IInvoiceItemCreateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { InvoiceItem } from './invoice-item.entity';
import { IBillingLine, saveBillingTime, splitBilledTime } from './invoice-item-billed-time';
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
	 * to save the provided invoice items in the database. Items that name the time logs they bill
	 * are replaced with that time in one transaction (`replaceLinesBillingTime`).
	 */
	async createBulk(invoiceId: ID, input: IInvoiceItemCreateInput[]): Promise<IInvoiceItem[]> {
		const { lines, billing } = splitBilledTime(input);
		if (billing.length > 0) {
			return await this.replaceLinesBillingTime(invoiceId, lines, billing);
		}

		try {
			// Remove existing invoice items for the given invoice
			await this.delete({ invoiceId } as any);

			// Insert new invoice items
			return await this.saveMany(lines);
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
	 * keeps the old lines, and their time, in place.
	 *
	 * @param invoiceId The invoice whose lines are replaced.
	 * @param lines The new lines, as they are written.
	 * @param billing The new lines that bill time.
	 * @returns The new lines.
	 */
	private async replaceLinesBillingTime(
		invoiceId: ID,
		lines: IInvoiceItemCreateInput[],
		billing: IBillingLine[]
	): Promise<IInvoiceItem[]> {
		return await saveBillingTime(
			this,
			{ typeOrm: this.typeOrmRepository, mikroOrm: this.mikroOrmRepository },
			async (service) => {
				await service.delete({ invoiceId } as FindOptionsWhere<InvoiceItem>);
				return await service.saveMany(lines);
			},
			(saved) => saved,
			billing
		);
	}
}
