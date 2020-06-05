import {
	Entity,
	Column,
	OneToMany,
	ManyToOne,
	JoinColumn,
	RelationId
} from 'typeorm';
import { ProductTypesIconsEnum } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { Product } from '../product/product.entity';
import { Organization } from '../organization/organization.entity';
import { TranslatableBase } from '../core/entities/translate-base';
import { ProductTypeTranslation } from './product-type-translation.entity';
import { ProductOption } from '../product-option/product-option.entity';

@Entity('product_type')
export class ProductType extends TranslatableBase {
	@ApiProperty({ type: String, enum: ProductTypesIconsEnum })
	@IsOptional()
	@IsEnum(ProductTypesIconsEnum)
	@Column({ nullable: true })
	icon: string;

	@OneToMany((type) => Product, (product) => product.type)
	products: Product[];

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((productType: ProductType) => productType.organization)
	readonly organizationId: string;

	@ApiProperty({ type: Organization })
	@ManyToOne((type) => Organization, { onDelete: 'CASCADE' })
	@JoinColumn()
	organization: Organization;

	@OneToMany(
		(type) => ProductOption,
		(productOption) => productOption.product,
		{
			eager: true
		}
	)
	options?: ProductOption[];

	@ApiProperty({ type: ProductTypeTranslation, isArray: true })
	@OneToMany(
		(type) => ProductTypeTranslation,
		(productTypeTranslation) => productTypeTranslation.reference,
		{
			eager: true,
			cascade: true
		}
	)
	translations: ProductTypeTranslation[];
}
