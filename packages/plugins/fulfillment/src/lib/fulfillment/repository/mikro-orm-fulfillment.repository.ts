import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { Fulfillment } from '../fulfillment.entity';

@Injectable()
export class MikroOrmFulfillmentRepository extends MikroOrmBaseEntityRepository<Fulfillment> {}