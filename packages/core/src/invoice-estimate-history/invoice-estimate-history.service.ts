import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { TenantAwareCrudService } from './../core/crud';
import { InvoiceEstimateHistory } from './invoice-estimate-history.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';

@Injectable()
export class InvoiceEstimateHistoryService extends TenantAwareCrudService<InvoiceEstimateHistory> {
	constructor(
		@InjectRepository(InvoiceEstimateHistory)
		invoiceEstimateHistoryRepository: Repository<InvoiceEstimateHistory>,
		@MikroInjectRepository(InvoiceEstimateHistory)
		mikroInvoiceEstimateHistoryRepository: EntityRepository<InvoiceEstimateHistory>
	) {
		super(invoiceEstimateHistoryRepository, mikroInvoiceEstimateHistoryRepository);
	}
}
