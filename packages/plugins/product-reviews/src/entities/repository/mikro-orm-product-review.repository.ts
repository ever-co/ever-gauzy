import { EntityRepository } from '@mikro-orm/core';
import { ProductReview } from '../product-review.entity';

export class MikroOrmProductReviewRepository extends EntityRepository<ProductReview> { }
