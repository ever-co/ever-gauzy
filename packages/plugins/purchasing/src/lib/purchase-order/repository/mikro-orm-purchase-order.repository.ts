import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { PurchaseOrder } from '../purchase-order.entity';

@Injectable()
export class MikroOrmPurchaseOrderRepository extends MikroOrmBaseEntityRepository<PurchaseOrder> {}
