import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import {
	ProductTypeTranslation as IProductCategoryTranslation,
	LanguagesEnum
} from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { TranslationBase } from '../core/entities/translate-base';
import { ProductCategory } from './product-category.entity';

@Entity('product_category_translation')
export class ProductCategoryTranslation extends TranslationBase
	implements IProductCategoryTranslation {
	@ApiProperty({ type: String })
	@IsString()
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsOptional()
	@Column({ nullable: true })
	description: string;

	@ApiProperty({ type: ProductCategory })
	@ManyToOne(
		(type) => ProductCategory,
		(productCategory) => productCategory.translations,
		{ onDelete: 'CASCADE', onUpdate: 'CASCADE' }
	)
	@JoinColumn()
	reference: ProductCategory;

	@ApiProperty({ type: String, enum: LanguagesEnum })
	@IsEnum(LanguagesEnum)
	@Column({ nullable: false })
	languageCode: string;
}
