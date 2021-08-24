import { IProduct, IProductTranslation, LanguagesEnum } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Column, Entity, Index, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { TranslationBase } from '../core/entities/internal';
import { Product } from './product.entity';

@Entity('product_translation')
export class ProductTranslation
	extends TranslationBase
	implements IProductTranslation {
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
	 * Product
	 */
	@ApiProperty({ type: () => Product })
	@ManyToOne(() => Product, (product) => product.translations, {
		onDelete: 'CASCADE',
		onUpdate: 'CASCADE'
	})
	@JoinColumn()
	reference: IProduct;

	@ApiProperty({ type: () => String })
	@RelationId((it: ProductTranslation) => it.reference)
	@IsString()
	@Index()
	@Column()
	referenceId: string;
}
