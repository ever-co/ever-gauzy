import { IProduct, IProductTranslation, LanguagesEnum } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import { TranslationBase } from '../core/entities/internal';
import { Product } from './product.entity';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmProductTranslationRepository } from './repository/mikro-orm-product-translation.repository';

@MultiORMEntity('product_translation', { mikroOrmRepository: () => MikroOrmProductTranslationRepository })
export class ProductTranslation extends TranslationBase implements IProductTranslation {
	@ApiProperty({ type: () => String })
	@IsString()
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	description: string;

	@ApiProperty({ type: () => String, enum: LanguagesEnum })
	@IsEnum(LanguagesEnum)
	@MultiORMColumn({ nullable: false })
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
	@MultiORMManyToOne(() => Product, (product) => product.translations, {
		onDelete: 'CASCADE',
		onUpdate: 'CASCADE'
	})
	@JoinColumn()
	reference: IProduct;

	@ApiProperty({ type: () => String })
	@RelationId((it: ProductTranslation) => it.reference)
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	referenceId: string;
}
