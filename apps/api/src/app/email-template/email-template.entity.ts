import { EmailTemplate as IEmailTemplate } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Base } from '../core/entities/base';
import { Organization } from '../organization/organization.entity';

@Entity('email_template')
export class EmailTemplate extends Base implements IEmailTemplate {
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
}
