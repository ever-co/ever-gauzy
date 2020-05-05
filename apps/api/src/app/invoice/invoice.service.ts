import { CrudService, IPagination } from '../core';
import { Invoice } from './invoice.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { Injectable, BadRequestException } from '@nestjs/common';
import { Invoice as IInvoice } from '@gauzy/models';

@Injectable()
export class InvoiceService extends CrudService<Invoice> {
	constructor(
		@InjectRepository(Invoice)
		private readonly invoiceRepository: Repository<Invoice>
	) {
		super(invoiceRepository);
	}

	async getAllInvoices(
		filter?: FindManyOptions<Invoice>
	): Promise<IPagination<IInvoice>> {
		const total = await this.repository.count(filter);
		const items = await this.repository.find(filter);

		return { items, total };
	}

	async update(id: string, entity: IInvoice): Promise<Invoice> {
		try {
			await this.invoiceRepository.delete(id);
			const invoice = new Invoice();

			invoice.id = id;
			invoice.invoiceNumber = entity.invoiceNumber;
			invoice.invoiceDate = entity.invoiceDate;
			invoice.dueDate = entity.dueDate;
			invoice.currency = entity.currency;
			invoice.discountValue = entity.discountValue;
			invoice.discountType = entity.discountType;
			invoice.tax = entity.tax;
			invoice.taxType = entity.taxType;
			invoice.terms = entity.terms;
			invoice.totalValue = entity.totalValue;
			invoice.paid = entity.paid;
			invoice.clientId = entity.clientId;
			invoice.organizationId = entity.organizationId;
			invoice.invoiceType = entity.invoiceType;
			invoice.sentTo = entity.sentTo;

			return this.invoiceRepository.save(invoice);
		} catch (err /*: WriteError*/) {
			throw new BadRequestException(err);
		}
	}
}
