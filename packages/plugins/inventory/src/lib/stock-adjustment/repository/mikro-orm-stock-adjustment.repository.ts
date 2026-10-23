/**
 * MikroORM repository for StockAdjustment.
 */
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { StockAdjustment } from '../stock-adjustment.entity';

export class MikroOrmStockAdjustmentRepository extends MikroOrmBaseEntityRepository<StockAdjustment> {}
