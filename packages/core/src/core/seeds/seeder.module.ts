import { DynamicModule, Module } from '@nestjs/common';
import { getDynamicPluginsModules } from '@gauzy/plugin';
import { SeedDataService } from './seed-data.service';
import { DatabaseProviderModule } from './../../core/database-provider.module';

/**
 * Import and provide seeder classes.
 *
 * @module
 */
@Module({
	imports: [],
	providers: [SeedDataService],
	exports: [SeedDataService]
})
export class SeederModule {
	static forPlugins(): DynamicModule {
		return {
			module: SeederModule,
			providers: [],
			imports: [...getDynamicPluginsModules(), DatabaseProviderModule],
			exports: []
		} as DynamicModule;
	}
}
