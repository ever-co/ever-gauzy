/**
 * TypeORM repository for StockTransferLine.
 *
 * It is a plain repository: the service composes the queries it needs, and nothing here adds
 * behaviour that a caller could bypass.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockTransferLine } from '../stock-transfer-line.entity';

@Injectable()
export class TypeOrmStockTransferLineRepository extends Repository<StockTransferLine> {
	constructor(@InjectRepository(StockTransferLine) readonly repository: Repository<StockTransferLine>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
