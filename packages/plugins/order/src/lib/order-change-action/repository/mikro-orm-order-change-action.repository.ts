import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { OrderChangeAction } from '../order-change-action.entity';

@Injectable()
export class MikroOrmOrderChangeActionRepository extends MikroOrmBaseEntityRepository<OrderChangeAction> {}