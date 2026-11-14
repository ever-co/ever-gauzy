import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ID, IUserSession, IUserSessionSignOutOthersResponse } from '@gauzy/contracts';
import { TenantPermissionGuard } from '../../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from '../../shared/pipes';
import {
	SignOutOtherSessionsDTO,
	SignOutOtherSessionsResponseDTO,
	UserSessionResponseDTO
} from './dto/user-session.dto';
import { UserSessionService } from './user-session.service';

/**
 * The signed-in user's own sessions: where they are signed in, and signing the other ones out.
 *
 * These routes state no permission on purpose: every one of them reaches the caller's own sessions only
 * (`UserSessionService`), so there is nothing to withhold from anyone who can sign in.
 */
@ApiTags('UserSession')
@UseGuards(TenantPermissionGuard)
@Controller('/auth/sessions')
export class UserSessionController {
	constructor(private readonly userSessionService: UserSessionService) {}

	@ApiOperation({ summary: 'List the sessions of the signed-in user' })
	@ApiResponse({ status: HttpStatus.OK, type: UserSessionResponseDTO, isArray: true })
	@Get('/')
	async list(): Promise<IUserSession[]> {
		return this.userSessionService.listOwn();
	}

	@ApiOperation({
		summary: 'Sign out every other session of the signed-in user',
		description:
			'Needs the password of the account, or for an account without one the code of the sign-in code e-mail ' +
			'(POST /api/auth/signin.email). A wrong proof signs nobody out. The access and refresh tokens of the other ' +
			'sessions stop working; personal API tokens are not touched.'
	})
	@ApiResponse({ status: HttpStatus.OK, type: SignOutOtherSessionsResponseDTO })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The password or the code is missing or wrong.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The token of the request names no session yet.' })
	@Throttle({ default: { limit: 5, ttl: 60000 } })
	@Post('/sign-out-others')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ whitelist: true })
	async signOutOthers(@Body() input: SignOutOtherSessionsDTO): Promise<IUserSessionSignOutOthersResponse> {
		return this.userSessionService.signOutOthers(input);
	}

	@ApiOperation({ summary: 'Sign out one session of the signed-in user, other than the current one' })
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'It is the session of the request.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No session of the user has this id.' })
	@Delete('/:id')
	@HttpCode(HttpStatus.NO_CONTENT)
	async signOut(@Param('id', UUIDValidationPipe) id: ID): Promise<void> {
		await this.userSessionService.signOut(id);
	}
}
