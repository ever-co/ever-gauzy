import { Repository } from 'typeorm';
import { ProductReview } from '../product-review.entity';

export class TypeOrmProductReviewRepository extends Repository<ProductReview> { }
