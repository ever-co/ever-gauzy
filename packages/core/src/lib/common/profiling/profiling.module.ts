import { DynamicModule, Global, Module, OnModuleInit } from '@nestjs/common';
import { ModuleProfilerService } from './module-profiler.service';

@Global()
@Module({})
export class ProfilingModule implements OnModuleInit {
	constructor(private readonly profilerService: ModuleProfilerService) {}

	static forRoot(): DynamicModule {
		return {
			module: ProfilingModule,
			providers: [ModuleProfilerService],
			exports: [ModuleProfilerService]
		};
	}

	/**
	 * Automatically mark the start of each module's initialization.
	 */
	onModuleInit(): void {
		const moduleName = this.constructor.name;
		this.profilerService.markModuleStart(moduleName);
	}
}
