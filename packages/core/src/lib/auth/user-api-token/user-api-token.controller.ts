import {
	Body,
	Controller,
	Delete,
	Get,
	Header,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	UseGuards
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@gauzy/common';
import { ID, IPagination, IUserApiTokenConfig } from '@gauzy/contracts';
import { TenantPermissionGuard } from '../../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from '../../shared/pipes';
import {
	CreateUserApiTokenDTO,
	ExchangeUserApiTokenDTO,
	UserApiTokenExchangeResponseDTO,
	UserApiTokenResponseDTO,
	UserApiTokenWithSecretResponseDTO
} from './dto/user-api-token.dto';
import { UserApiTokenService } from './user-api-token.service';
import { isUserApiTokensEnabled } from './user-api-token.utils';
import { UserApiTokensEnabledGuard } from './user-api-tokens-enabled.guard';

/**
 * The signed-in user's own API tokens.
 *
 * These routes state no permission on purpose: a token carries only its user's own permissions, so there is nothing
 * to withhold from anyone who can sign in. Each one reaches the caller's own tokens only (`UserApiTokenService`).
 */
@ApiTags('UserApiToken')
@UseGuards(TenantPermissionGuard)
@Controller('/user-api-tokens')
export class UserApiTokenController {
	constructor(private readonly userApiTokenService: UserApiTokenService) {}

	/**
	 * Whether this server has API tokens on: the web app asks, to show or hide the Settings page. Open to any signed-in
	 * user, whatever the switch says.
	 */
	@ApiOperation({ summary: 'Whether this server has personal API tokens on' })
	@ApiResponse({ status: HttpStatus.OK })
	@Get('/config')
	config(): IUserApiTokenConfig {
		return { enabled: isUserApiTokensEnabled() };
	}

	@ApiOperation({ summary: "List the signed-in user's own API tokens, without the secrets" })
	@ApiResponse({ status: HttpStatus.OK })
	@UseGuards(UserApiTokensEnabledGuard)
	@Get('/')
	async list(): Promise<IPagination<UserApiTokenResponseDTO>> {
		return await this.userApiTokenService.listOwn();
	}

	/**
	 * Creates a token. The answer carries the plain token this one time, so nothing may keep a copy of it.
	 */
	@ApiOperation({ summary: 'Create an API token for the signed-in user (returns the token once)' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Created. The response includes the plain token exactly once: store it immediately.'
	})
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input, or too many tokens held already' })
	@UseGuards(UserApiTokensEnabledGuard)
	@Throttle({ default: { limit: 10, ttl: 60000 } })
	@Post('/')
	@HttpCode(HttpStatus.CREATED)
	@Header('Cache-Control', 'no-store')
	@Header('Pragma', 'no-cache')
	@UseValidationPipe({ whitelist: true, transform: true })
	async create(@Body() input: CreateUserApiTokenDTO): Promise<UserApiTokenWithSecretResponseDTO> {
		return await this.userApiTokenService.createOwn(input);
	}

	@ApiOperation({ summary: "Revoke one of the signed-in user's own API tokens" })
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: "No such live token among the caller's own" })
	@UseGuards(UserApiTokensEnabledGuard)
	@Delete('/:id')
	@HttpCode(HttpStatus.NO_CONTENT)
	async revoke(@Param('id', UUIDValidationPipe) id: ID): Promise<void> {
		await this.userApiTokenService.revokeOwn(id);
	}
}

/**
 * Exchanges an API token for an ordinary short-lived access token.
 *
 * Public, because the API token is the credential. No validation pipe, so a malformed body gets the same 401 as a
 * revoked token. The limit is per client address, like the sign-in routes'.
 */
@ApiTags('Auth')
@Controller('/auth/api-token')
export class UserApiTokenExchangeController {
	constructor(private readonly userApiTokenService: UserApiTokenService) {}

	@ApiOperation({ summary: 'Exchange a personal API token for a short-lived access token' })
	@ApiBody({ type: ExchangeUserApiTokenDTO })
	@ApiResponse({ status: HttpStatus.OK, type: UserApiTokenExchangeResponseDTO })
	@ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'The token does not earn a session, for whatever reason' })
	@Public()
	@UseGuards(UserApiTokensEnabledGuard)
	@Throttle({ default: { limit: 10, ttl: 60000 } })
	@Post('/exchange')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@Header('Pragma', 'no-cache')
	async exchange(@Body() input: ExchangeUserApiTokenDTO): Promise<UserApiTokenExchangeResponseDTO> {
		return await this.userApiTokenService.exchange(input ?? ({} as ExchangeUserApiTokenDTO));
	}
}
