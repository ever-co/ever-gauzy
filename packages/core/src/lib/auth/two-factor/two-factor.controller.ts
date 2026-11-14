// cspell:ignore otpauth
import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@gauzy/common';
import {
	IAuthResponse,
	ID,
	ITwoFactorCodeInput,
	ITwoFactorConfirmation,
	ITwoFactorEnrollment,
	ITwoFactorRecoveryCodes,
	ITwoFactorStatus,
	PermissionsEnum,
	RolesEnum
} from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { Permissions } from '../../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { UseValidationPipe, UUIDValidationPipe } from '../../shared/pipes';
import { UserService } from '../../user/user.service';
import { AuthService } from '../auth.service';
import { assertFirstPartyRequest } from '../oauth-app-first-party';
import {
	TwoFactorCodeDTO,
	TwoFactorConfirmDTO,
	TwoFactorEnrollDTO,
	TwoFactorStatusQueryDTO,
	TwoFactorVerifyDTO
} from './dto/two-factor.dto';
import { UserTwoFactorService } from './user-two-factor.service';

/**
 * Two-factor authentication with an authenticator app (ever-co/ever-gauzy#11916).
 *
 * A signed-in user sets it up, turns it off and replaces their recovery codes; only in their own first-party session,
 * so that a third-party application token or a personal API token cannot remove the second factor of the account it
 * acts for. `verify` completes a sign-in that answered a challenge. An administrator who may edit users resets it for
 * a member who lost their phone and recovery codes.
 */
@ApiTags('Auth')
@Controller('/auth/two-factor')
export class TwoFactorController {
	constructor(
		private readonly authService: AuthService,
		private readonly userTwoFactorService: UserTwoFactorService,
		private readonly userService: UserService
	) {}

	/**
	 * The signed-in user's state.
	 *
	 * @param query The organization of the session, to report whether it requires two-factor authentication.
	 */
	@ApiOperation({ summary: "The signed-in user's two-factor authentication" })
	@ApiResponse({ status: HttpStatus.OK, description: 'Whether it is available, on, and required.' })
	@Get('/')
	@UseGuards(TenantPermissionGuard)
	@UseValidationPipe({ whitelist: true, transform: true })
	async status(@Query() query: TwoFactorStatusQueryDTO): Promise<ITwoFactorStatus> {
		const user = RequestContext.currentUser(true);
		const organizationId = query.organizationId ?? RequestContext.currentOrganizationId();
		const required = await this.userTwoFactorService.isRequiredByOrganization(organizationId, user.tenantId);
		return await this.userTwoFactorService.statusOf(user.id, required);
	}

	/**
	 * Starts setting it up: the secret, as text and as an `otpauth://` address for a QR code.
	 *
	 * @param input The name the authenticator app shows.
	 */
	@ApiOperation({ summary: 'Start setting up two-factor authentication' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The secret and its otpauth address.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'It is already on.' })
	@ApiResponse({ status: HttpStatus.SERVICE_UNAVAILABLE, description: 'The server has no ENCRYPTION_KEY.' })
	@Post('/enroll')
	@UseGuards(TenantPermissionGuard)
	@UseValidationPipe({ whitelist: true })
	@Throttle({ default: { limit: 5, ttl: 60000 } })
	async enroll(@Body() input: TwoFactorEnrollDTO): Promise<ITwoFactorEnrollment> {
		assertFirstPartyRequest('Setting up two-factor authentication');
		const user = RequestContext.currentUser(true);
		return await this.userTwoFactorService.enroll(
			{ id: user.id, tenantId: user.tenantId ?? null, email: user.email },
			input.issuer
		);
	}

	/**
	 * Confirms the setup with the first code of the app: it is on, and the recovery codes are answered once.
	 *
	 * @param input The first code.
	 */
	@ApiOperation({ summary: 'Turn on two-factor authentication with a first code' })
	@ApiResponse({ status: HttpStatus.OK, description: 'It is on; the ten recovery codes, shown once.' })
	@ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'The code is not right.' })
	@ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Too many wrong codes in a row.' })
	@HttpCode(HttpStatus.OK)
	@Post('/confirm')
	@UseGuards(TenantPermissionGuard)
	@UseValidationPipe({ whitelist: true })
	@Throttle({ default: { limit: 10, ttl: 60000 } })
	async confirm(@Body() input: TwoFactorConfirmDTO): Promise<ITwoFactorConfirmation> {
		assertFirstPartyRequest('Turning on two-factor authentication');
		return await this.userTwoFactorService.confirm(RequestContext.currentUserId(), input.code);
	}

	/**
	 * Turns it off, with a current code or a recovery code.
	 *
	 * @param input The proof.
	 */
	@ApiOperation({ summary: 'Turn off two-factor authentication with a code or a recovery code' })
	@ApiResponse({ status: HttpStatus.OK, description: 'It is off; the new state.' })
	@HttpCode(HttpStatus.OK)
	@Post('/disable')
	@UseGuards(TenantPermissionGuard)
	@UseValidationPipe({ whitelist: true })
	@Throttle({ default: { limit: 10, ttl: 60000 } })
	async disable(@Body() input: TwoFactorCodeDTO): Promise<ITwoFactorStatus> {
		assertFirstPartyRequest('Turning off two-factor authentication');
		assertHasProof(input);
		const user = RequestContext.currentUser(true);
		await this.userTwoFactorService.disable(user.id, input);
		const required = await this.userTwoFactorService.isRequiredByOrganization(
			RequestContext.currentOrganizationId(),
			user.tenantId
		);
		return await this.userTwoFactorService.statusOf(user.id, required);
	}

	/**
	 * Replaces the recovery codes, with a current code or a recovery code. The old ones stop working.
	 *
	 * @param input The proof.
	 */
	@ApiOperation({ summary: 'Replace the recovery codes' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The ten new recovery codes, shown once.' })
	@HttpCode(HttpStatus.OK)
	@Post('/recovery-codes')
	@UseGuards(TenantPermissionGuard)
	@UseValidationPipe({ whitelist: true })
	@Throttle({ default: { limit: 10, ttl: 60000 } })
	async regenerateRecoveryCodes(@Body() input: TwoFactorCodeDTO): Promise<ITwoFactorRecoveryCodes> {
		assertFirstPartyRequest('Replacing the recovery codes');
		assertHasProof(input);
		return await this.userTwoFactorService.regenerateRecoveryCodes(RequestContext.currentUserId(), input);
	}

	/**
	 * Completes a sign-in that answered a challenge (403 `TWO_FACTOR_REQUIRED`): the challenge with a code, or with a
	 * recovery code, for the session.
	 *
	 * @param input The challenge and the proof.
	 */
	@ApiOperation({ summary: 'Complete a sign-in with a two-factor code' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The session.' })
	@ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Wrong code, or a challenge that is not valid.' })
	@ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Too many wrong codes in a row.' })
	@HttpCode(HttpStatus.OK)
	@Post('/verify')
	@Public()
	@UseValidationPipe({ whitelist: true })
	@Throttle({ default: { limit: 5, ttl: 60000 } })
	async verify(@Body() input: TwoFactorVerifyDTO): Promise<IAuthResponse> {
		assertHasProof(input);
		return await this.authService.signinWithTwoFactorCode(input);
	}

	/**
	 * An administrator's reset, for a member who lost their phone and their recovery codes: it is turned off, and the
	 * reset is recorded. Not for one's own account (that takes a code), and a super admin's only by someone who may
	 * edit super admins.
	 *
	 * @param userId The member.
	 */
	@ApiOperation({ summary: "Reset a member's two-factor authentication" })
	@ApiResponse({ status: HttpStatus.OK, description: 'Whether there was something to reset.' })
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: "One's own account, or a super admin." })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such member in this workspace.' })
	@Delete('/users/:userId')
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_USERS_EDIT)
	async resetForMember(@Param('userId', UUIDValidationPipe) userId: ID): Promise<{ reset: boolean }> {
		assertFirstPartyRequest("Resetting a member's two-factor authentication");
		const administratorId = RequestContext.currentUserId();
		if (userId === administratorId) {
			throw new ForbiddenException(
				'Turn your own two-factor authentication off from your settings, with a code.'
			);
		}
		// Read in the administrator's tenant: a member of another workspace is not found.
		const member = await this.userService.findOneByIdString(userId, { relations: { role: true } });
		const isSuperAdmin = member.role?.name === RolesEnum.SUPER_ADMIN;
		if (isSuperAdmin && !RequestContext.hasPermission(PermissionsEnum.SUPER_ADMIN_EDIT)) {
			throw new ForbiddenException();
		}
		const reset = await this.userTwoFactorService.resetByAdministrator(member.id, administratorId);
		return { reset };
	}
}

/**
 * Refuses a proof with neither a code nor a recovery code, before anything is counted.
 *
 * @param input The proof.
 */
function assertHasProof(input: ITwoFactorCodeInput): void {
	const hasCode = Boolean(input?.code?.trim());
	const hasRecoveryCode = Boolean(input?.recoveryCode?.trim());
	if (!hasCode && !hasRecoveryCode) {
		throw new BadRequestException('Send the code of your authenticator app, or one of your recovery codes.');
	}
}
