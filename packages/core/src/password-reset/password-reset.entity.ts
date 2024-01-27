import { Index, Column, AfterLoad } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import * as moment from 'moment';
import { IPasswordReset } from '@gauzy/contracts';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { TenantBaseEntity } from './../core/entities/tenant-base.entity';
import { MultiORMEntity } from './../core/decorators/entity';

@MultiORMEntity('password_reset')
export class PasswordReset extends TenantBaseEntity implements IPasswordReset {

	/** */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsEmail()
	@Index()
	@Column()
	email: string;

	/** */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Index()
	@Column()
	token: string;

	/** */
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
