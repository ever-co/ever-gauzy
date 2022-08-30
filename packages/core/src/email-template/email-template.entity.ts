import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, OneToMany } from 'typeorm';
import { IEmailTemplate } from '@gauzy/contracts';
import { Email, TenantOrganizationBaseEntity } from '../core/entities/internal';

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
	@Column()
	hbs: string;

	title?: string;

	/*
    |--------------------------------------------------------------------------
    | @OneToMany
    |--------------------------------------------------------------------------
    */
	// Emails
	@ApiPropertyOptional({ type: () => Email })
	@OneToMany(() => Email, (email) => email.emailTemplate, {
		cascade: true
	})
	emails?: IEmailTemplate[];
}