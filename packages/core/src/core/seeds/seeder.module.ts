import { DynamicModule, Module } from '@nestjs/common';
import { getDynamicPluginsModules } from '@gauzy/plugin';
import { ConfigModule, environment } from '@gauzy/config';
import { SeedDataService } from './seed-data.service';
import { DatabaseModule } from './../../database/database.module';
import { HeaderResolver, I18nModule } from 'nestjs-i18n';
import { LanguagesEnum } from '@gauzy/contracts';
import * as path from 'path';

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
				DatabaseModule,
				I18nModule.forRoot({
					fallbackLanguage: LanguagesEnum.ENGLISH,
					loaderOptions: {
						path: path.resolve(__dirname, '../../i18n/'),
						watch: !environment.production
					},
					resolvers: [new HeaderResolver(['language'])]
				})
			],
			exports: []
		} as DynamicModule;
	}
}
