import { Body, Controller, Get, Header, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiConflictResponse, ApiGoneResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@gauzy/common';
import { IAccountDeletionPreview, IAccountDeletionResult, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UseValidationPipe } from '../shared/pipes';
import { resolveThrottlerTracker, throttlerTrackerOptions } from '../throttler/tracker';
import { AccountDeletionService } from './account-deletion.service';
import { AccountDeletionTokenDTO, ConfirmAccountDeletionDTO, ConfirmCurrentAccountDeletionDTO, RequestAccountDeletionDTO } from './dto';

/** The body `POST /account-deletion/request` always answers with. */
export const ACCOUNT_DELETION_REQUEST_ACCEPTED = Object.freeze({ status: 'accepted' });

/**
 * Deleting your account(s): through a link sent to your email address, without signing in
 * (`request` / `verify` / `confirm`), or from a session (`GET|POST /me`, the in-app Danger Zone).
 *
 * The link routes are public and rate limited per client address (`@Throttle`, on top of the per-address
 * limit the service keeps per email). Answers are never cached. Deletion only ever happens on a POST
 * (`/confirm`, `/me`), never by opening the link.
 */
@ApiTags('Account Deletion')
@Controller('/account-deletion')
export class AccountDeletionController {
	constructor(private readonly accountDeletionService: AccountDeletionService) {}

	/**
	 * Emails a deletion link to the address, when it has accounts.
	 *
	 * Always `202 {"status":"accepted"}` and returned before the lookup runs, so neither the answer nor its
	 * timing says whether the address has an account.
	 */
	@ApiOperation({ summary: 'Email a link to delete the accounts of an address' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Always, whether or not the address has accounts.' })
	@Public()
	@Post('/request')
	@HttpCode(HttpStatus.ACCEPTED)
	@Header('Cache-Control', 'no-store')
	@Throttle({ default: { limit: 5, ttl: 60000 } })
	@UseValidationPipe({ whitelist: true, transform: true })
	request(@Body() body: RequestAccountDeletionDTO, @Req() req: Record<string, any>): typeof ACCOUNT_DELETION_REQUEST_ACCEPTED {
		const meta = {
			ip: resolveThrottlerTracker(req, throttlerTrackerOptions()),
			userAgent: typeof req?.headers?.['user-agent'] === 'string' ? req.headers['user-agent'] : null
		};
		// Not awaited on purpose: see the method's comment. The service never throws.
		void this.accountDeletionService.request(body, meta);
		return ACCOUNT_DELETION_REQUEST_ACCEPTED;
	}

	/**
	 * What confirming the link would delete. Does not use the link up.
	 */
	@ApiOperation({ summary: 'Preview what a deletion link would delete' })
	@ApiGoneResponse({ description: 'The link is invalid, used, replaced or expired.' })
	@Public()
	@Post('/verify')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@Throttle({ default: { limit: 10, ttl: 60000 } })
	@UseValidationPipe({ whitelist: true })
	async verify(@Body() body: AccountDeletionTokenDTO): Promise<IAccountDeletionPreview> {
		return await this.accountDeletionService.preview(body.token);
	}

	/**
	 * Deletes the accounts the link was sent for. Single use.
	 */
	@ApiOperation({ summary: 'Delete the accounts a deletion link was sent for' })
	@ApiGoneResponse({ description: 'The link is invalid, used, replaced or expired.' })
	@ApiConflictResponse({ description: 'What would be deleted changed since the preview; nothing was deleted.' })
	@Public()
	@Post('/confirm')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@Throttle({ default: { limit: 5, ttl: 60000 } })
	@UseValidationPipe({ whitelist: true })
	async confirm(@Body() body: ConfirmAccountDeletionDTO): Promise<IAccountDeletionResult> {
		return await this.accountDeletionService.confirm(body.token, body.planHash);
	}

	/**
	 * What deleting the signed-in user's account in the current workspace would do (same shape as `verify`).
	 */
	@ApiOperation({ summary: "Preview the deletion of the signed-in user's account" })
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ACCESS_DELETE_ACCOUNT)
	@Get('/me')
	@Header('Cache-Control', 'no-store')
	async previewMe(): Promise<IAccountDeletionPreview> {
		return await this.accountDeletionService.previewCurrentUser();
	}

	/**
	 * Deletes the signed-in user's account in the current workspace, with the emailed link's rules: the whole
	 * workspace when nobody else uses it, otherwise the account only, shared content kept without the name.
	 */
	@ApiOperation({ summary: "Delete the signed-in user's account (and their workspace when they are its only member)" })
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ACCESS_DELETE_ACCOUNT)
	@Post('/me')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@Throttle({ default: { limit: 5, ttl: 60000 } })
	@UseValidationPipe({ whitelist: true })
	async deleteMe(@Body() body: ConfirmCurrentAccountDeletionDTO): Promise<IAccountDeletionResult> {
		return await this.accountDeletionService.deleteCurrentUser(body.planHash);
	}
}
