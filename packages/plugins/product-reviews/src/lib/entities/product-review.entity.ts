import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ID, IProduct, IUser } from '@gauzy/contracts';
import {
	MultiORMEntity,
	MultiORMColumn,
	TenantOrganizationBaseEntity,
	Product,
	MultiORMManyToOne,
	ColumnIndex,
	User,
	VirtualMultiOrmColumn
} from '@gauzy/core';
import { IProductReview, ProductReviewStatus, ProductReviewStatusEnum } from '../product-review.types';
import { MikroOrmProductReviewRepository } from './repository/mikro-orm-product-review.repository';

@MultiORMEntity('product_review', { mikroOrmRepository: () => MikroOrmProductReviewRepository })
export class ProductReview extends TenantOrganizationBaseEntity implements IProductReview {
	// Title of the review
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	title: string;

	// Description of the review
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn('text', { nullable: true })
	description: string;

	// Rating of the review
	@ApiProperty({ type: () => Number, minimum: 0, maximum: 10 })
	@IsNotEmpty()
	@IsNumber()
	@Min(0)
	@Max(10)
	@MultiORMColumn()
	rating: number;

	// Upvotes (Positive votes)
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@ColumnIndex()
	@MultiORMColumn({ type: 'int', default: 0 })
	upvotes: number;

	// Downvotes (Negative votes)
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@ColumnIndex()
	@MultiORMColumn({ type: 'int', default: 0 })
	downvotes: number;

	// Status of the review
	@ApiProperty({ type: () => String, enum: ProductReviewStatusEnum })
	@IsEnum(ProductReviewStatusEnum)
	@MultiORMColumn({ type: 'varchar', default: ProductReviewStatusEnum.PENDING })
	status: ProductReviewStatus;

	// Date when the record was edited
	@MultiORMColumn({ type: 'timestamp' })
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	editedAt: Date;

	// Indicates whether the ProductReview has been edited.
	@VirtualMultiOrmColumn()
	isEdited: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * Product that is being reviewed
	 */
	@MultiORMManyToOne(() => Product, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	product?: IProduct;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: ProductReview) => it.product)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	productId?: ID;

	/**
	 * User`s who have reviewed the product
	 */
	@MultiORMManyToOne(() => User, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	user?: IUser;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: ProductReview) => it.user)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	userId?: ID;
}
