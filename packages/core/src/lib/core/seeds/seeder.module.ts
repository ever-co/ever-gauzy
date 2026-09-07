import { DynamicModule, Module } from '@nestjs/common';
import { HeaderResolver, I18nModule } from 'nestjs-i18n';
import * as path from 'path';
import { ConfigModule, environment } from '@gauzy/config';
import { getDynamicPluginsModules } from '@gauzy/plugin';
import { isSchedulerQueueRootEnabled, SchedulerModule } from '@gauzy/scheduler';
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
			path: environment.isElectron && environment.electronResourcesPath ? path.resolve(environment.electronResourcesPath, 'app.asar.unpacked/node_modules/@gauzy/core/src/lib/i18n')
				: path.resolve(__dirname, '../../i18n/'),
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
				/**
				 * 🛑 The seeder graph loads the SAME plugin list as the API (see
				 * `getDynamicPluginsModules()` below), so it needs the SAME producer-only BullMQ root.
				 *
				 * A plugin decides at module-definition time whether to register its `@Processor`
				 * host, and it can only decide that from `isSchedulerQueueRootEnabled()` — a
				 * process-independent expression. If the API registered a root and this CLI did not,
				 * that shared answer would be a lie here and `yarn seed` would die at `onModuleInit`
				 * with `Worker requires a connection`, exactly the failure that crash-looped the API
				 * earlier. Registering the root keeps the predicate honest in every process that
				 * loads plugins: API, worker, seeder.
				 *
				 * `enabled: false` for the same reason as in `AppModule` — a seeding CLI must never
				 * start cron/interval jobs.
				 */
				...(isSchedulerQueueRootEnabled()
					? [
							SchedulerModule.forRoot({
								enabled: false,
								enableQueueing: true,
								logRegisteredJobs: false
							})
					  ]
					: []),
				...getDynamicPluginsModules()
			]
		};
	}
}
