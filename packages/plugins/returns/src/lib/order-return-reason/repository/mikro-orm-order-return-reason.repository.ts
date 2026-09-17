import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { OrderReturnReason } from '../order-return-reason.entity';

@Injectable()
export class MikroOrmOrderReturnReasonRepository extends MikroOrmBaseEntityRepository<OrderReturnReason> {}
