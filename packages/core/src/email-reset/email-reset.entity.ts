import {
	Index,
	Column,
	ManyToOne,
	JoinColumn,
	RelationId
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsUUID } from 'class-validator';
import { Exclude } from 'class-transformer';
import { IEmailReset, IUser } from '@gauzy/contracts';
import { TenantBaseEntity, User } from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmEmailResetRepository } from './repository/mikro-orm-email-reset.repository';

@MultiORMEntity('email_reset', { mikroOrmRepository: () => MikroOrmEmailResetRepository })
export class EmailReset extends TenantBaseEntity implements IEmailReset {

	@ApiProperty({ type: () => String })
	@IsEmail()
	@Index()
	@Column()
	email: string;

	@ApiProperty({ type: () => String })
	@IsEmail()
	@Index()
	@Column()
	oldEmail: string;

	@Exclude({ toPlainOnly: true })
	@Index()
	@Column()
	code: string;

	@Exclude({ toPlainOnly: true })
	@Index()
	@Column({ nullable: true })
	token: string;

	@Exclude({ toPlainOnly: true })
	@Column({ nullable: true })
	expiredAt: Date;

	isExpired: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * User
	 */
	@ManyToOne(() => User, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	user?: IUser;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: EmailReset) => it.user)
	@Index()
	@Column({ nullable: true })
	userId?: IUser['id'];
}
