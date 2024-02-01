import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Index, ManyToOne, RelationId } from 'typeorm';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { isMySQL } from '@gauzy/config';
import { IEmailHistory, IEmailTemplate, IUser, EmailStatusEnum } from '@gauzy/contracts';
import {
	EmailTemplate,
	TenantOrganizationBaseEntity,
	User,
} from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmEmailHistoryRepository } from './repository/mikro-orm-email-history.repository';

@MultiORMEntity('email_sent', { mikroOrmRepository: () => MikroOrmEmailHistoryRepository })
export class EmailHistory extends TenantOrganizationBaseEntity implements IEmailHistory {

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	name: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Column({
		nullable: true,
		...(isMySQL() ? { type: 'text' } : {})
	})
	content: string;

	@ApiProperty({ type: () => String })
	@Index()
	@Column()
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
	@ManyToOne(() => User, {
		onDelete: 'CASCADE',
	})
	user?: IUser;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: EmailHistory) => it.user)
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
	@RelationId((it: EmailHistory) => it.emailTemplate)
	@Index()
	@Column()
	emailTemplateId: IEmailTemplate['id'];

	@Index()
	@ApiPropertyOptional({ type: () => String, enum: EmailStatusEnum })
	@IsOptional()
	@IsEnum(EmailStatusEnum)
	@Column({
		type: 'simple-enum',
		nullable: true,
		enum: EmailStatusEnum,
		default: null
	})
	status?: EmailStatusEnum;
}
