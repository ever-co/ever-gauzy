import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, OneToMany } from 'typeorm';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { IEmailTemplate } from '@gauzy/contracts';
import { Email, TenantOrganizationBaseEntity } from '../core/entities/internal';

@Entity('email_template')
export class EmailTemplate
	extends TenantOrganizationBaseEntity
	implements IEmailTemplate {
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
	@Column({ type: 'text', nullable: true })
	@IsOptional()
	mjml: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
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