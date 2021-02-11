import { DynamicModule, Module } from '@nestjs/common';
import { IPluginConfig } from '@gauzy/common';
import { SeedDataService } from './seed-data.service';
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
	static forPluings(options: IPluginConfig): DynamicModule {
		return {
			module: SeederModule,
			providers: [SeedDataService],
			imports: [...options.plugins],
			exports: [...options.plugins]
		} as DynamicModule;
	}
}
