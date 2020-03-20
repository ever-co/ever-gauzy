import { CrudService } from '../core';
import { Invoice } from './invoices.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';

@Injectable()
export class InvoicesService extends CrudService<Invoice> {
	constructor(
		@InjectRepository(Invoice)
		private readonly invoicesRepository: Repository<Invoice>
	) {
		super(invoicesRepository);
	}
}
