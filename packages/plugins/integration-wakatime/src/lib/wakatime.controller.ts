import { Controller, Get, Query, Post, Body, Headers, HttpCode, HttpException, HttpStatus } from '@nestjs/common';
import { WakatimeService } from './wakatime.service';

@Controller('/v1/users/current/wakatime')
export class WakatimeController {
	constructor(private readonly wakatimeService: WakatimeService) {}

	/**
	 * Fetches WakaTime summaries based on the provided query parameters.
	 *
	 * @param {object} query - The query parameters to filter summaries.
	 * @returns {Promise<any>} - A promise resolving to the WakaTime summary data.
	 *
	 * @description
	 * This method retrieves time-tracking summaries from WakaTime using the provided filters.
	 */
	@Get('/summaries')
	async getData(@Query() query) {
		const result = await this.wakatimeService.getSummaries(query);
		return result;
	}

	/**
	 * Saves bulk heartbeats received from WakaTime.
	 *
	 * @param {any[]} payload - The array of heartbeat data to be stored.
	 * @param {object} headers - The HTTP headers associated with the request.
	 * @returns {Promise<object>} - A response object indicating success or failure.
	 *
	 * @throws {HttpException} - Throws a `BadRequestException` if the request is invalid.
	 *
	 * @description
	 * This method processes bulk heartbeat data, sanitizes it, and saves it in the database.
	 * If any heartbeat fails to be stored, an error is returned.
	 */
	@Post('/heartbeats.bulk')
	@HttpCode(202)
	async saveData(@Body() payload, @Headers() headers) {
		try {
			const result = await this.wakatimeService.parameterSanitize(payload, headers);
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

	/**
	 * Saves a single heartbeat received from WakaTime.
	 *
	 * @param {object} payload - The heartbeat data to be stored.
	 * @param {object} headers - The HTTP headers associated with the request.
	 * @returns {Promise<any>} - A promise resolving to the stored heartbeat data.
	 *
	 * @description
	 * This method processes and sanitizes a single heartbeat entry before saving it.
	 */
	@Post('/heartbeats')
	async save(@Body() payload, @Headers() headers) {
		const result = await this.wakatimeService.parameterSanitize(payload, headers);
		return result;
	}
}
