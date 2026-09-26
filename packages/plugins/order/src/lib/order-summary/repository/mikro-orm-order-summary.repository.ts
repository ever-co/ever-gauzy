import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { OrderSummary } from '../order-summary.entity';

@Injectable()
export class MikroOrmOrderSummaryRepository extends MikroOrmBaseEntityRepository<OrderSummary> {}