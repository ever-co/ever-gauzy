import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { TenantAwareCrudService } from './../core/crud';
import { InvoiceItem } from './invoice-item.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { IInvoiceItemCreateInput } from '@gauzy/contracts';

@Injectable()
export class InvoiceItemService extends TenantAwareCrudService<InvoiceItem> {
	constructor(
		@InjectRepository(InvoiceItem)
		invoiceItemRepository: Repository<InvoiceItem>,
		@MikroInjectRepository(InvoiceItem)
		mikroInvoiceItemRepository: EntityRepository<InvoiceItem>
	) {
		super(invoiceItemRepository, mikroInvoiceItemRepository);
	}

	async createBulk(invoiceId: string, createInput: IInvoiceItemCreateInput[]) {
		await this.repository.delete({ invoiceId: invoiceId });
		return await this.repository.save(createInput);
	}
}
