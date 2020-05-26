import { CrudService } from '../core';
import { Invoice } from './invoice.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { getConnection } from 'typeorm';
import { LanguagesEnum } from '@gauzy/models';
import { EmailService } from '../email';

@Injectable()
export class InvoiceService extends CrudService<Invoice> {
	constructor(
		@InjectRepository(Invoice)
		private readonly invoiceRepository: Repository<Invoice>
	) {
		super(invoiceRepository);
	}

	async getHighestInvoiceNumber() {
		const invoice = await getConnection()
			.createQueryBuilder(Invoice, 'invoice')
			.select('MAX(invoice.invoiceNumber)', 'max')
			.getRawOne();

		return invoice;
	}
}
