import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { performance } from 'perf_hooks';

@Injectable()
export class ModuleProfilerService implements OnApplicationBootstrap {
    private readonly logger = new Logger(ModuleProfilerService.name);
    private readonly moduleStartTimes = new Map<string, number>();
    private readonly moduleDurations = new Map<string, number>();
    private readonly appStartTime = performance.now();

    constructor(readonly moduleRef: ModuleRef) {}

    /**
     * Hook to mark the start time of each module.
     */
    markModuleStart(moduleName: string): void {
        if (!this.moduleStartTimes.has(moduleName)) {
            this.moduleStartTimes.set(moduleName, performance.now());
        }
    }

    /**
     * Hook to mark the end time of each module and log its duration.
     */
    markModuleEnd(moduleName: string): void {
        if (this.moduleStartTimes.has(moduleName)) {
            const startTime = this.moduleStartTimes.get(moduleName) || 0;
            const duration = performance.now() - startTime;
            this.moduleDurations.set(moduleName, duration);

            // Log the duration with threshold logic
            const threshold = 100; // Threshold in milliseconds
            if (duration > threshold) {
                this.logger.warn(`${moduleName} took ${duration.toFixed(2)}ms (exceeds threshold)`);
            } else {
                this.logger.log(`${moduleName} initialized in ${duration.toFixed(2)}ms`);
            }
        }
    }

    /**
     * Logs the total startup time and all module durations when the application finishes bootstrapping.
     */
    onApplicationBootstrap(): void {
        const totalStartupTime = (performance.now() - this.appStartTime).toFixed(2);
        this.logger.log(`Total application startup time: ${totalStartupTime}ms`);

        for (const [moduleName, duration] of this.moduleDurations.entries()) {
            this.logger.log(`${moduleName} total duration: ${duration.toFixed(2)}ms`);
        }
    }
}
