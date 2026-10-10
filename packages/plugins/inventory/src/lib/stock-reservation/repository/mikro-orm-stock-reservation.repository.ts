/**
 * MikroORM repository for StockReservation.
 */
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { StockReservation } from '../stock-reservation.entity';

export class MikroOrmStockReservationRepository extends MikroOrmBaseEntityRepository<StockReservation> {}
