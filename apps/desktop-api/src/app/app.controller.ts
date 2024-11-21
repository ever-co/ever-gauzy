import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
	constructor(private readonly appService: AppService) {}

	/**
	 * Handles HTTP GET requests to fetch data.
	 *
	 * @returns The data retrieved from the service.
	 * This is typically an array, object, or any other data structure returned by the `appService.getData` method.
	 */
	@Get()
	getData(): any {
		return this.appService.getData();
	}
}
