import { Injectable } from '@nestjs/common';
import { IInvoiceItemCreateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { InvoiceItem } from './invoice-item.entity';
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
