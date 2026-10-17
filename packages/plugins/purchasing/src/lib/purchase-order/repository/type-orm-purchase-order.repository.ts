import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseOrder } from '../purchase-order.entity';

@Injectable()
export class TypeOrmPurchaseOrderRepository extends Repository<PurchaseOrder> {
	constructor(@InjectRepository(PurchaseOrder) readonly repository: Repository<PurchaseOrder>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
