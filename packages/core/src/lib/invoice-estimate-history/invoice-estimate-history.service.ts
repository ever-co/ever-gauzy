import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { InvoiceEstimateHistory } from './invoice-estimate-history.entity';
import { TypeOrmInvoiceEstimateHistoryRepository } from './repository/type-orm-invoice-estimate-history.repository';
import { MikroOrmInvoiceEstimateHistoryRepository } from './repository/mikro-orm-invoice-estimate-history.repository';

@Injectable()
export class InvoiceEstimateHistoryService extends TenantAwareCrudService<InvoiceEstimateHistory> {
	constructor(
		@InjectRepository(InvoiceEstimateHistory)
		typeOrmInvoiceEstimateHistoryRepository: TypeOrmInvoiceEstimateHistoryRepository,

		mikroOrmInvoiceEstimateHistoryRepository: MikroOrmInvoiceEstimateHistoryRepository
	) {
		super(typeOrmInvoiceEstimateHistoryRepository, mikroOrmInvoiceEstimateHistoryRepository);
	}
}
