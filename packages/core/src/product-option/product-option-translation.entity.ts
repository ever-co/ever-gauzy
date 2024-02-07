import { JoinColumn, RelationId, Index } from 'typeorm';
import { IProductOptionTranslation, LanguagesEnum } from '@gauzy/contracts';
import {
	TenantOrganizationBaseEntity,
	ProductOption
} from '../core/entities/internal';
import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmProductOptionTranslationRepository } from './repository/mikro-orm-product-option-translation.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('product_option_translation', { mikroOrmRepository: () => MikroOrmProductOptionTranslationRepository })
export class ProductOptionTranslation extends TenantOrganizationBaseEntity implements IProductOptionTranslation {
	@ApiProperty({ type: () => String })
	@IsString()
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String })
	@IsString()
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
	 * ProductOption
	 */
	@ApiProperty({ type: () => ProductOption })
	@MultiORMManyToOne(() => ProductOption, (option) => option.translations)
	@JoinColumn()
	reference: ProductOption;

	@ApiProperty({ type: () => String })
	@RelationId((it: ProductOptionTranslation) => it.reference)
	@IsString()
	@Index()
	@MultiORMColumn()
	referenceId: string;
}
