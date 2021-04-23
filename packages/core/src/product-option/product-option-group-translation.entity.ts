import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import {
	IProductOptionGroupTranslation,
	LanguagesEnum
} from '@gauzy/contracts';
import {
	TenantOrganizationBaseEntity,
	ProductOptionGroup
} from '../core/entities/internal';
import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

@Entity('product_option_group_translation')
export class ProductOptionGroupTranslation
	extends TenantOrganizationBaseEntity
	implements IProductOptionGroupTranslation {
	@ApiProperty({ type: () => String })
	@IsString()
	@Column()
	name: string;

	@ApiProperty({ type: () => ProductOptionGroup })
	@ManyToOne(() => ProductOptionGroup, (group) => group.translations)
	@JoinColumn()
	reference: ProductOptionGroup;

	@ApiProperty({ type: () => String, enum: LanguagesEnum })
	@IsEnum(LanguagesEnum)
	@Column({ nullable: false })
	languageCode: string;
}
