/* eslint-disable @typescript-eslint/no-unused-vars */
import { Column, PrimaryGeneratedColumn } from 'typeorm';
import { MultiORMEntity } from '@gauzy/core';
import { MikroOrmProductReviewRepository } from './repository/mikro-orm-product-review.repository';

@MultiORMEntity('product_review', { mikroOrmRepository: () => MikroOrmProductReviewRepository })
export class ProductReview {
	@PrimaryGeneratedColumn('uuid')
	id?: string;

	@Column('text')
	body: string;

	@Column()
	rating: number;
}
