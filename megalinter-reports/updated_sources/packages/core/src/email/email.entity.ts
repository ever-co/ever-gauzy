import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, ManyToOne, RelationId } from 'typeorm';
import { IEmail, IEmailTemplate, IUser } from '@gauzy/contracts';
import {
	EmailTemplate,
	TenantOrganizationBaseEntity,
	User,
} from '../core/entities/internal';

@Entity('email_sent')
export class Email extends TenantOrganizationBaseEntity implements IEmail {
	@ApiProperty({ type: () => String })
	@Index()
	@Column({ nullable: true })
	name: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	content: string;

	@ApiProperty({ type: () => String })
	@Index()
	@Column()
	email: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@Column({ type: Boolean, nullable: true, default: false })
	isArchived?: boolean;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne
    |--------------------------------------------------------------------------
    */

	/**
	 * User
	 */
	@ApiProperty({ type: () => User })
	@ManyToOne(() => User, (user) => user.emails, {
		onDelete: 'CASCADE',
	})
	user?: IUser;

	@ApiProperty({ type: () => String })
	@RelationId((it: Email) => it.user)
	@Index()
	@Column({ nullable: true })
	userId?: IUser['id'];

	/**
	 * Email Template
	 */
	@ApiProperty({ type: () => EmailTemplate })
	@ManyToOne(() => EmailTemplate, (template) => template.emails)
	emailTemplate: IEmailTemplate;

	@ApiPropertyOptional({ type: () => String })
	@RelationId((it: Email) => it.emailTemplate)
	@Column()
	emailTemplateId: IEmailTemplate['id'];
}
