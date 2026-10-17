import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseOrderLine } from '../purchase-order-line.entity';

@Injectable()
export class TypeOrmPurchaseOrderLineRepository extends Repository<PurchaseOrderLine> {
	constructor(@InjectRepository(PurchaseOrderLine) readonly repository: Repository<PurchaseOrderLine>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
