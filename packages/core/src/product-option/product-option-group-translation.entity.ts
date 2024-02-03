import { Column, JoinColumn, RelationId, Index } from 'typeorm';
import {
	IProductOptionGroupTranslation,
	LanguagesEnum
} from '@gauzy/contracts';
import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ProductOptionGroup } from './product-option-group.entity';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmProductOptionGroupTranslationRepository } from './repository/mikro-orm-product-option-group-translation.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('product_option_group_translation', { mikroOrmRepository: () => MikroOrmProductOptionGroupTranslationRepository })
export class ProductOptionGroupTranslation extends TenantOrganizationBaseEntity implements IProductOptionGroupTranslation {
	@ApiProperty({ type: () => String })
	@IsString()
	@Column()
	name: string;

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
	 * ProductOptionGroup
	 */
	@ApiProperty({ type: () => ProductOptionGroup })
	@MultiORMManyToOne(() => ProductOptionGroup, (group) => group.translations)
	@JoinColumn()
	reference: ProductOptionGroup;

	@ApiProperty({ type: () => String })
	@RelationId((it: ProductOptionGroupTranslation) => it.reference)
	@IsString()
	@Index()
	@Column()
	referenceId: string;
}
