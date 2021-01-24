import { CrudService } from '../core';
import { InvoiceEstimateHistory } from './invoice-estimate-history.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';

@Injectable()
export class InvoiceEstimateHistoryService extends CrudService<InvoiceEstimateHistory> {
	constructor(
		@InjectRepository(InvoiceEstimateHistory)
		private readonly invoiceEstimateHistoryRepository: Repository<InvoiceEstimateHistory>
	) {
		super(invoiceEstimateHistoryRepository);
	}
}
