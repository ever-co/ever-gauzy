import { DynamicModule, Module } from '@nestjs/common';
import { getDynamicPluginsModules } from '@gauzy/plugin';
import { ConfigModule } from '@gauzy/config';
import { SeedDataService } from './seed-data.service';
import { DatabaseModule } from './../../database/database.module';

/**
 * Import and provide seeder classes.
 *
 * @module
 */
@Module({
	imports: [ConfigModule],
	providers: [SeedDataService],
	exports: [SeedDataService]
})
export class SeederModule {
	static forPlugins(): DynamicModule {
		return {
			module: SeederModule,
			providers: [],
			imports: [
				...getDynamicPluginsModules(),
				DatabaseModule.forSeeder()
			],
			exports: []
		} as DynamicModule;
	}
}
