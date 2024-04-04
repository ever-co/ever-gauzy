import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductReview } from '../product-review.entity';

@Injectable()
export class TypeOrmProductReviewRepository extends Repository<ProductReview> {
	constructor(@InjectRepository(ProductReview) readonly repository: Repository<ProductReview>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
