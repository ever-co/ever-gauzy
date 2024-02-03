import { Column, JoinColumn, RelationId, Index } from 'typeorm';
import { IProductTypeTranslation } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { ProductType, TranslationBase } from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmProductTypeTranslationRepository } from './repository/mikro-orm-product-type-translation.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('product_type_translation', { mikroOrmRepository: () => MikroOrmProductTypeTranslationRepository })
export class ProductTypeTranslation extends TranslationBase
	implements IProductTypeTranslation {

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
	@Index()
	@Column()
	referenceId: string;
}
