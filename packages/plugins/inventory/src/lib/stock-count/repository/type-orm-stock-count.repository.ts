/**
 * TypeORM repository for StockCount.
 *
 * It is a plain repository: the service composes the queries it needs, and nothing here adds
 * behaviour that a caller could bypass.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockCount } from '../stock-count.entity';

@Injectable()
export class TypeOrmStockCountRepository extends Repository<StockCount> {
	constructor(@InjectRepository(StockCount) readonly repository: Repository<StockCount>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
