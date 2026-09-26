import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { OrderHistory } from '../order-history.entity';

@Injectable()
export class MikroOrmOrderHistoryRepository extends MikroOrmBaseEntityRepository<OrderHistory> {}