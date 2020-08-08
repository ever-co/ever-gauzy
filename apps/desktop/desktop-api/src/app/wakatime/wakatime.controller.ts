import {
	Controller,
	Get,
	Query,
	Post,
	Body,
	Headers,
	HttpCode,
	HttpException,
	HttpStatus
} from '@nestjs/common';

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
	@HttpCode(202)
	async saveData(@Body() payload, @Headers() headers) {
		try {
			const result = await this.wakatimeService.parameterSanitize(
				payload,
				headers
			);
			if (result.identifiers.length !== payload.length) {
				throw Error('something error');
			}
			return {
				responses: payload.map((item) => {
					return [
						{
							...item
						},
						201
					];
				})
			};
		} catch (error) {
			throw new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
		}
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
