import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { CommerceCartPromotion } from '../commerce-cart-promotion.entity';

@Injectable()
export class MikroOrmCommerceCartPromotionRepository extends MikroOrmBaseEntityRepository<CommerceCartPromotion> {}
