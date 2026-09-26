import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { OrderLine } from '../order-line.entity';

@Injectable()
export class MikroOrmOrderLineRepository extends MikroOrmBaseEntityRepository<OrderLine> {}