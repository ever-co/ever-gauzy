import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsUUID } from 'class-validator';
import { Exclude } from 'class-transformer';
import { ID, IEmailReset, IUser } from '@gauzy/contracts';
import { TenantBaseEntity, User } from '../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	VirtualMultiOrmColumn
} from './../core/decorators/entity';
import { MikroOrmEmailResetRepository } from './repository/mikro-orm-email-reset.repository';

@MultiORMEntity('email_reset', { mikroOrmRepository: () => MikroOrmEmailResetRepository })
export class EmailReset extends TenantBaseEntity implements IEmailReset {
	/**
	 * The email associated with the email reset.
	 */
	@ApiProperty({ type: () => String })
	@IsEmail()
	@ColumnIndex()
	@MultiORMColumn()
	email: string;

	/**
	 * The old email used to verify the email reset.
	 */
	@ApiProperty({ type: () => String })
	@IsEmail()
	@ColumnIndex()
	@MultiORMColumn()
	oldEmail: string;

	/**
	 * The code used to verify the email reset.
	 */
	@Exclude({ toPlainOnly: true })
	@ColumnIndex()
	@MultiORMColumn()
	code: string;

	/**
	 * The token used to verify the email reset.
	 */
	@Exclude({ toPlainOnly: true })
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	token: string;

	/**
	 * The date when the email reset will expire.
	 */
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ nullable: true })
	expiredAt: Date;

	/**
	 * Additional Virtual Columns
	 */
	@VirtualMultiOrmColumn()
	isExpired: boolean;
	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * The user associated with the email reset.
	 */
	@MultiORMManyToOne(() => User, {
		nullable: true, // Indicates if relation column value can be nullable or not.
		onDelete: 'CASCADE' // Database cascade action on delete.
	})
	@JoinColumn()
	user?: IUser;

	/**
	 * The ID of the user associated with the email reset.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: EmailReset) => it.user)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	userId?: ID;
}
