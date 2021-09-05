import { Entity, Column, ManyToOne, JoinColumn, RelationId, Index } from 'typeorm';
import { IProductTypeTranslation, LanguagesEnum } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ProductType, TranslationBase } from '../core/entities/internal';

@Entity('product_type_translation')
export class ProductTypeTranslation
	extends TranslationBase
	implements IProductTypeTranslation {
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
	 * ProductType
	 */
	@ApiProperty({ type: () => ProductType })
	@ManyToOne(() => ProductType, (productType) => productType.translations, {
		onDelete: 'CASCADE',
		onUpdate: 'CASCADE'
	})
	@JoinColumn()
	reference: ProductType;

	@ApiProperty({ type: () => String })
	@RelationId((it: ProductTypeTranslation) => it.reference)
	@IsString()
	@Index()
	@Column()
	referenceId: string;
}
