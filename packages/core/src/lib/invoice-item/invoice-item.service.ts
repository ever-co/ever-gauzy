import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { IInvoice, IInvoiceItemCreateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { InvoiceItem } from './invoice-item.entity';
import { MikroOrmInvoiceItemRepository } from './repository/mikro-orm-invoice-item.repository';
import { TypeOrmInvoiceItemRepository } from './repository/type-orm-invoice-item.repository';

@Injectable()
export class InvoiceItemService extends TenantAwareCrudService<InvoiceItem> {
	constructor(
		@InjectRepository(InvoiceItem)
		typeOrmInvoiceItemRepository: TypeOrmInvoiceItemRepository,

		mikroOrmInvoiceItemRepository: MikroOrmInvoiceItemRepository
	) {
		super(typeOrmInvoiceItemRepository, mikroOrmInvoiceItemRepository);
	}

	/**
	 * If the invoice is created by a user, force the employeeId for the invoice item
	 *
	 * @param invoice
	 * @param input
	 * @returns
	 */
	checkForEmployee(invoice: IInvoice, input: IInvoiceItemCreateInput[]) {
		if (!invoice.fromUserId || !invoice.employeeId) return;
		for (const item of input) {
			item.employeeId = invoice.employeeId;
		}
	}

	/**
	 *
	 * @param invoiceId
	 * @param createInput
	 * @returns
	 */
	async createBulk(invoiceId: string, createInput: IInvoiceItemCreateInput[]) {
		await this.typeOrmRepository.delete({ invoiceId: invoiceId });
		return await this.typeOrmRepository.save(createInput);
	}
}
