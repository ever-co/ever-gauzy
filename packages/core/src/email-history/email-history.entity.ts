import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RelationId } from 'typeorm';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { isMySQL } from '@gauzy/config';
import { IEmailHistory, IEmailTemplate, IUser, EmailStatusEnum } from '@gauzy/contracts';
import {
	EmailTemplate,
	TenantOrganizationBaseEntity,
	User,
} from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmEmailHistoryRepository } from './repository/mikro-orm-email-history.repository';

@MultiORMEntity('email_sent', { mikroOrmRepository: () => MikroOrmEmailHistoryRepository })
export class EmailHistory extends TenantOrganizationBaseEntity implements IEmailHistory {

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	name: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({
		nullable: true,
		...(isMySQL() ? { type: 'text' } : {})
	})
	content: string;

	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@MultiORMColumn()
	email: string;


	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * User
	 */
	@ApiProperty({ type: () => User })
	@MultiORMManyToOne(() => User, {
		onDelete: 'CASCADE',
	})
	user?: IUser;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: EmailHistory) => it.user)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	userId?: IUser['id'];

	/**
	 * Email Template
	 */
	@ApiProperty({ type: () => EmailTemplate })
	@MultiORMManyToOne(() => EmailTemplate)
	emailTemplate: IEmailTemplate;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: EmailHistory) => it.emailTemplate)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	emailTemplateId: IEmailTemplate['id'];

	@ColumnIndex()
	@ApiPropertyOptional({ type: () => String, enum: EmailStatusEnum })
	@IsOptional()
	@IsEnum(EmailStatusEnum)
	@MultiORMColumn({
		type: 'simple-enum',
		nullable: true,
		enum: EmailStatusEnum,
		default: null
	})
	status?: EmailStatusEnum;
}
