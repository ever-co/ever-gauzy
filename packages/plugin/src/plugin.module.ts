import {
	DynamicModule,
	Module,
	OnModuleDestroy,
	OnModuleInit
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import * as chalk from 'chalk';
import { ConfigService } from '@gauzy/config';
import { IPluginConfig } from '@gauzy/common';
import { PluginLifecycleMethods } from './extension-plugin';
import { getPluginModules, hasLifecycleMethod } from './plugin-helper';

@Module({})
export class PluginModule implements OnModuleInit, OnModuleDestroy {
	static forRoot(options: IPluginConfig): DynamicModule {
		return {
			module: PluginModule,
			providers: [],
			imports: [...options.plugins]
		} as DynamicModule;
	}

	constructor(
		private readonly moduleRef: ModuleRef,
		private readonly configService: ConfigService
	) {}

	async onModuleInit() {
		await this.bootstrapPluginLifecycleMethods(
			'onPluginBootstrap',
			(instance: any) => {
				const pluginName =
					instance.constructor.name || '(anonymous plugin)';
				console.log(chalk.green(`Bootstrapped plugin ${pluginName}`));
			}
		);
	}

	async onModuleDestroy() {
		await this.bootstrapPluginLifecycleMethods(
			'onPluginDestroy',
			(instance: any) => {
				const pluginName =
					instance.constructor.name || '(anonymous plugin)';
				console.log(chalk.green(`Destroyed plugin ${pluginName}`));
			}
		);
	}

	private async bootstrapPluginLifecycleMethods(
		lifecycleMethod: keyof PluginLifecycleMethods,
		closure?: (instance: any) => void
	): Promise<void> {
		for (const plugin of getPluginModules(this.configService.plugins)) {
			let classInstance: ClassDecorator;
			try {
				classInstance = this.moduleRef.get(plugin, { strict: false });
			} catch (e) {
				console.log(
					`Could not find ${plugin.name}`,
					undefined,
					e.stack
				);
			}
			if (classInstance) {
				if (hasLifecycleMethod(classInstance, lifecycleMethod)) {
					await classInstance[lifecycleMethod]();
				}
				if (typeof closure === 'function') {
					closure(classInstance);
				}
			}
		}
	}
}
