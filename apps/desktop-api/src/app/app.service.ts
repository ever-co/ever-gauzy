import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
	/**
	 * Handles HTTP GET requests to retrieve a welcome message.
	 *
	 * @returns An object containing a welcome message.
	 */
	getData(): { message: string } {
		return { message: 'Welcome to desktop-api!' };
	}
}
