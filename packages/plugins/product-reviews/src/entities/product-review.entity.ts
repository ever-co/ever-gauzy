/* eslint-disable @typescript-eslint/no-unused-vars */
import { PrimaryGeneratedColumn } from 'typeorm';
import { MultiORMEntity, MultiORMColumn } from '@gauzy/core';
import { MikroOrmProductReviewRepository } from './repository/mikro-orm-product-review.repository';

@MultiORMEntity('product_review', { mikroOrmRepository: () => MikroOrmProductReviewRepository })
export class ProductReview {
	@PrimaryGeneratedColumn('uuid')
	id?: string;

	@MultiORMColumn('text')
	body: string;

	@MultiORMColumn()
	rating: number;
}
