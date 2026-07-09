import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as moment from 'moment';
import { Public } from '@gauzy/common';
import { IAppSetting, IAppVersionInfo } from '@gauzy/contracts';

// Application version + deployed commit, embedded at Docker build time via
// GAUZY_APP_VERSION / GAUZY_APP_COMMIT env vars (see .deploy/*/Dockerfile).
// Empty when running from source without those set.
const APP_VERSION = process.env.GAUZY_APP_VERSION || '';
const APP_COMMIT = process.env.GAUZY_APP_COMMIT || '';

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
	 * Returns the running API's version and deployed commit, so clients (e.g. the
	 * web UI footer) can display it and detect a version drift between the API and
	 * the web app. Public — no secrets, safe to expose unauthenticated.
	 *
	 * @returns {IAppVersionInfo} `{ name: 'api', version, commit }`.
	 */
	@HttpCode(HttpStatus.OK)
	@Get('/version')
	getAppVersion(): IAppVersionInfo {
		return {
			name: 'api',
			version: APP_VERSION,
			commit: APP_COMMIT
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
