import { Injectable } from '@nestjs/common';
import { Message } from '@gauzy/api-interface';
import { SeedDataService } from './core/seeds/SeedDataService';
import { UserService } from './user/user.service';

@Injectable()
export class AppService {
	/**
	 * Seed DB if no users exists (for simplicity and safety we only re-seed DB if no users found)
	 * TODO: this should actually include more checks, e.g. if schema migrated and many other things
	 */
	private async seedDBIfEmpty() {
		const count = await this.userService.count();
		console.log(`Found ${count} users in DB`);
		if (count === 0) {
			await this.seedDataService.run(true);
		}
	}

	constructor(
		private readonly seedDataService: SeedDataService,
		private readonly userService: UserService
	) {
		this.seedDBIfEmpty();
	}

	getData(): Message {
		return { message: 'Welcome to api!' };
	}
}
