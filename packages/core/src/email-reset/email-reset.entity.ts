import {
	JoinColumn,
	RelationId
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsUUID } from 'class-validator';
import { Exclude } from 'class-transformer';
import { IEmailReset, IUser } from '@gauzy/contracts';
import { TenantBaseEntity, User } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { ColumnIndex } from './../core/decorators/entity/index.decorator';
import { MikroOrmEmailResetRepository } from './repository/mikro-orm-email-reset.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('email_reset', { mikroOrmRepository: () => MikroOrmEmailResetRepository })
export class EmailReset extends TenantBaseEntity implements IEmailReset {

	@ApiProperty({ type: () => String })
	@IsEmail()
	@ColumnIndex()
	@MultiORMColumn()
	email: string;

	@ApiProperty({ type: () => String })
	@IsEmail()
	@ColumnIndex()
	@MultiORMColumn()
	oldEmail: string;

	@Exclude({ toPlainOnly: true })
	@ColumnIndex()
	@MultiORMColumn()
	code: string;

	@Exclude({ toPlainOnly: true })
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	token: string;

	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ nullable: true })
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
	@MultiORMManyToOne(() => User, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	user?: IUser;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: EmailReset) => it.user)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	userId?: IUser['id'];
}
