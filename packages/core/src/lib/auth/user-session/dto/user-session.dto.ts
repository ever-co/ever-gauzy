import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import {
	ID,
	IUserSession,
	IUserSessionSignOutOthersInput,
	IUserSessionSignOutOthersResponse,
	UserSessionAppEnum
} from '@gauzy/contracts';

/** `POST /api/auth/sessions/sign-out-others` */
export class SignOutOtherSessionsDTO implements IUserSessionSignOutOthersInput {
	@ApiPropertyOptional({ type: () => String, description: 'The password of the account, when it has one.' })
	@IsOptional()
	@IsString()
	@MaxLength(256)
	password?: string;

	@ApiPropertyOptional({
		type: () => String,
		description:
			'For an account without a password: the code of the sign-in code e-mail, which POST /api/auth/signin.email sends.'
	})
	@IsOptional()
	@IsString()
	@MaxLength(64)
	code?: string;
}

/** One session, as `GET /api/auth/sessions` answers it. */
export class UserSessionResponseDTO implements IUserSession {
	@ApiProperty({ type: () => String, description: 'Names the session in DELETE /api/auth/sessions/:id.' })
	id: ID;

	@ApiProperty({ type: () => Boolean, description: 'True for the session the request was made from.' })
	current: boolean;

	@ApiProperty({ enum: UserSessionAppEnum, enumName: 'UserSessionAppEnum' })
	app: UserSessionAppEnum;

	@ApiProperty({ type: () => String, nullable: true, example: 'Chrome 131' })
	browser: string | null;

	@ApiProperty({ type: () => String, nullable: true, example: 'Windows' })
	os: string | null;

	@ApiProperty({ type: () => String, nullable: true })
	userAgent: string | null;

	@ApiProperty({ type: () => String, nullable: true })
	ipAddress: string | null;

	@ApiProperty({ type: () => Date })
	signedInAt: Date;

	@ApiProperty({ type: () => Date, description: 'Accurate to a few minutes.' })
	lastActiveAt: Date;
}

/** The answer of `POST /api/auth/sessions/sign-out-others`. */
export class SignOutOtherSessionsResponseDTO implements IUserSessionSignOutOthersResponse {
	@ApiProperty({ type: () => Number, description: 'How many sessions were signed out.' })
	signedOut: number;
}
