import { DiscoveryModule } from '@nestjs/core';
import { DynamicModule, Module } from '@nestjs/common';
import { getControllerClass } from './jira.controller';

@Module({
	imports: [DiscoveryModule]
})
export class JiraModule {
	/**
	 * Register the Probot module.
	 * @param options - Configuration options for the Probot module.
	 * @returns A dynamic module configuration.
	 */
	static forRoot(options: any): DynamicModule {
		const HookController = getControllerClass({ path: options.path });
		return {
			global: options.isGlobal || true,
			module: JiraModule,
			controllers: [HookController]
			// providers: [],
			// exports: []
		};
	}

	/**
	 * Register the Probot module asynchronously.
	 * @param options - Configuration options for the Probot module.
	 * @returns A dynamic module configuration.
	 */
	static forRootAsync(options: any): DynamicModule {
		const HookController = getControllerClass({ path: options.path });
		return {
			module: JiraModule,
			global: options.isGlobal || true,
			controllers: [HookController]
			// providers: [],
			// exports: []
		};
	}
}
