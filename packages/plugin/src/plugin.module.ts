import {
	DynamicModule,
	Module,
	OnModuleDestroy,
	OnModuleInit
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@gauzy/config';
import { PluginConfig } from '@gauzy/common';
import { PluginLifecycleMethods } from './extension-plugin';
import { getPluginModules, hasLifecycleMethod } from './plugin-helper';

@Module({})
export class PluginModule implements OnModuleInit, OnModuleDestroy {
	static forRoot(options: PluginConfig): DynamicModule {
		return {
			module: PluginModule,
			providers: [],
			imports: [...options.plugins]
		};
	}

	constructor(private readonly moduleRef: ModuleRef) {}

	async onModuleInit() {
		await this.bootstrapPluginLifecycleMethods(
			'onPluginBootstrap',
			(instance: any) => {
				const pluginName =
					instance.constructor.name || '(anonymous plugin)';
				// Logger.verbose(`Bootstrapped plugin ${pluginName}`);
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
		const configService = new ConfigService();
		for (const plugin of getPluginModules(configService.plugins)) {
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
