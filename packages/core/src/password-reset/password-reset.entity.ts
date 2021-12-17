import { Entity, Index, Column, AfterLoad } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import * as moment from 'moment';
import { IPasswordReset, IResetPasswordRequest, IChangePasswordRequest } from '@gauzy/contracts';
import { BaseEntity } from './../core/entities/base.entity';
import { Match } from './../shared/decorators/validations';

@Entity('password_reset')
export class PasswordReset extends BaseEntity 
	implements IPasswordReset {
	
	@ApiProperty({ type: () => String })
	@Index()
	@Column()
	email: string;

	@ApiProperty({ type: () => String })
	@Index()
	@Column()
	token: string;

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

/**
 * Reset Password Request DTO validation
 */
export class ResetPasswordRequestDTO 
	implements IResetPasswordRequest {

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
    @IsString()
    readonly email: string;
}


/**
 * Change Password Request DTO validation
 */
export class ChangePasswordRequestDTO 
	implements IChangePasswordRequest {

	@ApiProperty({ type: () => String })
	@IsNotEmpty({
		message: 'Authorization token is invalid or missing.'
	})
	@IsString({
		message: 'Authorization token must be string.'
	})
    readonly token: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MinLength(4, {
		message: 'Password should be at least 4 characters long.'
	})
    readonly password: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MinLength(4, {
		message: 'Password should be at least 4 characters long.'
	})
	@Match(ChangePasswordRequestDTO, (it) => it.password, {
		message: 'The password and confirmation password must match.'
	})
    readonly confirmPassword: string;
}