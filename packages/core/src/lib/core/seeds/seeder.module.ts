import { DynamicModule, Module } from '@nestjs/common';
import { HeaderResolver, I18nModule } from 'nestjs-i18n';
import * as path from 'path';
import { ConfigModule, environment } from '@gauzy/config';
import { getDynamicPluginsModules } from '@gauzy/plugin';
import { LanguagesEnum } from '@gauzy/contracts';
import { DatabaseModule } from './../../database/database.module';
import { ActivityLogModule } from '../../activity-log/activity-log.module';
import { MentionModule } from '../../mention/mention.module';
import { EntitySubscriptionModule } from '../../entity-subscription/entity-subscription.module';
import { SeedDataService } from './seed-data.service';

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
	 * Dynamic configuration for SeederModule with plugin support.
	 * Use this for optional or plugin-related seeding logic.
	 */
	static forPlugins(): DynamicModule {
		const i18nLoaderOptions = {
			path: path.resolve(__dirname, '../../i18n/'),
			watch: !environment.production
		};

		return {
			module: SeederModule,
			imports: [
				I18nModule.forRoot({
					fallbackLanguage: LanguagesEnum.ENGLISH,
					loaderOptions: i18nLoaderOptions,
					resolvers: [new HeaderResolver(['language'])]
				}),
				DatabaseModule,
				ActivityLogModule,
				MentionModule,
				EntitySubscriptionModule,
				...getDynamicPluginsModules()
			]
		};
	}
}
