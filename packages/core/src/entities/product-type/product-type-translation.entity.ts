import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { IProductTypeTranslation, LanguagesEnum } from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ProductType, TranslationBase } from '../internal';

@Entity('product_type_translation')
export class ProductTypeTranslation
	extends TranslationBase
	implements IProductTypeTranslation {
	constructor(input?: DeepPartial<ProductTypeTranslation>) {
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

	@ApiProperty({ type: ProductType })
	@ManyToOne(() => ProductType, (productType) => productType.translations, {
		onDelete: 'CASCADE',
		onUpdate: 'CASCADE'
	})
	@JoinColumn()
	reference: ProductType;

	@ApiProperty({ type: String, enum: LanguagesEnum })
	@IsEnum(LanguagesEnum)
	@Column({ nullable: false })
	languageCode: string;
}
