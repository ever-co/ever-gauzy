import { MultiORMEntity, MultiORMColumn, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmProductReviewRepository } from './repository/mikro-orm-product-review.repository';

@MultiORMEntity('product_review', { mikroOrmRepository: () => MikroOrmProductReviewRepository })
export class ProductReview extends TenantOrganizationBaseEntity {
	@MultiORMColumn('text')
	body: string;

	@MultiORMColumn()
	rating: number;
}
