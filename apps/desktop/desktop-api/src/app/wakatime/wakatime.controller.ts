import { Controller, Get, Query, Post, Body, Headers } from '@nestjs/common';

import { WakatimeService } from './wakatime.service';

@Controller()
export class WakatimeController {
	constructor(private readonly wakatimeService: WakatimeService) {}

	@Get('summaries')
	async getData(@Query() query) {
		const result = await this.wakatimeService.getSummaries(query);
		return result;
	}

	@Post('heartbeats.bulk')
	async saveData(@Body() payload, @Headers() headers) {
		const result = await this.wakatimeService.parameterSanitize(
			payload,
			headers
		);
		return result;
	}

	@Post('heartbeats')
	async save(@Body() payload, @Headers() headers) {
		const result = await this.wakatimeService.parameterSanitize(
			payload,
			headers
		);
		return result;
	}
}
