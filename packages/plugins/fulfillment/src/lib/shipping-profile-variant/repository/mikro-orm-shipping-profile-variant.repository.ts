import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { ShippingProfileVariant } from '../shipping-profile-variant.entity';

@Injectable()
export class MikroOrmShippingProfileVariantRepository extends MikroOrmBaseEntityRepository<ShippingProfileVariant> {}