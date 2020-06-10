import { Email as IEmail } from '@gauzy/models';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import {
	Column,
	Entity,
	Index,
	OneToOne,
	JoinColumn,
	ManyToOne
} from 'typeorm';
import { Base } from '../core/entities/base';
import { EmailTemplate } from '../email-template/email-template.entity';
import { User } from '../user/user.entity';

@Entity('email_sent')
export class Email extends Base implements IEmail {
	@ApiProperty({ type: EmailTemplate })
	@ManyToOne((type) => EmailTemplate, {
		nullable: false,
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	emailTemplate: EmailTemplate;

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

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	organizationId: string;

	@ApiProperty({ type: User })
	@ManyToOne((type) => User, {
		nullable: true,
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	user?: User;
}
