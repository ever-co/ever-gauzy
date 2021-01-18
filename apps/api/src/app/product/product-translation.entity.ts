import { IProductTranslation, LanguagesEnum } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { TranslationBase } from '../core/entities/translate-base';
import { Product } from './product.entity';

@Entity('product_translation')
export class ProductTranslation
	extends TranslationBase
	implements IProductTranslation {
	@ApiProperty({ type: String })
	@IsString()
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsOptional()
	@Column({ nullable: true })
	description: string;

	@ApiProperty({ type: Product })
	@ManyToOne((type) => Product, (product) => Product.translations, {
		onDelete: 'CASCADE',
		onUpdate: 'CASCADE'
	})
	@JoinColumn()
	reference: Product;

	@ApiProperty({ type: String, enum: LanguagesEnum })
	@IsEnum(LanguagesEnum)
	@Column({ nullable: false })
	languageCode: string;
}
