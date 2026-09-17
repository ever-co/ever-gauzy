import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { OrderExchangeLine } from '../order-exchange-line.entity';

@Injectable()
export class MikroOrmOrderExchangeLineRepository extends MikroOrmBaseEntityRepository<OrderExchangeLine> {}
