import { JoinColumn, RelationId } from 'typeorm';
import { IProductTypeTranslation } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { ProductType, TranslationBase } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmProductTypeTranslationRepository } from './repository/mikro-orm-product-type-translation.repository';

@MultiORMEntity('product_type_translation', { mikroOrmRepository: () => MikroOrmProductTypeTranslationRepository })
export class ProductTypeTranslation extends TranslationBase
	implements IProductTypeTranslation {

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
	description: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: false })
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
	@MultiORMManyToOne(() => ProductType, (productType) => productType.translations, {
		onDelete: 'CASCADE',
		onUpdate: 'CASCADE'
	})
	@JoinColumn()
	reference: ProductType;

	@ApiProperty({ type: () => String })
	@RelationId((it: ProductTypeTranslation) => it.reference)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	referenceId: string;
}
