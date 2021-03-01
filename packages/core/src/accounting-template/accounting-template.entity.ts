import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { IsNotEmpty, IsString, IsEnum } from 'class-validator';
import {
	AccountingTemplateTypeEnum,
	IAccountingTemplate
} from '@gauzy/contracts';
import {
	Organization,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('accounting_template')
export class AccountingTemplate
	extends TenantOrganizationBaseEntity
	implements IAccountingTemplate {
	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	languageCode: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Column()
	mjml: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Column()
	hbs: string;

	@ApiProperty({ type: () => String, enum: AccountingTemplateTypeEnum })
	@IsEnum(AccountingTemplateTypeEnum)
	@IsNotEmpty()
	@Column()
	templateType: string;

	@ApiProperty({ type: () => Organization })
	@ManyToOne(() => Organization, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	organization: Organization;
}
