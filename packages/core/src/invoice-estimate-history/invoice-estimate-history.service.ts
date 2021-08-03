import { TenantAwareCrudService } from './../core/crud';
import { InvoiceEstimateHistory } from './invoice-estimate-history.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';

@Injectable()
export class InvoiceEstimateHistoryService extends TenantAwareCrudService<InvoiceEstimateHistory> {
	constructor(
		@InjectRepository(InvoiceEstimateHistory)
		private readonly invoiceEstimateHistoryRepository: Repository<InvoiceEstimateHistory>
	) {
		super(invoiceEstimateHistoryRepository);
	}
}
