import {
	Entity,
	Column,
	OneToMany,
	RelationId,
	ManyToOne,
	JoinColumn
} from 'typeorm';
import { TranslatableBase } from '../core/entities/translate-base';
import { ProductCategoryTranslation } from './product-category-translation.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { Product } from '../product/product.entity';
import { Organization } from '../organization/organization.entity';
import { ProductCategoryTranslatable } from '@gauzy/models';

@Entity('product_category')
export class ProductCategory extends TranslatableBase
	implements ProductCategoryTranslatable {
	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@Column({ nullable: true })
	imageUrl: string;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId(
		(productCategory: ProductCategory) => productCategory.organization
	)
	readonly organizationId: string;

	@OneToMany((type) => Product, (product) => product.category)
	products: Product[];

	@ApiProperty({ type: Organization })
	@ManyToOne((type) => Organization, { onDelete: 'CASCADE' })
	@JoinColumn()
	organization: Organization;

	@ApiProperty({ type: ProductCategoryTranslation, isArray: true })
	@OneToMany(
		(type) => ProductCategoryTranslation,
		(productCategoryTranslation) => productCategoryTranslation.reference,
		{
			eager: true,
			cascade: true
		}
	)
	translations: ProductCategoryTranslation[];
}
