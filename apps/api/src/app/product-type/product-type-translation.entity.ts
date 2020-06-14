import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import {
	ProductTypeTranslation as IProductTypeTranslation,
	LanguagesEnum
} from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { TranslationBase } from '../core/entities/translate-base';
import { ProductType } from './product-type.entity';

@Entity('product_type_translation')
export class ProductTypeTranslation extends TranslationBase
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

	@ApiProperty({ type: String, enum: LanguagesEnum })
	@IsEnum(LanguagesEnum)
	@Column({ nullable: false })
	languageCode: string;
}
