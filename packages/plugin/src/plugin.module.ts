import {
	DynamicModule,
	Module,
	OnModuleDestroy,
	OnModuleInit
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Logger, getConfig } from '@gauzy/core';
import { PluginLifecycleMethods } from './extension-plugin';
import { getPluginModules, hasLifecycleMethod } from './plugin-helper';

@Module({})
export class PluginModule implements OnModuleInit, OnModuleDestroy {
	static forRoot(): DynamicModule {
		return {
			module: PluginModule,
			providers: [],
			imports: [...getConfig().plugins]
		};
	}

	constructor(private readonly moduleRef: ModuleRef) {}

	async onModuleInit() {
		await this.bootstrapPluginLifecycleMethods(
			'onPluginBootstrap',
			(instance: any) => {
				const pluginName =
					instance.constructor.name || '(anonymous plugin)';
				Logger.verbose(`Bootstrapped plugin ${pluginName}`);
			}
		);
	}

	async onModuleDestroy() {
		await this.bootstrapPluginLifecycleMethods('onPluginDestroy');
	}

	private async bootstrapPluginLifecycleMethods(
		lifecycleMethod: keyof PluginLifecycleMethods,
		closure?: (instance: any) => void
	): Promise<void> {
		for (const plugin of getPluginModules(getConfig().plugins)) {
			let classInstance: ClassDecorator;
			try {
				classInstance = this.moduleRef.get(plugin, { strict: false });
			} catch (e) {
				Logger.error(
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
