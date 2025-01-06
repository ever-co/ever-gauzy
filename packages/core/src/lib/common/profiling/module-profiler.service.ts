import { Injectable, Logger, OnModuleInit, OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { performance } from 'perf_hooks';

@Injectable()
export class ModuleProfilerService implements OnModuleInit, OnApplicationBootstrap {
    private readonly logger = new Logger(ModuleProfilerService.name);
    private readonly moduleStartTimes = new Map<string, number>();
    private readonly appStartTime = performance.now();

    constructor(private readonly moduleRef: ModuleRef) {}

    /**
     * Automatically called when each module initializes.
     */
    onModuleInit(): void {
        const moduleName = this.getModuleName();
        if (!this.moduleStartTimes.has(moduleName)) {
            this.moduleStartTimes.set(moduleName, performance.now());
        }
    }

    /**
     * Called after the application has fully bootstrapped.
     */
    onApplicationBootstrap(): void {
        const bootstrapEndTime = performance.now();
        this.logInitializationTimes();
        const totalStartupTime = (bootstrapEndTime - this.appStartTime).toFixed(2);
        this.logger.log(`Total application startup time: ${totalStartupTime}ms`);
    }

    /**
     * Logs the time each module took to initialize.
     */
    private logInitializationTimes(): void {
        const threshold = 100; // Threshold in milliseconds

        for (const [moduleName, startTime] of this.moduleStartTimes.entries()) {
            const duration = performance.now() - startTime;

            // Log a warning if duration exceeds the threshold
            if (duration > threshold) {
                this.logger.warn(`${moduleName} took ${duration.toFixed(2)}ms (exceeds threshold)`);
            } else {
                this.logger.log(`${moduleName} initialized in ${duration.toFixed(2)}ms`);
            }
        }
    }

    /**
     * Retrieves the name of the currently initializing module.
     */
    private getModuleName(): string {
        const context = this.moduleRef as any;
        const moduleName = context.constructor?.name || 'UnknownModule';
        return moduleName;
    }
}
