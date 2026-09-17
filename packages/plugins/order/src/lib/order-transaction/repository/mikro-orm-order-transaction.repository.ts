import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { OrderTransaction } from '../order-transaction.entity';

@Injectable()
export class MikroOrmOrderTransactionRepository extends MikroOrmBaseEntityRepository<OrderTransaction> {}