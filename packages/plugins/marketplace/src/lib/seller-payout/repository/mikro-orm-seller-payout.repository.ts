import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { SellerPayout } from '../seller-payout.entity';

/**
 * The MikroORM side of the SellerPayout aggregate.
 */
@Injectable()
export class MikroOrmSellerPayoutRepository extends MikroOrmBaseEntityRepository<SellerPayout> {}