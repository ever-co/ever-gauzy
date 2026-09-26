import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '@gauzy/core';
import { CommerceCartLine } from './commerce-cart-line.entity';
import { TypeOrmCommerceCartLineRepository } from './repository/type-orm-commerce-cart-line.repository';
import { MikroOrmCommerceCartLineRepository } from './repository/mikro-orm-commerce-cart-line.repository';

/**
 * The lines of a cart.
 *
 * A line is never priced here — the price arrives already resolved — and a line is never totalled
 * here: the cart's totals are computed from the lines by `CartTotalsCalculator`. This service owns the
 * line's own lifecycle and nothing else.
 */
@Injectable()
export class CommerceCartLineService extends TenantAwareCrudService<CommerceCartLine> {
	constructor(
		readonly typeOrmCommerceCartLineRepository: TypeOrmCommerceCartLineRepository,
		readonly mikroOrmCommerceCartLineRepository: MikroOrmCommerceCartLineRepository
	) {
		super(typeOrmCommerceCartLineRepository, mikroOrmCommerceCartLineRepository);
	}
}
