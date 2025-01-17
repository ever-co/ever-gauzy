import { DynamicModule, Global, Module } from '@nestjs/common';
import { ProfilingService } from './profiling.service';

@Global()
@Module({})
export class ProfilingModule {
	/**
	 * Configures and returns a dynamic module for Profiling.
	 * This method allows the ProfilingModule to be imported into other modules
	 * while ensuring a single instance of ProfilingService is shared across the application.
	 *
	 * @returns {DynamicModule} - A dynamic module configuration containing the module, providers, and exports.
	 *
	 * @description
	 * - Registers `ProfilingModule` as a dynamic module.
	 * - Provides `ProfilingService` globally, making it accessible in other modules.
	 * - Exports `ProfilingService` to be used by other modules.
	 *
	 * @example
	 * ```typescript
	 * import { ProfilingModule } from './profiling.module';
	 *
	 * @Module({
	 *   imports: [ProfilingModule.forRoot()],
	 * })
	 * export class BootstrapModule {}
	 * ```
	 */
	static forRoot(): DynamicModule {
		return {
			module: ProfilingModule,
			providers: [ProfilingService],
			exports: [ProfilingService]
		};
	}
}
