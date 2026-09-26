import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { PurchaseOrderLine } from '../purchase-order-line.entity';

@Injectable()
export class MikroOrmPurchaseOrderLineRepository extends MikroOrmBaseEntityRepository<PurchaseOrderLine> {}
