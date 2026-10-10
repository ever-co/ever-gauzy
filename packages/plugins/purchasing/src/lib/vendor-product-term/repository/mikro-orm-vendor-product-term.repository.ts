import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { VendorProductTerm } from '../vendor-product-term.entity';

@Injectable()
export class MikroOrmVendorProductTermRepository extends MikroOrmBaseEntityRepository<VendorProductTerm> {}
