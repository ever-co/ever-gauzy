/**
 * TypeORM repository for StockCountLine.
 *
 * It is a plain repository: the service composes the queries it needs, and nothing here adds
 * behaviour that a caller could bypass.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockCountLine } from '../stock-count-line.entity';

@Injectable()
export class TypeOrmStockCountLineRepository extends Repository<StockCountLine> {
	constructor(@InjectRepository(StockCountLine) readonly repository: Repository<StockCountLine>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
