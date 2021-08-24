import { Entity, Column, ManyToOne, JoinColumn, RelationId, Index } from 'typeorm';
import { IProductOptionTranslation, LanguagesEnum } from '@gauzy/contracts';
import {
	TenantOrganizationBaseEntity,
	ProductOption
} from '../core/entities/internal';
import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

@Entity('product_option_translation')
export class ProductOptionTranslation
	extends TenantOrganizationBaseEntity
	implements IProductOptionTranslation {
	@ApiProperty({ type: () => String })
	@IsString()
	@Column()
	name: string;

	@ApiProperty({ type: () => String })
	@IsString()
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
	 * ProductOption
	 */
	@ApiProperty({ type: () => ProductOption })
	@ManyToOne(() => ProductOption, (option) => option.translations)
	@JoinColumn()
	reference: ProductOption;

	@ApiProperty({ type: () => String })
	@RelationId((it: ProductOptionTranslation) => it.reference)
	@IsString()
	@Index()
	@Column()
	referenceId: string;
}
