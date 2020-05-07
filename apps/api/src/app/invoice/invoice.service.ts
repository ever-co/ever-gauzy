import { CrudService, IPagination } from '../core';
import { Invoice } from './invoice.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, UpdateResult } from 'typeorm';
import { Injectable, BadRequestException } from '@nestjs/common';
import { Invoice as IInvoice } from '@gauzy/models';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

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

	async update(
		id: string,
		entity: IInvoice
	): Promise<UpdateResult | Invoice> {
		try {
			return await this.repository.update(id, entity);
		} catch (err /*: WriteError*/) {
			throw new BadRequestException(err);
		}
	}
}
