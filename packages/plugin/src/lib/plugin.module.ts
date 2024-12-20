import {
	DynamicModule,
	Module,
	OnModuleDestroy,
	OnModuleInit
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import * as chalk from 'chalk';
import { ConfigService, getConfig } from '@gauzy/config';
import { PluginLifecycleMethods } from './plugin.interface';
import { getPluginModules, hasLifecycleMethod } from './plugin.helper';

@Module({})
export class PluginModule implements OnModuleInit, OnModuleDestroy {

	/**
	 * Configure the plugin module with the provided options.
	 * @returns
	 */
	static init(): DynamicModule {
		return {
			module: PluginModule,
			imports: [...getConfig().plugins],
		};
	}

	constructor(
		private readonly moduleRef: ModuleRef,
		private readonly configService: ConfigService
	) { }

	/**
	 * Lifecycle hook called once the module has been initialized.
	 */
	async onModuleInit() {
		await this.bootstrapPluginLifecycleMethods('onPluginBootstrap', (instance: Function) => {
			const pluginName = instance.constructor.name || '(anonymous plugin)';
			console.log(chalk.white(`Bootstrapped Plugin [${pluginName}]`));
		});
	}

	/**
	 * Lifecycle hook called once the module is about to be destroyed.
	 */
	async onModuleDestroy() {
		await this.bootstrapPluginLifecycleMethods('onPluginDestroy', (instance: Function) => {
			const pluginName = instance.constructor.name || '(anonymous plugin)';
			console.log(chalk.white(`Destroyed Plugin [${pluginName}]`));
		});
	}

	/**
	 * Bootstrap plugin lifecycle methods.
	 * @param lifecycleMethod The lifecycle method to invoke.
	 * @param closure A closure function to execute after invoking the lifecycle method.
	 */
	private async bootstrapPluginLifecycleMethods(
		lifecycleMethod: keyof PluginLifecycleMethods,
		closure?: (instance: any) => void
	): Promise<void> {
		const pluginsModules = getPluginModules(this.configService.plugins);
		for await (const pluginModule of pluginsModules) {
			let pluginInstance: ClassDecorator;

			try {
				pluginInstance = this.moduleRef.get(pluginModule, { strict: false });
			} catch (e) {
				console.error(`Error initializing plugin ${pluginModule.name}:`, e.stack);
			}

			if (pluginInstance && hasLifecycleMethod(pluginInstance, lifecycleMethod)) {
				await pluginInstance[lifecycleMethod]();

				if (typeof closure === 'function') {
					closure(pluginInstance);
				}
			}
		}
	}
}
