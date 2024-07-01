import { DiscoveryModule } from '@nestjs/core';
import { DynamicModule, Module } from '@nestjs/common';
import { ProbotModuleOptions, ModuleProviders, ProbotModuleAsyncOptions } from './probot.types';
import { ProbotDiscovery } from './probot.discovery';
import { getControllerClass } from './hook.controller';
import { HookMetadataAccessor } from './hook-metadata.accessor';
import { OctokitService } from './octokit.service';

@Module({
	imports: [DiscoveryModule]
})
export class ProbotModule {
	/**
	 * Register the Probot module.
	 * This function sets up and returns a dynamic module configuration for the Probot module.
	 *
	 * @param options - Configuration options for the Probot module.
	 * @returns A dynamic module configuration.
	 */
	static forRoot(options: ProbotModuleOptions): DynamicModule {
		// Dynamically create a controller class based on the provided path option
		const HookController = getControllerClass({ path: options.path });

		// Return the dynamic module configuration
		return {
			module: ProbotModule,
			global: options.isGlobal || true,
			controllers: [HookController],
			providers: [
				{
					provide: ModuleProviders.ProbotConfig,
					useFactory: () => options.config
				},
				HookMetadataAccessor,
				ProbotDiscovery,
				OctokitService
			],
			exports: [OctokitService]
		};
	}

	/**
	 * Register the Probot module asynchronously.
	 * This function sets up and returns a dynamic module configuration for the Probot module, asynchronously.
	 *
	 * @param options - Configuration options for the Probot module.
	 * @returns A dynamic module configuration.
	 */
	static forRootAsync(options: ProbotModuleAsyncOptions): DynamicModule {
		// Dynamically create a controller class based on the provided path option
		const HookController = getControllerClass({ path: options.path });

		// Return the dynamic module configuration
		return {
			module: ProbotModule,
			global: options.isGlobal || true,
			controllers: [HookController],
			providers: [
				{
					provide: ModuleProviders.ProbotConfig,
					useFactory: options.useFactory,
					inject: options.inject || []
				},
				HookMetadataAccessor,
				ProbotDiscovery,
				OctokitService
			],
			exports: [OctokitService]
		};
	}
}
