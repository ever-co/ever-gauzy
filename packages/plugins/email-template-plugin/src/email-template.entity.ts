import { ApiProperty } from '@nestjs/swagger';
import { Column, Index } from 'typeorm';
import { IEmailTemplate } from '@gauzy/contracts';
import { isMySQL } from "@gauzy/config";
import { MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmEmailTemplateRepository } from './repository/mikro-orm-email-template.repository';

@MultiORMEntity('email_template', { mikroOrmRepository: () => MikroOrmEmailTemplateRepository })
export class EmailTemplate extends TenantOrganizationBaseEntity
	implements IEmailTemplate {

	@ApiProperty({ type: () => String })
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: () => String })
	@Index()
	@Column()
	languageCode: string;

	@ApiProperty({ type: () => String })
	@Column({ type: 'text', nullable: true })
	mjml: string;

	@ApiProperty({ type: () => String })
	@Column({ ...(isMySQL() ? { type: "longtext" } : {}) })
	hbs: string;

	title?: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
}
