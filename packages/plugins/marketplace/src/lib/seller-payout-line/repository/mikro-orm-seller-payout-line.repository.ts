import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { SellerPayoutLine } from '../seller-payout-line.entity';

/**
 * The MikroORM side of the SellerPayoutLine aggregate.
 */
@Injectable()
export class MikroOrmSellerPayoutLineRepository extends MikroOrmBaseEntityRepository<SellerPayoutLine> {}