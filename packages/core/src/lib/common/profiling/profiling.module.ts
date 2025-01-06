import { Global, Module } from '@nestjs/common';
import { ModuleProfilerService } from './module-profiler.service';

@Global()
@Module({
    providers: [ModuleProfilerService],
    exports: [ModuleProfilerService],
})
export class ProfilingModule {}
