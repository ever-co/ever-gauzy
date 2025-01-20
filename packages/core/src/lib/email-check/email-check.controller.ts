import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '@gauzy/common';
import { IEmailCheckResponse } from '@gauzy/contracts';
import { ApiKeyAuthGuard } from '../shared/guards/api-key-auth.guard';
import { CheckEmailDTO } from './dto/check-email.dto';
import { EmailCheckService } from './email-check.service';

@Controller('/auth')
@UseGuards(ApiKeyAuthGuard) // Protect API with API Key & Secret authentication
export class EmailCheckController {
	constructor(private readonly emailCheckService: EmailCheckService) {}

	/**
	 * Checks if the provided email exists in the database.
	 *
	 * @param query - An object containing the email address to check.
	 * @returns A promise resolving to an object `{ exists: boolean }`, indicating whether the email exists.
	 */
	@ApiOperation({ summary: 'Check if an email exists in the database' })
	@ApiResponse({ status: 200, description: 'Email existence checked', schema: { example: { exists: true } } })
	@ApiResponse({ status: 400, description: 'Invalid email format or missing email' })
	@Public()
	@Post('/email-check')
	async checkEmail(@Body() query: CheckEmailDTO): Promise<IEmailCheckResponse> {
		const exists = await this.emailCheckService.doesEmailExist(query.email);
		return { exists };
	}
}
