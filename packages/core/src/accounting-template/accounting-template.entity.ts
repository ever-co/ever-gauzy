import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index } from 'typeorm';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { IAccountingTemplate } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';

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
	@Column({ nullable: true })
	@IsOptional()
	mjml: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	@IsOptional()
	hbs: string;
}
