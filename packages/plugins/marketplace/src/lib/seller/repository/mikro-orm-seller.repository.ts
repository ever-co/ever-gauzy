import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { Seller } from '../seller.entity';

/**
 * The MikroORM side of the Seller aggregate.
 */
@Injectable()
export class MikroOrmSellerRepository extends MikroOrmBaseEntityRepository<Seller> {}