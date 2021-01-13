import { IEmail, IEmailTemplate, IUser } from '@gauzy/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { EmailTemplate } from '../email-template/email-template.entity';
import { User } from '../user/user.entity';
import { TenantOrganizationBase } from '../tenant-organization-base';

@Entity('email_sent')
export class Email extends TenantOrganizationBase implements IEmail {
	@ApiProperty({ type: EmailTemplate })
	@ManyToOne((type) => EmailTemplate, {
		nullable: false,
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	emailTemplate: IEmailTemplate;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	emailTemplateId: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column()
	content: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	email: string;

	@ApiPropertyOptional({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	isArchived?: boolean;

	@ApiProperty({ type: User })
	@ManyToOne((type) => User, {
		nullable: true,
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	user?: IUser;
}
