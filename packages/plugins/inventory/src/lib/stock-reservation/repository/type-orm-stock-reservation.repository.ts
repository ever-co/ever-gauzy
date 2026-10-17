/**
 * TypeORM repository for StockReservation.
 *
 * It is a plain repository: the service composes the queries it needs, and nothing here adds
 * behaviour that a caller could bypass.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockReservation } from '../stock-reservation.entity';

@Injectable()
export class TypeOrmStockReservationRepository extends Repository<StockReservation> {
	constructor(@InjectRepository(StockReservation) readonly repository: Repository<StockReservation>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
