import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoodsReceiptLine } from '../goods-receipt-line.entity';

@Injectable()
export class TypeOrmGoodsReceiptLineRepository extends Repository<GoodsReceiptLine> {
	constructor(@InjectRepository(GoodsReceiptLine) readonly repository: Repository<GoodsReceiptLine>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
