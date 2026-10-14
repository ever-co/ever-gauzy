import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '@gauzy/core';
import { CommerceCartPromotion } from './commerce-cart-promotion.entity';
import { TypeOrmCommerceCartPromotionRepository } from './repository/type-orm-commerce-cart-promotion.repository';
import { MikroOrmCommerceCartPromotionRepository } from './repository/mikro-orm-commerce-cart-promotion.repository';

/**
 * The promotions applied to a cart, as snapshots.
 *
 * The discount an applied promotion produced is computed by the promotion engine and recorded on the
 * snapshot row. This service keeps the snapshot set consistent with the cart: the cart's recalculation
 * rebuilds it rather than appending to it, so a promotion that has stopped matching cannot leave a
 * stale discount behind.
 */
@Injectable()
export class CommerceCartPromotionService extends TenantAwareCrudService<CommerceCartPromotion> {
	constructor(
		readonly typeOrmCommerceCartPromotionRepository: TypeOrmCommerceCartPromotionRepository,
		readonly mikroOrmCommerceCartPromotionRepository: MikroOrmCommerceCartPromotionRepository
	) {
		super(typeOrmCommerceCartPromotionRepository, mikroOrmCommerceCartPromotionRepository);
	}
}
