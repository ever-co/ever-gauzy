/**
 * MikroORM repository for StockTransferLine.
 */
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { StockTransferLine } from '../stock-transfer-line.entity';

export class MikroOrmStockTransferLineRepository extends MikroOrmBaseEntityRepository<StockTransferLine> {}
