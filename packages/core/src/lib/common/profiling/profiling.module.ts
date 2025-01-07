import { DynamicModule, Global, Module, OnModuleInit } from '@nestjs/common';
import { ProfilingService } from './profiling.service';

@Global()
@Module({})
export class ProfilingModule implements OnModuleInit {
	constructor(readonly profilingService: ProfilingService) {}

	static forRoot(): DynamicModule {
		return {
			module: ProfilingModule,
			providers: [ProfilingService],
			exports: [ProfilingService]
		};
	}

	/**
	 * Automatically mark the start of each module's initialization.
	 */
	onModuleInit(): void {
		const moduleName = this.constructor.name;
		this.profilingService.markModuleStart(moduleName);
	}
}
