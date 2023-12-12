import { DiscoveryModule } from '@nestjs/core';
import { DynamicModule, Module } from '@nestjs/common';
import { getControllerClass } from './jira.controller';
import { JiraModuleAsyncOptions, JiraModuleOptions, ModuleProviders } from './jira.types';

@Module({
	imports: [DiscoveryModule]
})
export class JiraModule {
	/**
	 * Register the Jira module.
	 * @param options - Configuration options for the Jira module.
	 * @returns A dynamic module configuration.
	 */
	static forRoot(options: JiraModuleOptions): DynamicModule {
		const HookController = getControllerClass(options.config);
		return {
			global: options.isGlobal || true,
			module: JiraModule,
			controllers: [HookController],
			providers: [
				{
					provide: ModuleProviders.JiraConfig,
					useFactory: () => options.config
				}
			]
		};
	}

	/**
	 * Register the Jira module asynchronously.
	 * @param options - Configuration options for the Jira module.
	 * @returns A dynamic module configuration.
	 */
	static forRootAsync(options: JiraModuleAsyncOptions): DynamicModule {
		const HookController = getControllerClass(options.config);
		return {
			module: JiraModule,
			global: options.isGlobal || true,
			controllers: [HookController],
			providers: [
				{
					provide: ModuleProviders.JiraConfig,
					useFactory: options.useFactory,
					inject: options.inject || []
				}
			]
		};
	}
}
