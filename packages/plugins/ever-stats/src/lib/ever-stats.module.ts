import { DynamicModule, Injectable, Logger, Module, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { MikroORM, RequestContext as MikroOrmRequestContext } from '@mikro-orm/core';
import { ClsServiceManager } from 'nestjs-cls';
import { gauzyToggleFeatures } from '@gauzy/config';
import { getORMType, MultiORMEnum, StatsModule, StatsService } from '@gauzy/core';
import { EverInstanceModule, EverInstanceService, EverOperatorService } from '@gauzy/plugin-ever-instance';
import { readEverStatsConfig } from './ever-stats-config';
import { EverStatsBuilder } from './ever-stats-builder.service';
import { EverStatsCollector, IsolatedRun, STATS_FEATURE_FLAGS, STATS_GLOBAL_COUNTERS, STATS_ISOLATED_RUN } from './ever-stats-collector.service';
import { EverStatsController } from './ever-stats.controller';
import { EVER_STATS_CONFIG, EverStatsScheduler } from './ever-stats-scheduler.service';
import { EverStatsSender } from './ever-stats-sender.service';
import { EverStatsService } from './ever-stats.service';
import { EverStatsStateController } from './ever-stats-state.controller';
import { EverStatsStore } from './ever-stats.store';
import { EverStatsOperatorGuard } from './guards/ever-stats-operator.guard';

/**
 * Runs `work` outside any HTTP request, so Gauzy's counters are instance-wide (inside a request they
 * would be scoped to the caller's tenant), and inside a MikroORM context when Gauzy runs on MikroORM.
 */
function isolatedRun(moduleRef: ModuleRef): IsolatedRun {
	return async <T>(work: () => Promise<T>): Promise<T> => {
		let cls: ReturnType<typeof ClsServiceManager.getClsService> | null = null;
		try {
			cls = ClsServiceManager.getClsService();
		} catch {
			cls = null;
		}
		const run = (): Promise<T> => {
			if (getORMType() === MultiORMEnum.MikroORM) {
				const orm = moduleRef.get(MikroORM, { strict: false });
				return MikroOrmRequestContext.create(orm.em, work) as Promise<T>;
			}
			return work();
		};
		return cls?.isActive() ? cls.exit(run) : run();
	};
}

/** Creates the identity, pins the operator and starts the daily schedule once the API is up. */
@Injectable()
export class EverStatsLifecycle implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly logger = new Logger('EverStats');

	constructor(
		private readonly instance: EverInstanceService,
		private readonly operator: EverOperatorService,
		private readonly scheduler: EverStatsScheduler
	) {}

	async onApplicationBootstrap(): Promise<void> {
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
 * for a paired Ever Teams web app is mounted only when `EVER_STATS_SERVES` names `teams`.
 */
@Module({})
export class EverStatsModule {
	static register(env: Record<string, string | undefined> = process.env): DynamicModule {
		const logger = new Logger('EverStats');
		const config = readEverStatsConfig(env, (message) => logger.warn(message));
		return {
			module: EverStatsModule,
			imports: [EverInstanceModule, StatsModule],
			controllers: [EverStatsController, ...(config.serves.includes('teams') ? [EverStatsStateController] : [])],
			providers: [
				{ provide: EVER_STATS_CONFIG, useValue: config },
				{ provide: STATS_GLOBAL_COUNTERS, useExisting: StatsService },
				{ provide: STATS_FEATURE_FLAGS, useValue: gauzyToggleFeatures },
				{ provide: STATS_ISOLATED_RUN, useFactory: isolatedRun, inject: [ModuleRef] },
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
