import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { IEmail, IEmailTemplate, IUser } from '@gauzy/contracts';
import {
	EmailTemplate,
	TenantOrganizationBaseEntity,
	User
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

	@ApiPropertyOptional({ type: () => Boolean })
	@Column({ nullable: true })
	isArchived?: boolean;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */
	@ApiProperty({ type: () => User })
	@ManyToOne(() => User, {
		nullable: true,
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	user?: IUser;

	@ApiProperty({ type: () => String })
	@RelationId((it: Email) => it.user)
	@Index()
	@Column({ nullable: true })
	userId?: string;

	@ApiProperty({ type: () => EmailTemplate })
	@ManyToOne(() => EmailTemplate, (template) => template.emails, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	emailTemplate: IEmailTemplate;

	@ApiPropertyOptional({ type: () => String })
	@RelationId((it: Email) => it.emailTemplate)
	@Column({ nullable: false })
	emailTemplateId: string;
}
