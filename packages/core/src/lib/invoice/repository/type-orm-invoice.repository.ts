import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../invoice.entity';

@Injectable()
export class TypeOrmInvoiceRepository extends Repository<Invoice> {
    constructor(@InjectRepository(Invoice) readonly repository: Repository<Invoice>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
