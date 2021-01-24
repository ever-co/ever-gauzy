import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import {
	IProductTypeTranslation as IProductCategoryTranslation,
	LanguagesEnum
} from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ProductCategory, TranslationBase } from '../core/entities/internal';

@Entity('product_category_translation')
export class ProductCategoryTranslation
	extends TranslationBase
	implements IProductCategoryTranslation {
	constructor(input?: DeepPartial<ProductCategoryTranslation>) {
		super(input);
	}

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
		() => ProductCategory,
		(productCategory) => productCategory.translations,
		{
			onDelete: 'CASCADE',
			onUpdate: 'CASCADE'
		}
	)
	@JoinColumn()
	reference: ProductCategory;

	@ApiProperty({ type: String, enum: LanguagesEnum })
	@IsEnum(LanguagesEnum)
	@Column({ nullable: false })
	languageCode: string;
}
