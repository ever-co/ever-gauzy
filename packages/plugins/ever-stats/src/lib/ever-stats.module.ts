import { DynamicModule, Inject, Injectable, Logger, Module, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { gauzyToggleFeatures } from '@gauzy/config';
import { EverInstanceModule, EverInstanceService, EverOperatorService } from '@gauzy/plugin-ever-instance';
import { readEverStatsConfig } from './ever-stats-config';
import { isEverStatsEnabled } from './ever-stats-enabled';
import { EverStatsBuilder } from './ever-stats-builder.service';
import { EverStatsCollector, STATS_FEATURE_FLAGS } from './ever-stats-collector.service';
import { EverStatsController } from './ever-stats.controller';
import { EVER_STATS_CONFIG, EVER_STATS_ENV, EverStatsScheduler } from './ever-stats-scheduler.service';
import { EverStatsSender } from './ever-stats-sender.service';
import { EverStatsService } from './ever-stats.service';
import { EverStatsStateController } from './ever-stats-state.controller';
import { EverStatsStore } from './ever-stats.store';
import { EverStatsOperatorGuard } from './guards/ever-stats-operator.guard';

/**
 * Creates the identity, pins the operator and starts the daily schedule once the API is up.
 *
 * It reads `EVER_STATS_ENABLED` again first: when the module was loaded although the switch says
 * `false` (a settings file read after the plugin list was built), it creates nothing and starts
 * nothing, and every route answers 404.
 */
@Injectable()
export class EverStatsLifecycle implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly logger = new Logger('EverStats');
	private readonly env: Record<string, string | undefined>;

	constructor(
		private readonly instance: EverInstanceService,
		private readonly operator: EverOperatorService,
		private readonly scheduler: EverStatsScheduler,
		@Optional() @Inject(EVER_STATS_ENV) env?: Record<string, string | undefined>
	) {
		this.env = env ?? process.env;
	}

	async onApplicationBootstrap(): Promise<void> {
		if (!isEverStatsEnabled(this.env)) {
			this.logger.log('Anonymous usage statistics are off (EVER_STATS_ENABLED=false): nothing is created, scheduled or sent.');
			return;
		}
		try {
			await this.instance.ensure();
			await this.operator.pinFirstSuperAdmin();
			await this.scheduler.start();
			this.logger.log('Anonymous usage statistics are on (EVER_STATS_ENABLED=false switches them off).');
		} catch (error) {
			// Never stop the API: without its tables or identity the plugin stays idle.
			this.logger.warn(`Anonymous usage statistics could not start (${(error as Error)?.name ?? 'Error'}); nothing will be sent.`);
		}
	}

	onModuleDestroy(): void {
		this.scheduler.stop();
	}
}

/**
 * The anonymous usage statistics module. `register()` reads the environment once: the state route
 * for a paired Ever Teams web app is mounted only when `EVER_STATS_SERVES` names `teams`. The
 * module keeps `env` and reads `EVER_STATS_ENABLED` from it again at run time (see
 * {@link EverStatsLifecycle}).
 */
@Module({})
export class EverStatsModule {
	static register(env: Record<string, string | undefined> = process.env): DynamicModule {
		const logger = new Logger('EverStats');
		const config = readEverStatsConfig(env, (message) => logger.warn(message));
		return {
			module: EverStatsModule,
			imports: [EverInstanceModule],
			controllers: [EverStatsController, ...(config.serves.includes('teams') ? [EverStatsStateController] : [])],
			providers: [
				{ provide: EVER_STATS_CONFIG, useValue: config },
				{ provide: EVER_STATS_ENV, useValue: env },
				{ provide: STATS_FEATURE_FLAGS, useValue: gauzyToggleFeatures },
				EverStatsStore,
				EverStatsCollector,
				EverStatsBuilder,
				EverStatsSender,
				EverStatsScheduler,
				EverStatsService,
				EverStatsOperatorGuard,
				EverStatsLifecycle
			],
			exports: [EverStatsService]
		};
	}
}
