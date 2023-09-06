import { DynamicModule, Module } from '@nestjs/common';
import {
	ProbotModuleOptions,
	ModuleProviders,
	ProbotModuleAsyncOptions,
} from './probot.types';
import { ProbotDiscovery } from './probot.discovery';
import { getControllerClass } from './hook.controller';
import { DiscoveryModule } from '@nestjs/core';
import { HookMetadataAccessor } from './hook-metadata.accessor';
import { GitHubService } from './github.service';

@Module({
	imports: [DiscoveryModule],
})
export class ProbotModule {
	static forRoot(options: ProbotModuleOptions): DynamicModule {
		const { path: hookPath } = options;
		const HookController = getControllerClass({ path: hookPath });
		return {
			global: options.isGlobal || true,
			module: ProbotModule,
			controllers: [HookController],
			providers: [
				{
					provide: ModuleProviders.ProbotConfig,
					useFactory: () => options.config,
				},
				HookMetadataAccessor,
				ProbotDiscovery,
				GitHubService,
			],
			exports: [GitHubService],
		};
	}

	static forRootAsync(options: ProbotModuleAsyncOptions): DynamicModule {
		const { path: hookPath } = options;
		const HookController = getControllerClass({ path: hookPath });
		return {
			module: ProbotModule,
			global: options.isGlobal || true,
			controllers: [HookController],
			providers: [
				{
					provide: ModuleProviders.ProbotConfig,
					useFactory: options.useFactory,
					inject: options.inject || [],
				},
				HookMetadataAccessor,
				ProbotDiscovery,
				GitHubService,
			],
			exports: [GitHubService],
		};
	}
}
