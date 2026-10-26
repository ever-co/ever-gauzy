/**
 * TypeORM repository for StockMovement.
 *
 * It is a plain repository: the service composes the queries it needs, and nothing here adds
 * behaviour that a caller could bypass.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockMovement } from '../stock-movement.entity';

@Injectable()
export class TypeOrmStockMovementRepository extends Repository<StockMovement> {
	constructor(@InjectRepository(StockMovement) readonly repository: Repository<StockMovement>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
