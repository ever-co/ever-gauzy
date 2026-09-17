import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { SellerSettlement } from '../seller-settlement.entity';

/**
 * The MikroORM side of the SellerSettlement aggregate.
 */
@Injectable()
export class MikroOrmSellerSettlementRepository extends MikroOrmBaseEntityRepository<SellerSettlement> {}