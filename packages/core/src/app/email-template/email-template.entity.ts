import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index } from 'typeorm';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { IEmailTemplate } from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';

@Entity('email_template')
export class EmailTemplate
	extends TenantOrganizationBaseEntity
	implements IEmailTemplate {
	constructor(input?: DeepPartial<EmailTemplate>) {
		super(input);
	}

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
