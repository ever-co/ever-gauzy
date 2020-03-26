import { CrudService } from '../core';
import { InvoiceItem } from './invoice-item.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';

@Injectable()
export class InvoiceItemService extends CrudService<InvoiceItem> {
	constructor(
		@InjectRepository(InvoiceItem)
		private readonly invoiceItemRepository: Repository<InvoiceItem>
	) {
		super(invoiceItemRepository);
	}
}
