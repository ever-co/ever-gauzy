import { DynamicModule, Module } from '@nestjs/common';
import { HeaderResolver, I18nModule } from 'nestjs-i18n';
import * as path from 'path';
import { ConfigModule, environment } from '@gauzy/config';
import { getDynamicPluginsModules } from '@gauzy/plugin';
import { LanguagesEnum } from '@gauzy/contracts';
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
	/**
	 * Creates a dynamic module configuration for SeederModule with plugin support.
	 * @returns A dynamic module definition.
	 */
	static forPlugins(): DynamicModule {
		return {
			module: SeederModule,
			providers: [],
			imports: [
				DatabaseModule,
				I18nModule.forRoot({
					fallbackLanguage: LanguagesEnum.ENGLISH,
					loaderOptions: {
						path: path.resolve(__dirname, '../../i18n/'),
						watch: !environment.production
					},
					resolvers: [new HeaderResolver(['language'])]
				}),
				...getDynamicPluginsModules(),
			],
			exports: []
		} as DynamicModule;
	}
}
