import { CrudService } from '../core';
import { InvoiceItem } from './invoice-item.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { IInvoiceItemCreateInput } from '@gauzy/models';

@Injectable()
export class InvoiceItemService extends CrudService<InvoiceItem> {
	constructor(
		@InjectRepository(InvoiceItem)
		private readonly invoiceItemRepository: Repository<InvoiceItem>
	) {
		super(invoiceItemRepository);
	}

	async createBulk(id: string, createInput: IInvoiceItemCreateInput[]) {
		await this.repository.delete({ invoiceId: id });
		return await this.repository.save(createInput);
	}
}
