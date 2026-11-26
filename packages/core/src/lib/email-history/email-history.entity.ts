// cspell:ignore EENVELOPE
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RelationId } from 'typeorm';
import { IsDate, IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
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

	/**
	 * How many automatic retries this email has had (see `email-send/email-retry.policy.ts`). Set to 0 when a send
	 * that failed for a transient reason schedules the first retry, and counted up as each retry is claimed. Unset on
	 * an email that was never scheduled for a retry: one sent at the first attempt, one that failed for another reason,
	 * and every row written before the column.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', nullable: true })
	retryCount?: number;

	/**
	 * When the next automatic retry of this failed email is due. Unset when none is: the email went, it failed for a
	 * reason a retry would not fix, its retries are spent, a retry is being sent, or it was re-sent by hand. Only a
	 * row with a time here is ever retried, so no row written before the column is.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	nextRetryAt?: Date;

	/**
	 * Why the last automatically retried attempt failed: the error code, the SMTP answer code and the SMTP step, such
	 * as `EENVELOPE 451 RCPT TO`. Never the provider's text, which can name the recipient.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	lastErrorCode?: string;

	/**
	 * When a retry sweep last claimed this email for an automatic retry. The sweeps of every process count the claims
	 * of the last sweep period across the whole table before each claim, which is what caps the retries of the whole
	 * installation rather than of each process. Unset on an email never claimed for a retry.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	lastRetryAt?: Date;
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
