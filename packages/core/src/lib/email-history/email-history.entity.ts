import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RelationId } from 'typeorm';
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { isMySQL } from '@gauzy/config';
import { IEmailHistory, IEmailTemplate, IUser, EmailStatusEnum, ID } from '@gauzy/contracts';
import { EmailTemplate, TenantOrganizationBaseEntity, User } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmEmailHistoryRepository } from './repository/mikro-orm-email-history.repository';

@MultiORMEntity('email_sent', { mikroOrmRepository: () => MikroOrmEmailHistoryRepository })
export class EmailHistory extends TenantOrganizationBaseEntity implements IEmailHistory {
	/**
	 * The name of the email sent.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	name: string;

	/**
	 * The content of the email sent.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true, ...(isMySQL() ? { type: 'text' } : {}) })
	content: string;

	/**
	 * The email associated with the email sent.
	 */
	@ApiProperty({ type: () => String })
	@IsEmail()
	@ColumnIndex()
	@MultiORMColumn()
	email: string;

	/**
	 * The status of the email sent.
	 */
	@ApiPropertyOptional({ type: () => String, enum: EmailStatusEnum })
	@IsOptional()
	@IsEnum(EmailStatusEnum)
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', nullable: true, enum: EmailStatusEnum })
	status?: EmailStatusEnum;
	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * The user associated with the email sent.
	 */
	@ApiProperty({ type: () => User })
	@MultiORMManyToOne(() => User, {
		nullable: true, // Indicates if relation column value can be nullable or not.
		onDelete: 'CASCADE' // Database cascade action on delete.
	})
	user?: IUser;

	/**
	 * The ID of the user associated with the email sent.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: EmailHistory) => it.user)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	userId?: ID;

	/**
	 * The email template associated with the email sent.
	 */
	@ApiProperty({ type: () => EmailTemplate })
	@MultiORMManyToOne(() => EmailTemplate)
	emailTemplate: IEmailTemplate;

	/**
	 * The ID of the email template associated with the email sent.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: EmailHistory) => it.emailTemplate)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	emailTemplateId: ID;
}
