import { Controller, Get, Query, Post, Body, Headers } from '@nestjs/common';

import { WakatimeService } from './wakatime.service';

@Controller()
export class WakatimeController {
	constructor(private readonly wakatimeService: WakatimeService) {}

	@Get('summaries')
	getData(@Query() query) {
		console.log('query', query);
		return [];
	}

	@Post('heartbeats.bulk')
	saveData(@Body() payload, @Headers() headers) {
		console.log('headers', headers);
		console.log('payload', payload);
		return {};
	}
}
