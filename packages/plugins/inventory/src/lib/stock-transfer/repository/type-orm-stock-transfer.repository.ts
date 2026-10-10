/**
 * TypeORM repository for StockTransfer.
 *
 * It is a plain repository: the service composes the queries it needs, and nothing here adds
 * behaviour that a caller could bypass.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockTransfer } from '../stock-transfer.entity';

@Injectable()
export class TypeOrmStockTransferRepository extends Repository<StockTransfer> {
	constructor(@InjectRepository(StockTransfer) readonly repository: Repository<StockTransfer>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
