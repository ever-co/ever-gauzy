import { IProductTranslation, LanguagesEnum } from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Product, TranslationBase } from '../core/entities/internal';

@Entity('product_translation')
export class ProductTranslation
	extends TranslationBase
	implements IProductTranslation {
	constructor(input?: DeepPartial<ProductTranslation>) {
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

	@ApiProperty({ type: Product })
	@ManyToOne(() => Product, (product) => product.translations, {
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
