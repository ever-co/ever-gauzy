import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { OrderClaim } from '../order-claim.entity';

@Injectable()
export class MikroOrmOrderClaimRepository extends MikroOrmBaseEntityRepository<OrderClaim> {}
