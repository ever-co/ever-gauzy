import { Column, JoinColumn, RelationId, Index } from 'typeorm';
import { IProductTypeTranslation as IProductCategoryTranslation } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { ProductCategory, TranslationBase } from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmProductCategoryTranslationRepository } from './repository/mikro-orm-product-category-translation.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('product_category_translation', { mikroOrmRepository: () => MikroOrmProductCategoryTranslationRepository })
export class ProductCategoryTranslation extends TranslationBase
	implements IProductCategoryTranslation {

	@ApiProperty({ type: () => String })
	@Column()
	name: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	description: string;

	@ApiProperty({ type: () => String })
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
	@MultiORMManyToOne(() => ProductCategory, (productCategory) => productCategory.translations, {
		onDelete: 'CASCADE',
		onUpdate: 'CASCADE'
	})
	@JoinColumn()
	reference: ProductCategory;

	@ApiProperty({ type: () => String })
	@RelationId((it: ProductCategoryTranslation) => it.reference)
	@Index()
	@Column()
	referenceId: string;
}
