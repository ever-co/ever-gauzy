import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoodsReceipt } from '../goods-receipt.entity';

@Injectable()
export class TypeOrmGoodsReceiptRepository extends Repository<GoodsReceipt> {
	constructor(@InjectRepository(GoodsReceipt) readonly repository: Repository<GoodsReceipt>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
