import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceItem } from '../invoice-item.entity';

@Injectable()
export class TypeOrmInvoiceItemRepository extends Repository<InvoiceItem> {
    constructor(@InjectRepository(InvoiceItem) readonly repository: Repository<InvoiceItem>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
