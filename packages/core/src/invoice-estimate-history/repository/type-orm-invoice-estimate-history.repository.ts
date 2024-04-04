import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceEstimateHistory } from '../invoice-estimate-history.entity';

@Injectable()
export class TypeOrmInvoiceEstimateHistoryRepository extends Repository<InvoiceEstimateHistory> {
    constructor(@InjectRepository(InvoiceEstimateHistory) readonly repository: Repository<InvoiceEstimateHistory>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
