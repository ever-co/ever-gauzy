import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as moment from 'moment';
import { Public } from '@gauzy/common';
import { IAppSetting } from '@gauzy/contracts';

@Controller()
@Public() // This seems to be a custom decorator indicating that this controller's endpoints are public
export class AppController {
	constructor(private readonly _configService: ConfigService) {}

	/**
	 * This is a controller method for handling the HTTP GET request to the root endpoint ('/').
	 * It is decorated with @HttpCode, @Get, and @Public decorators.
	 */
	@HttpCode(HttpStatus.OK) // Set the HTTP response code to 200 OK
	@Get('/') // Define that this method handles GET requests for the root endpoint
	async getAppStatus() {
		/**
		 * Retrieve Application Name from Configuration Service
		 *
		 * This code snippet represents the retrieval of the application name from a configuration service.
		 * It uses the `_configService` to get the application name and performs a type assertion to indicate
		 * that the retrieved value is treated as a string.
		 *
		 * @returns {string} The application name retrieved from the configuration service.
		 */
		const app_name = <string>this._configService.get<string>('app.app_name');

		// Return a JSON object with status and message
		return {
			status: HttpStatus.OK,
			message: `${app_name} API`
		};
	}

	/**
	 * Controller method to get application configurations.
	 *
	 * This method is decorated with @HttpCode, @Get decorators to specify HTTP response code
	 * and handle GET requests for the '/configs' endpoint.
	 *
	 * @returns {Object} Object containing application configurations, including timezone, date, and settings.
	 */
	@HttpCode(HttpStatus.OK) // Set the HTTP response code to 200 OK
	@Get('/configs') // Define that this method handles GET requests for the '/configs' endpoint
	async getAppConfigs(): Promise<object> {
		/**
		 * Get application configurations.
		 */
		const configs = this._configService.get<IAppSetting>('app');

		/**
		 * Get application settings.
		 */
		const settings = this._configService.get<IAppSetting>('setting');

		/**
		 * Return an object containing timezone, date, application configurations, and application settings.
		 */
		return {
			/** The guessed timezone using moment.js. */
			timezone: moment.tz.guess(),

			/** The current date and time using moment.js. */
			date: moment().format(),

			/** Application-specific configurations obtained from the configuration service. */
			...configs,

			/** Application settings obtained from the configuration service. */
			...settings
		};
	}
}
