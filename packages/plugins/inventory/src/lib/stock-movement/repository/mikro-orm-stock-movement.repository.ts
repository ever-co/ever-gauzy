/**
 * MikroORM repository for StockMovement.
 */
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { StockMovement } from '../stock-movement.entity';

export class MikroOrmStockMovementRepository extends MikroOrmBaseEntityRepository<StockMovement> {}
