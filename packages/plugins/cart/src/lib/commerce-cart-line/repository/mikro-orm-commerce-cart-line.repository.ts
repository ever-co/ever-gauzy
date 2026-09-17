import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { CommerceCartLine } from '../commerce-cart-line.entity';

@Injectable()
export class MikroOrmCommerceCartLineRepository extends MikroOrmBaseEntityRepository<CommerceCartLine> {}
