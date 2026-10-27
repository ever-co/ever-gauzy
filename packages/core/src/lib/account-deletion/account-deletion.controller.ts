import { Body, Controller, Header, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiGoneResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@gauzy/common';
import { IAccountDeletionPreview, IAccountDeletionResult } from '@gauzy/contracts';
import { UseValidationPipe } from '../shared/pipes';
import { resolveThrottlerTracker, throttlerTrackerOptions } from '../throttler/tracker';
import { AccountDeletionService } from './account-deletion.service';
import { AccountDeletionTokenDTO, ConfirmAccountDeletionDTO, RequestAccountDeletionDTO } from './dto';

/** The body `POST /account-deletion/request` always answers with. */
export const ACCOUNT_DELETION_REQUEST_ACCEPTED = Object.freeze({ status: 'accepted' });

/**
 * Deleting your account(s) through a link sent to your email address, without signing in.
 *
 * All three routes are public and rate limited per client address (`@Throttle`, on top of the per-address
 * limit the service keeps per email). Answers are never cached. Deletion only ever happens on
 * `POST /confirm`, never by opening the link.
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
	@Public()
	@Post('/confirm')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@Throttle({ default: { limit: 5, ttl: 60000 } })
	@UseValidationPipe({ whitelist: true })
	async confirm(@Body() body: ConfirmAccountDeletionDTO): Promise<IAccountDeletionResult> {
		return await this.accountDeletionService.confirm(body.token);
	}
}
