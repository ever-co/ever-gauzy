import { EmailTemplate as IEmailTemplate } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import {
	Column,
	Entity,
	Index,
	ManyToOne,
	JoinColumn,
	RelationId
} from 'typeorm';
import { Organization } from '../organization/organization.entity';
import { TenantBase } from '../core/entities/tenant-base';

@Entity('email_template')
export class EmailTemplate extends TenantBase implements IEmailTemplate {
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

	@ApiProperty({ type: Organization })
	@ManyToOne((type) => Organization, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	organization: Organization;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((template: EmailTemplate) => template.organization)
	@IsString()
	@Column({ nullable: true })
	organizationId: string;
}
