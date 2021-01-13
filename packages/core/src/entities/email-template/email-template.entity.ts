import { IEmailTemplate } from '@gauzy/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { Column, Entity, Index } from 'typeorm';
import { TenantOrganizationBase } from '../tenant-organization-base';

@Entity('email_template')
export class EmailTemplate
	extends TenantOrganizationBase
	implements IEmailTemplate {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	languageCode: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	@IsOptional()
	mjml: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	hbs: string;
}
