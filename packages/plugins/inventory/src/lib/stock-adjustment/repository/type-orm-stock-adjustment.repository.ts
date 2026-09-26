/**
 * TypeORM repository for StockAdjustment.
 *
 * It is a plain repository: the service composes the queries it needs, and nothing here adds
 * behaviour that a caller could bypass.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockAdjustment } from '../stock-adjustment.entity';

@Injectable()
export class TypeOrmStockAdjustmentRepository extends Repository<StockAdjustment> {
	constructor(@InjectRepository(StockAdjustment) readonly repository: Repository<StockAdjustment>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
