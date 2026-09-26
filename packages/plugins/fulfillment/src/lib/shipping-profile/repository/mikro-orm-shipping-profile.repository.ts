import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { ShippingProfile } from '../shipping-profile.entity';

@Injectable()
export class MikroOrmShippingProfileRepository extends MikroOrmBaseEntityRepository<ShippingProfile> {}