import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { EmployeeNotificationTypeEnum } from '@gauzy/contracts';
import { UseValidationPipe } from '../shared/pipes';
import { EmployeeNotificationService } from './employee-notification.service';
import { BoardNotificationDTO } from './board-notification';

/**
 * What the Boards app tells the platform (ever-co/ever-teams#5022): a member shared a Board with colleagues, or
 * mentioned them in one. Each colleague gets a notification in their Inbox, and by email and push as their
 * preferences say.
 *
 * The Boards app sends nothing but the member's sign-in (`Authorization: Bearer …`), so these routes are not under the
 * tenant header check of `TenantPermissionGuard`: the global authentication guard admits the member, the tenant is the
 * one of their sign-in, and the body can name no other (it is whitelisted). The service checks the rest: the member
 * works in the organization, each colleague told works there too, and a third-party app's sign-in that may not write
 * is refused.
 */
@Controller('/employee-notification')
export class BoardNotificationController {
	constructor(private readonly _employeeNotificationService: EmployeeNotificationService) {}

	/**
	 * A member shared a Board with the colleagues they picked: each gets a `BoardShare`.
	 */
	@ApiOperation({ summary: 'Tell colleagues a Board was shared with them' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'How many colleagues were told' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The body names no Board, or names it wrongly' })
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'The caller works in no organization the request may use'
	})
	@ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Too many requests in a short time' })
	// A large selection goes out in requests of MAX_BOARD_NOTIFICATION_RECEIVERS: 10 a minute covers 500 colleagues
	@Throttle({ default: { limit: 10, ttl: 60000 } })
	@HttpCode(HttpStatus.CREATED)
	@Post('/board-share')
	@UseValidationPipe({ whitelist: true })
	async share(@Body() input: BoardNotificationDTO): Promise<{ notified: number }> {
		return await this._employeeNotificationService.notifyAboutBoard(
			EmployeeNotificationTypeEnum.BOARD_SHARE,
			input
		);
	}

	/**
	 * A member mentioned colleagues in a Board: each gets a `BoardMention`.
	 */
	@ApiOperation({ summary: 'Tell colleagues they were mentioned in a Board' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'How many colleagues were told' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The body names no Board, or names it wrongly' })
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'The caller works in no organization the request may use'
	})
	@ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Too many requests in a short time' })
	@Throttle({ default: { limit: 10, ttl: 60000 } })
	@HttpCode(HttpStatus.CREATED)
	@Post('/board-mention')
	@UseValidationPipe({ whitelist: true })
	async mention(@Body() input: BoardNotificationDTO): Promise<{ notified: number }> {
		return await this._employeeNotificationService.notifyAboutBoard(
			EmployeeNotificationTypeEnum.BOARD_MENTION,
			input
		);
	}
}
