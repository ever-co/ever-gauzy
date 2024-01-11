import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index } from 'typeorm';
import { IEmailTemplate } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { databaseTypes } from "@gauzy/config";

@Entity('email_template')
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
	@Column({...(process.env.DB_TYPE === databaseTypes.mysql ? { type: "longtext" } : {})})
	hbs: string;

	title?: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
}
