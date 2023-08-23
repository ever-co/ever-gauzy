import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, ManyToOne, RelationId } from 'typeorm';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { IEmail, IEmailTemplate, IUser } from '@gauzy/contracts';
import {
	EmailTemplate,
	TenantOrganizationBaseEntity,
	User,
} from '../core/entities/internal';

@Entity('email_sent')
export class Email extends TenantOrganizationBaseEntity implements IEmail {

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	name: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Column({ nullable: true })
	content: string;

	@ApiProperty({ type: () => String })
	@Index()
	@Column()
	email: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
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

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Email) => it.user)
	@Index()
	@Column({ nullable: true })
	userId?: IUser['id'];

	/**
	 * Email Template
	 */
	@ApiProperty({ type: () => EmailTemplate })
	@ManyToOne(() => EmailTemplate)
	emailTemplate: IEmailTemplate;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: Email) => it.emailTemplate)
	@Index()
	@Column()
	emailTemplateId: IEmailTemplate['id'];
}
