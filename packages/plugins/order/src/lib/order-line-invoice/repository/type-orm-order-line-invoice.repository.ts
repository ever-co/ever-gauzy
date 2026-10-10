import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderLineInvoice } from '../order-line-invoice.entity';

@Injectable()
export class TypeOrmOrderLineInvoiceRepository extends Repository<OrderLineInvoice> {
	constructor(@InjectRepository(OrderLineInvoice) readonly repository: Repository<OrderLineInvoice>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
