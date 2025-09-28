import { Repository } from 'typeorm';
import { InvoiceAmount } from '../invoice-amount.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TypeOrmInvoiceAmountRepository extends Repository<InvoiceAmount> {
	constructor(@InjectRepository(InvoiceAmount) readonly repository: Repository<InvoiceAmount>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
