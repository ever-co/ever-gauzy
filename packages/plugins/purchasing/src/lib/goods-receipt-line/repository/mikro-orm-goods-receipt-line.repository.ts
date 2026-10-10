import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { GoodsReceiptLine } from '../goods-receipt-line.entity';

@Injectable()
export class MikroOrmGoodsReceiptLineRepository extends MikroOrmBaseEntityRepository<GoodsReceiptLine> {}
