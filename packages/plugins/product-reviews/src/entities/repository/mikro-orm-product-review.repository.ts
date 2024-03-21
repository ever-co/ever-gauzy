import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { ProductReview } from '../product-review.entity';

export class MikroOrmProductReviewRepository extends MikroOrmBaseEntityRepository<ProductReview> { }
