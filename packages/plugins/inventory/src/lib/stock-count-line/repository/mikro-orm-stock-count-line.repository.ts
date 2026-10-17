/**
 * MikroORM repository for StockCountLine.
 */
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { StockCountLine } from '../stock-count-line.entity';

export class MikroOrmStockCountLineRepository extends MikroOrmBaseEntityRepository<StockCountLine> {}
