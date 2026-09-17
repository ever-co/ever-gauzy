import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { ShippingOption } from '../shipping-option.entity';

@Injectable()
export class MikroOrmShippingOptionRepository extends MikroOrmBaseEntityRepository<ShippingOption> {}