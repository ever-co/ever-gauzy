/**
 * MikroORM repository for StockAlert.
 */
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { StockAlert } from '../stock-alert.entity';

export class MikroOrmStockAlertRepository extends MikroOrmBaseEntityRepository<StockAlert> {}
