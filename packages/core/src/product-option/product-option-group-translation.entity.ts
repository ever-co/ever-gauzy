import { Entity, Column, ManyToOne, JoinColumn, RelationId, Index } from 'typeorm';
import {
	IProductOptionGroupTranslation,
	LanguagesEnum
} from '@gauzy/contracts';
import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ProductOptionGroup } from './product-option-group.entity';

@Entity('product_option_group_translation')
export class ProductOptionGroupTranslation
	extends TenantOrganizationBaseEntity
	implements IProductOptionGroupTranslation {
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
	@ManyToOne(() => ProductOptionGroup, (group) => group.translations)
	@JoinColumn()
	reference: ProductOptionGroup;

	@ApiProperty({ type: () => String })
	@RelationId((it: ProductOptionGroupTranslation) => it.reference)
	@IsString()
	@Index()
	@Column()
	referenceId: string;
}
