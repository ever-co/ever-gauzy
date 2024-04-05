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

	/** */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsEmail()
	@ColumnIndex()
	@MultiORMColumn()
	email: string;

	/** */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn()
	token: string;

	/** Additional virtual columns */
	@VirtualMultiOrmColumn()
	expired?: boolean;

	/**
	* Called after entity is loaded.
	*/
	@AfterLoad()
	afterLoadEntity?() {
		const createdAt = moment(this.createdAt, 'YYYY-MM-DD HH:mm:ss');
		const expiredAt = moment(moment(), 'YYYY-MM-DD HH:mm:ss');
		this.expired = expiredAt.diff(createdAt, 'minutes') > 10;
	}
}
