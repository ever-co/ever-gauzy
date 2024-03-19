import { EntityRepository } from '@mikro-orm/knex';
import { ProductReview } from '../product-review.entity';

export class MikroOrmProductReviewRepository extends EntityRepository<ProductReview> { }
