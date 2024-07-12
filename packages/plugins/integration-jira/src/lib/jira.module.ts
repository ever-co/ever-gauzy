import { DiscoveryModule } from '@nestjs/core';
import { DynamicModule, Module } from '@nestjs/common';
import { getControllerClass } from './jira.controller';
import { JiraModuleAsyncOptions, JiraModuleOptions, ModuleProviders } from './jira.types';
import { parseOptions } from './jira.helpers';

@Module({
	imports: [DiscoveryModule]
})
export class JiraModule {
	/**
	 * Register the Jira module.
	 * This function sets up and returns a dynamic module configuration for the Jira module.
	 *
	 * @param options - Configuration options for the Jira module.
	 * @returns A dynamic module configuration.
	 */
	static forRoot(options: JiraModuleOptions): DynamicModule {
		// Dynamically create a controller class based on the provided path option
		const HookController = getControllerClass(parseOptions(options));

		// Return the dynamic module configuration
		return {
			global: options.isGlobal ?? true, // Ensure global defaults to true if not provided
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
	 * This function sets up and returns a dynamic module configuration for the Probot module, asynchronously.
	 *
	 * @param options - Configuration options for the Probot module.
	 * @returns A dynamic module configuration.
	 */
	static forRootAsync(options: JiraModuleAsyncOptions): DynamicModule {
		// Dynamically create a controller class based on the provided path option
		const HookController = getControllerClass(options);

		// Return the dynamic module configuration
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
