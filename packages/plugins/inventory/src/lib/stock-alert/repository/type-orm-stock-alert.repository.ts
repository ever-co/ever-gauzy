/**
 * TypeORM repository for StockAlert.
 *
 * It is a plain repository: the service composes the queries it needs, and nothing here adds
 * behaviour that a caller could bypass.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockAlert } from '../stock-alert.entity';

@Injectable()
export class TypeOrmStockAlertRepository extends Repository<StockAlert> {
	constructor(@InjectRepository(StockAlert) readonly repository: Repository<StockAlert>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
