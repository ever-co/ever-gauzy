import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import {
	ProductTypeTranslation as IProductTypeTranslation,
	LanguageCodesEnum,
} from '@gauzy/models';
import { ProductType } from './product-type.entity';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { TranslationBase } from '../core/entities/translate-base';

@Entity('product_type_translation')
export class ProductTypeTranslation extends TranslationBase<ProductType>
	implements IProductTypeTranslation {
	@ApiProperty({ type: String })
	@IsString()
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsOptional()
	@Column({ nullable: true })
	description: string;

	@ApiProperty({ type: ProductType })
	@ManyToOne(
		(type) => ProductType,
		(productType) => productType.translations,
		{ onDelete: 'CASCADE', onUpdate: 'CASCADE' }
	)
	@JoinColumn()
	reference: ProductType;

	@ApiProperty({ type: String, enum: LanguageCodesEnum })
	@IsEnum(LanguageCodesEnum)
	@Column({ nullable: false })
	languageCode: string;
}
