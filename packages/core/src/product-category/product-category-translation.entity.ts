import { Entity, Column, ManyToOne, JoinColumn, RelationId, Index } from 'typeorm';
import {
	IProductTypeTranslation as IProductCategoryTranslation,
	LanguagesEnum
} from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ProductCategory, TranslationBase } from '../core/entities/internal';

@Entity('product_category_translation')
export class ProductCategoryTranslation
	extends TranslationBase
	implements IProductCategoryTranslation {
	@ApiProperty({ type: () => String })
	@IsString()
	@Column()
	name: string;

	@ApiProperty({ type: () => String })
	@IsOptional()
	@Column({ nullable: true })
	description: string;

	@ApiProperty({ type: () => String, enum: LanguagesEnum })
	@IsEnum(LanguagesEnum)
	@Column({ nullable: false })
	languageCode: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */

	/**
	 * ProductCategory
	 */
	@ApiProperty({ type: () => ProductCategory })
	@ManyToOne(() => ProductCategory, (productCategory) => productCategory.translations, {
		onDelete: 'CASCADE',
		onUpdate: 'CASCADE'
	})
	@JoinColumn()
	reference: ProductCategory;

	@ApiProperty({ type: () => String })
	@RelationId((it: ProductCategoryTranslation) => it.reference)
	@IsString()
	@Index()
	@Column()
	referenceId: string;
}
