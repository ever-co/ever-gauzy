import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { IEmail, IEmailTemplate, IUser } from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import {
	EmailTemplate,
	TenantOrganizationBaseEntity,
	User
} from '../core/entities/internal';

@Entity('email_sent')
export class Email extends TenantOrganizationBaseEntity implements IEmail {
	constructor(input?: DeepPartial<Email>) {
		super(input);
	}

	@ApiProperty({ type: EmailTemplate })
	@ManyToOne(() => EmailTemplate, {
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
	@ManyToOne(() => User, {
		nullable: true,
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	user?: IUser;
}
