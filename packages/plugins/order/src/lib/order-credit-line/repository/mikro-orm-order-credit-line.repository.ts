import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { OrderCreditLine } from '../order-credit-line.entity';

@Injectable()
export class MikroOrmOrderCreditLineRepository extends MikroOrmBaseEntityRepository<OrderCreditLine> {}