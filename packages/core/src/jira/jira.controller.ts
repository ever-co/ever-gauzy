import { Controller, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Jira')
@Controller()
export class JiraController {
	constructor() {}

	@Post('webhook')
	handleWebhook(@Req() request, @Res() response) {
		// Handle Jira Connect events here
		console.log('Webhook received:', request.body);

		// Respond to the event
		response.status(200).end();
	}
}
