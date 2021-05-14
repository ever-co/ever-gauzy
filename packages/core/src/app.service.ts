import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@gauzy/config';
import { SeedDataService } from './core/seeds/seed-data.service';
import { UserService } from './user/user.service';

@Injectable()
export class AppService {
	/**
	 * Seed DB if no users exists (for simplicity and safety we only re-seed DB if no users found)
	 * TODO: this should actually include more checks, e.g. if schema migrated and many other things
	 */
	async seedDBIfEmpty() {
		const count = await this.userService.count();
		console.log(`Found ${count} users in DB`);
		if (count === 0) {
			await this.seedDataService.runDefaultSeed();
			
			if (this.configService.get('demo') === true) {
				this.seedDataService.runDemoSeed();
			}
		}
	}

	constructor(
		@Inject(forwardRef(() => SeedDataService))
		private readonly seedDataService: SeedDataService,

		@Inject(forwardRef(() => UserService))
		private readonly userService: UserService,

		@Inject(forwardRef(() => ConfigService))
		private readonly configService: ConfigService
	) {}
}
