import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { performance } from 'perf_hooks';

@Injectable()
export class AppBootstrapLogger implements OnApplicationBootstrap {
    private readonly logger = new Logger(AppBootstrapLogger.name);
    private readonly startTime = performance.now();

    onApplicationBootstrap(): void {
        const totalTime = (performance.now() - this.startTime).toFixed(2);
        this.logger.log(`Application started in ${totalTime}ms`);
    }
}
