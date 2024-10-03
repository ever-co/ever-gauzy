import { AfterLoad } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import * as moment from 'moment';
import { IPasswordReset } from '@gauzy/contracts';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { TenantBaseEntity } from './../core/entities/tenant-base.entity';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, VirtualMultiOrmColumn } from './../core/decorators/entity';
import { MikroOrmPasswordResetRepository } from './repository/mikro-orm-password-reset.repository';

@MultiORMEntity('password_reset', { mikroOrmRepository: () => MikroOrmPasswordResetRepository })
export class PasswordReset extends TenantBaseEntity implements IPasswordReset {
	/**
	 * The `email` column stores the user's email address.
	 *
	 * @example "user@example.com"
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsEmail()
	@ColumnIndex()
	@MultiORMColumn()
	email: string;

	/**
	 * Token field to store a long string (text).
	 *
	 * @example "jC4MYf4MJ9z...END5tgygcc"
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ type: 'text' })
	token: string;

	/**
	 * Virtual column to indicate if the token or record is expired.
	 *
	 * This field is not stored in the database but is computed dynamically.
	 *
	 * @example false
	 */
	@VirtualMultiOrmColumn()
	expired?: boolean;

	/**
	 * Called after entity is loaded to check if the entity is expired.
	 */
	@AfterLoad()
	afterLoadEntity?() {
		// Calculate the difference between current time and createdAt in minutes
		const expiredAt = moment();
		this.expired = expiredAt.diff(moment(this.createdAt), 'minutes') > 10;
	}
}
